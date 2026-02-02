import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, attack_id, config } = await req.json()

    switch (action) {
      case 'create': {
        const { data, error } = await supabaseClient
          .from('email_ip_attacks')
          .insert({
            user_id: user.id,
            ...config
          })
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, attack: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'start': {
        const { data, error } = await supabaseClient
          .from('email_ip_attacks')
          .update({ 
            status: 'running',
            started_at: new Date().toISOString()
          })
          .eq('id', attack_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, attack: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update_progress': {
        const { progress } = config
        
        const { data, error } = await supabaseClient
          .from('email_ip_attacks')
          .update({
            total_attempts: progress.total_attempts,
            successful_attempts: progress.successful_attempts,
            failed_attempts: progress.failed_attempts,
            credentials_found: progress.credentials_found
          })
          .eq('id', attack_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        if (progress.new_credentials && progress.new_credentials.length > 0) {
          for (const cred of progress.new_credentials) {
            await supabaseClient.from('combo_attack_results').insert({
                email_attack_id: attack_id,
                username: cred.username,
                password: cred.password,
                email: cred.email,
                target: cred.target,
                is_valid: true,
                response_message: cred.response_message
              })

            await supabaseClient.from('credential_vault').insert({
                user_id: user.id,
                username: cred.username,
                password: cred.password,
                email: cred.email,
                target_service: cred.target,
                category: 'email',
                source_attack_type: 'email_ip',
                source_attack_id: attack_id
              })
          }
        }

        return new Response(
          JSON.stringify({ success: true, attack: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'complete': {
        const { results } = config
        
        const { data, error } = await supabaseClient
          .from('email_ip_attacks')
          .update({
            status: results.error ? 'failed' : 'completed',
            completed_at: new Date().toISOString(),
            duration_seconds: results.duration_seconds,
            error_message: results.error
          })
          .eq('id', attack_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        await sendNotification(user.id, 'email_ip_attack_complete', {
          attack_name: data.name,
          status: data.status,
          credentials_found: data.successful_attempts
        })

        return new Response(
          JSON.stringify({ success: true, attack: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'stop': {
        const { data, error } = await supabaseClient
          .from('email_ip_attacks')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString()
          })
          .eq('id', attack_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, attack: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

interface EmailIPNotificationData {
  attack_name: string;
  status: string;
  credentials_found: number;
}

async function sendNotification(userId: string, event: string, data: EmailIPNotificationData) {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: settings } = await supabaseClient
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!settings) return

    if (settings.discord_enabled && settings.discord_webhook_url) {
      await fetch(settings.discord_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🎯 Email-IP Attack Complete',
            description: `**${data.attack_name}**\nStatus: ${data.status}\nCredentials Found: ${data.credentials_found}`,
            color: data.status === 'completed' ? 0x00ff00 : 0xff0000,
            timestamp: new Date().toISOString()
          }]
        })
      })
    }

    if (settings.slack_enabled && settings.slack_webhook_url) {
      await fetch(settings.slack_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🎯 Email-IP Attack Complete: ${data.attack_name}\nStatus: ${data.status}\nCredentials: ${data.credentials_found}`
        })
      })
    }
  } catch (error) {
    console.error('Notification error:', error)
  }
}
