// Points Manager Edge Function
// Comprehensive points management with transactions, multipliers, and achievements
/// <reference lib="deno.ns" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AwardPointsRequest {
  user_id: number
  action: string
  reference_type?: string
  reference_id?: number
  metadata?: Record<string, any>
}

interface SpendPointsRequest {
  user_id: number
  amount: number
  reason: string
  reference_type?: string
  reference_id?: number
  metadata?: Record<string, any>
}

interface GetBalanceRequest {
  user_id: number
}

interface GetTransactionsRequest {
  user_id: number
  limit?: number
  offset?: number
  transaction_type?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'award'
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Verify JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const body = await req.json()

    switch (action) {
      case 'award':
        return await awardPoints(supabase, body as AwardPointsRequest)
      
      case 'spend':
        return await spendPoints(supabase, body as SpendPointsRequest)
      
      case 'balance':
        return await getBalance(supabase, body as GetBalanceRequest)
      
      case 'transactions':
        return await getTransactions(supabase, body as GetTransactionsRequest)
      
      case 'leaderboard':
        return await getLeaderboard(supabase, {
          type: url.searchParams.get('type') || 'all_time',
          limit: parseInt(url.searchParams.get('limit') || '100')
        })
      
      case 'achievements':
        return await checkAchievements(supabase, body as { user_id: number })
      
      default:
        throw new Error(\`Unknown action: \${action}\`)
    }

  } catch (error: unknown) {
    const err = error as Error
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: err.message || 'Internal server error',
        details: err.toString()
      }),
      { 
        status: err.message?.includes('Unauthorized') ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Award points to a user
async function awardPoints(supabase: any, request: AwardPointsRequest) {
  const { user_id, action, reference_type, reference_id, metadata } = request

  // Call the PostgreSQL function to award points
  const { data, error } = await supabase.rpc('award_points', {
    p_user_id: user_id,
    p_action: action,
    p_reference_type: reference_type || null,
    p_reference_id: reference_id || null,
    p_metadata: metadata || {}
  })

  if (error) {
    throw new Error(\`Failed to award points: \${error.message}\`)
  }

  // Get updated balance
  const { data: balance, error: balanceError } = await supabase
    .from('user_points')
    .select('current_balance, total_points_earned, streak_days, current_rank')
    .eq('user_id', user_id)
    .single()

  if (balanceError) {
    console.error('Failed to fetch balance:', balanceError)
  }

  // Trigger webhook for points awarded
  await triggerWebhook(supabase, {
    user_id,
    event_type: 'points.awarded',
    event_data: {
      action,
      points_awarded: data,
      new_balance: balance?.current_balance,
      reference_type,
      reference_id,
      metadata
    }
  })

  return new Response(
    JSON.stringify({
      success: true,
      points_awarded: data,
      balance: balance?.current_balance,
      total_earned: balance?.total_points_earned,
      streak_days: balance?.streak_days,
      rank: balance?.current_rank
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Spend points
async function spendPoints(supabase: any, request: SpendPointsRequest) {
  const { user_id, amount, reason, reference_type, reference_id, metadata } = request

  // Check current balance
  const { data: userPoints, error: balanceError } = await supabase
    .from('user_points')
    .select('current_balance')
    .eq('user_id', user_id)
    .single()

  if (balanceError) {
    throw new Error('User not found')
  }

  if (userPoints.current_balance < amount) {
    throw new Error('Insufficient balance')
  }

  // Get new balance
  const new_balance = userPoints.current_balance - amount

  // Create spend transaction
  const { data, error } = await supabase
    .from('point_transactions')
    .insert({
      user_id,
      transaction_type: 'spend',
      amount: -Math.abs(amount),
      balance_after: new_balance,
      reason,
      reference_type: reference_type || null,
      reference_id: reference_id || null,
      metadata: metadata || {}
    })
    .select()
    .single()

  if (error) {
    throw new Error(\`Failed to spend points: \${error.message}\`)
  }

  // Trigger webhook
  await triggerWebhook(supabase, {
    user_id,
    event_type: 'points.spent',
    event_data: {
      amount,
      reason,
      new_balance,
      reference_type,
      reference_id
    }
  })

  return new Response(
    JSON.stringify({
      success: true,
      points_spent: amount,
      new_balance,
      transaction_id: data.id
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Get user balance
async function getBalance(supabase: any, request: GetBalanceRequest) {
  const { user_id } = request

  const { data, error } = await supabase
    .from('user_points')
    .select(\`
      current_balance,
      total_points_earned,
      points_spent,
      streak_days,
      current_rank,
      rank_percentile,
      multiplier,
      bonus_expires_at,
      last_activity_date
    \`)
    .eq('user_id', user_id)
    .single()

  if (error) {
    throw new Error(\`Failed to fetch balance: \${error.message}\`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      ...data
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Get transaction history
async function getTransactions(supabase: any, request: GetTransactionsRequest) {
  const { user_id, limit = 50, offset = 0, transaction_type } = request

  let query = supabase
    .from('point_transactions')
    .select(\`
      id,
      transaction_type,
      amount,
      balance_after,
      reason,
      reference_type,
      reference_id,
      metadata,
      multiplier_applied,
      created_at
    \`)
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (transaction_type) {
    query = query.eq('transaction_type', transaction_type)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(\`Failed to fetch transactions: \${error.message}\`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      transactions: data,
      total: count,
      limit,
      offset
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Get leaderboard
async function getLeaderboard(supabase: any, options: { type: string, limit: number }) {
  const { type, limit } = options

  let query: any

  if (type === 'all_time') {
    // Use materialized view for performance
    query = supabase
      .from('mv_leaderboard_alltime')
      .select('*')
      .limit(limit)
  } else if (type === 'monthly') {
    query = supabase
      .from('mv_leaderboard_monthly')
      .select('*')
      .limit(limit)
  } else {
    // Dynamic leaderboard
    query = supabase
      .from('user_points')
      .select(\`
        user_id,
        total_points_earned,
        current_balance,
        streak_days,
        users (username, email)
      \`)
      .order('total_points_earned', { ascending: false })
      .limit(limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(\`Failed to fetch leaderboard: \${error.message}\`)
  }

  // Add ranks
  const rankedData = data.map((entry: any, index: number) => ({
    ...entry,
    rank: index + 1
  }))

  return new Response(
    JSON.stringify({
      success: true,
      leaderboard: rankedData,
      type,
      generated_at: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Check and award achievements
async function checkAchievements(supabase: any, request: { user_id: number }) {
  const { user_id } = request

  // Call PostgreSQL function to check achievements
  const { data, error } = await supabase.rpc('check_achievements', {
    p_user_id: user_id
  })

  if (error) {
    console.error('Achievement check error:', error)
  }

  // Get newly unlocked achievements
  const { data: newAchievements, error: achievementError } = await supabase
    .from('user_achievements')
    .select(\`
      id,
      unlocked_at,
      achievements (
        name,
        description,
        points_reward,
        tier,
        icon_url
      )
    \`)
    .eq('user_id', user_id)
    .eq('notified', false)
    .eq('is_unlocked', true)

  if (achievementError) {
    console.error('Failed to fetch new achievements:', achievementError)
  }

  // Mark achievements as notified
  if (newAchievements && newAchievements.length > 0) {
    await supabase
      .from('user_achievements')
      .update({ notified: true })
      .in('id', newAchievements.map((a: any) => a.id))

    // Trigger webhooks for each new achievement
    for (const achievement of newAchievements) {
      await triggerWebhook(supabase, {
        user_id,
        event_type: 'achievement.unlocked',
        event_data: achievement
      })
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      new_achievements: newAchievements || [],
      count: newAchievements?.length || 0
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

// Trigger webhook
async function triggerWebhook(supabase: any, params: {
  user_id: number,
  event_type: string,
  event_data: any
}) {
  const { user_id, event_type, event_data } = params

  // Get active webhooks for this user and event
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('id, url, secret, events')
    .eq('user_id', user_id)
    .eq('enabled', true)

  if (!webhooks || webhooks.length === 0) {
    return
  }

  // Filter webhooks subscribed to this event
  const subscribedWebhooks = webhooks.filter((webhook: any) => {
    try {
      const events = JSON.parse(webhook.events || '[]')
      return events.includes(event_type)
    } catch (e: unknown) {
      return false
    }
  })

  // Create webhook events for delivery
  for (const webhook of subscribedWebhooks) {
    await supabase
      .from('webhook_events_extended')
      .insert({
        webhook_id: webhook.id,
        user_id,
        event_type,
        event_data,
        delivery_status: 'pending',
        attempts: 0,
        max_attempts: 5
      })
  }
}

console.log('Points Manager Edge Function ready!')
