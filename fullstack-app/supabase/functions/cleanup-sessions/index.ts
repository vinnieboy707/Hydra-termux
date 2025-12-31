// Cleanup Sessions Edge Function
// Removes expired sessions and tokens

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Cleanup expired sessions
    const { error: sessionsError } = await supabaseClient
      .rpc('cleanup_expired_sessions')

    // Cleanup expired refresh tokens
    const { error: tokensError } = await supabaseClient
      .rpc('cleanup_expired_refresh_tokens')

    if (sessionsError || tokensError) {
      return new Response(
        JSON.stringify({ error: 'Cleanup failed', details: { sessionsError, tokensError } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Cleanup completed successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
