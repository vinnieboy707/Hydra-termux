// Send Notification Edge Function
// Sends email/SMS notifications for important events

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, event_type, data } = await req.json()

    if (!user_id || !event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user details
    const { data: user } = await supabaseClient
      .from('users')
      .select('email, username')
      .eq('id', user_id)
      .single()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log notification
    await supabaseClient.from('logs').insert({
      user_id,
      level: 'info',
      message: `Notification sent: ${event_type}`,
      details: { event_type, data }
    })

    // In production, integrate with email service (SendGrid, Resend, etc.)
    console.log('Notification:', { user: user.email, event_type, data })

    return new Response(
      JSON.stringify({ message: 'Notification sent', user: user.username }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
