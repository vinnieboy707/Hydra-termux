// Attack Webhook Edge Function
// Triggers webhooks when attacks complete

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

    const { attack_id, event_type } = await req.json()

    if (!attack_id || !event_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get attack and trigger webhooks
    const { data: attack } = await supabaseClient
      .from('attacks')
      .select('*')
      .eq('id', attack_id)
      .single()

    if (!attack) {
      return new Response(
        JSON.stringify({ error: 'Attack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get active webhooks
    const { data: webhooks } = await supabaseClient
      .from('webhooks')
      .select('*')
      .eq('user_id', attack.user_id)
      .eq('is_active', true)
      .contains('events', [event_type])

    const results = []
    for (const webhook of webhooks || []) {
      const payload = {
        event: event_type,
        timestamp: new Date().toISOString(),
        data: attack
      }

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        results.push({ webhook_id: webhook.id, status: response.status })
      } catch (error) {
        results.push({ webhook_id: webhook.id, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ message: 'Webhooks triggered', results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
