// Attack Webhook Edge Function
// Triggers webhooks when attacks complete with HMAC signatures, retry logic, and rate limiting
/// <reference lib="deno.ns" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff in ms
const WEBHOOK_TIMEOUT = 30000 // 30 seconds

// Request validation middleware
interface RequestBody {
  attack_id: number;
  event_type: string;
}

function validateRequest(body: unknown): { valid: true; data: RequestBody } | { valid: false; error: string } {
  const requestBody = body as RequestBody;
  
  if (!requestBody.attack_id || typeof requestBody.attack_id !== 'number') {
    return { valid: false, error: 'Invalid attack_id: must be a number' }
  }
  if (!requestBody.event_type || typeof requestBody.event_type !== 'string') {
    return { valid: false, error: 'Invalid event_type: must be a string' }
  }
  const validEvents = ['attack.queued', 'attack.started', 'attack.completed', 'attack.failed', 
                       'credentials.found', 'target.added', 'wordlist.uploaded']
  if (!validEvents.includes(requestBody.event_type)) {
    return { valid: false, error: `Invalid event_type: must be one of ${validEvents.join(', ')}` }
  }
  return { valid: true, data: requestBody }
}

// Rate limiting check
function checkRateLimit(userId: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true }
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetTime: userLimit.resetTime }
  }
  
  userLimit.count++
  return { allowed: true }
}

// Generate HMAC SHA-256 signature
async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Send webhook with retry logic and timeout
interface WebhookData {
  attack_id: number;
  protocol: string;
  host: string;
  port: number;
  status: string;
  credentials_found: number;
  duration_seconds: number;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  webhook_id: number;
  data: WebhookData;
}

async function sendWebhookWithRetry(
  url: string,
  payload: WebhookPayload,
  secret: string,
  retries = MAX_RETRIES
): Promise<{ success: boolean; status?: number; error?: string; attempts: number }> {
  const payloadString = JSON.stringify(payload)
  const signature = await generateHmacSignature(payloadString, secret)
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': payload.event,
          'X-Webhook-Timestamp': payload.timestamp,
        },
        body: payloadString,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        return { success: true, status: response.status, attempts: attempt + 1 }
      }
      
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return { 
          success: false, 
          status: response.status, 
          error: `Client error: ${response.statusText}`,
          attempts: attempt + 1 
        }
      }
      
      // Retry on server errors (5xx) or network issues
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
        continue
      }
      
      return { 
        success: false, 
        status: response.status, 
        error: `Server error after ${retries} attempts`,
        attempts: retries 
      }
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
          continue
        }
        return { 
          success: false, 
          error: `Timeout after ${WEBHOOK_TIMEOUT}ms`,
          attempts: retries 
        }
      }
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
        continue
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: retries 
      }
    }
  }
  
  return { success: false, error: 'Max retries exceeded', attempts: retries }
}

// Batch process webhooks with concurrency limit
interface Webhook {
  id: number;
  url: string;
  secret: string;
  success_count: number;
  failure_count: number;
}

interface Attack {
  id: number;
  protocol: string;
  host: string;
  port: number;
  status: string;
  credentials_found: number;
  duration_seconds: number;
}

async function batchProcessWebhooks(
  webhooks: Webhook[],
  attack: Attack,
  event_type: string,
  supabaseClient: SupabaseClient
): Promise<Array<{ webhook_id: number; success: boolean; status?: number; error?: string; attempts: number }>> {
  const BATCH_SIZE = 5 // Process 5 webhooks concurrently
  const results = []
  
  for (let i = 0; i < webhooks.length; i += BATCH_SIZE) {
    const batch = webhooks.slice(i, i + BATCH_SIZE)
    const batchPromises = batch.map(async (webhook) => {
      const payload = {
        event: event_type,
        timestamp: new Date().toISOString(),
        webhook_id: webhook.id,
        data: {
          attack_id: attack.id,
          protocol: attack.protocol,
          host: attack.host,
          port: attack.port,
          status: attack.status,
          credentials_found: attack.credentials_found,
          duration_seconds: attack.duration_seconds,
        }
      }
      
      const result = await sendWebhookWithRetry(webhook.url, payload, webhook.secret)
      
      // Log webhook delivery
      await supabaseClient.from('webhook_logs').insert({
        webhook_id: webhook.id,
        event_type,
        payload,
        response_status: result.status,
        error_message: result.error,
        created_at: new Date().toISOString(),
      })
      
      // Update webhook stats
      if (result.success) {
        await supabaseClient
          .from('webhooks')
          .update({
            success_count: webhook.success_count + 1,
            last_triggered_at: new Date().toISOString(),
          })
          .eq('id', webhook.id)
      } else {
        await supabaseClient
          .from('webhooks')
          .update({
            failure_count: webhook.failure_count + 1,
            last_triggered_at: new Date().toISOString(),
          })
          .eq('id', webhook.id)
      }
      
      return {
        webhook_id: webhook.id,
        success: result.success,
        status: result.status,
        error: result.error,
        attempts: result.attempts,
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }
  
  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    
    // Validate request
    const validation = validateRequest(body)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { attack_id, event_type } = validation.data
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get attack and trigger webhooks
    const { data: attack, error: attackError } = await supabaseClient
      .from('attacks')
      .select('*')
      .eq('id', attack_id)
      .single()

    if (attackError || !attack) {
      return new Response(
        JSON.stringify({ error: 'Attack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit(attack.user_id.toString())
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime,
          retryAfter: Math.ceil((rateLimit.resetTime! - Date.now()) / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((rateLimit.resetTime! - Date.now()) / 1000))
          } 
        }
      )
    }

    // Get active webhooks
    const { data: webhooks, error: webhooksError } = await supabaseClient
      .from('webhooks')
      .select('*')
      .eq('user_id', attack.user_id)
      .eq('is_active', true)
      .contains('events', [event_type])

    if (webhooksError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch webhooks', details: webhooksError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active webhooks found for this event', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Batch process webhooks
    const results = await batchProcessWebhooks(webhooks, attack, event_type, supabaseClient)

    return new Response(
      JSON.stringify({ 
        message: 'Webhooks processed',
        results,
        total: webhooks.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.name : 'UnknownError'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
