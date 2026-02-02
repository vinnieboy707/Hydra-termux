// Cleanup Sessions Edge Function
// Removes expired sessions and tokens with comprehensive error handling and logging
/// <reference lib="deno.ns" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Error types for granular error handling
enum CleanupErrorType {
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  FUNCTION_ERROR = 'FUNCTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface CleanupResult {
  success: boolean
  sessionsDeleted?: number
  tokensDeleted?: number
  duration?: number
  error?: {
    type: CleanupErrorType
    message: string
    details?: any
  }
}

async function cleanupExpiredSessions(supabaseClient: SupabaseClient): Promise<{ count: number; error?: unknown }> {
  try {
    const { data, error } = await supabaseClient.rpc('cleanup_expired_sessions')
    
    if (error) {
      console.error('Session cleanup error:', error)
      return { count: 0, error }
    }
    
    return { count: data || 0 }
  } catch (error) {
    console.error('Session cleanup exception:', error)
    return { count: 0, error }
  }
}

async function cleanupExpiredRefreshTokens(supabaseClient: SupabaseClient): Promise<{ count: number; error?: unknown }> {
  try {
    const { data, error } = await supabaseClient.rpc('cleanup_expired_refresh_tokens')
    
    if (error) {
      console.error('Token cleanup error:', error)
      return { count: 0, error }
    }
    
    return { count: data || 0 }
  } catch (error) {
    console.error('Token cleanup exception:', error)
    return { count: 0, error }
  }
}

async function logCleanupOperation(
  supabaseClient: SupabaseClient,
  result: CleanupResult
): Promise<void> {
  try {
    await supabaseClient.from('logs').insert({
      level: result.success ? 'info' : 'error',
      message: result.success 
        ? `Cleanup completed: ${result.sessionsDeleted} sessions, ${result.tokensDeleted} tokens deleted`
        : `Cleanup failed: ${result.error?.message}`,
      details: {
        sessionsDeleted: result.sessionsDeleted,
        tokensDeleted: result.tokensDeleted,
        duration: result.duration,
        error: result.error,
      },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to log cleanup operation:', error)
  }
}

serve(async (req) => {
  const startTime = Date.now()
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      const result: CleanupResult = {
        success: false,
        error: {
          type: CleanupErrorType.AUTH_ERROR,
          message: 'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
        }
      }
      
      return new Response(
        JSON.stringify(result),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Cleanup expired sessions
    const sessionCleanup = await cleanupExpiredSessions(supabaseClient)
    
    // Cleanup expired refresh tokens
    const tokenCleanup = await cleanupExpiredRefreshTokens(supabaseClient)
    
    const duration = Date.now() - startTime
    
    // Check if either cleanup failed
    if (sessionCleanup.error || tokenCleanup.error) {
      const result: CleanupResult = {
        success: false,
        sessionsDeleted: sessionCleanup.count,
        tokensDeleted: tokenCleanup.count,
        duration,
        error: {
          type: CleanupErrorType.FUNCTION_ERROR,
          message: 'One or more cleanup operations failed',
          details: {
            sessionError: sessionCleanup.error,
            tokenError: tokenCleanup.error
          }
        }
      }
      
      await logCleanupOperation(supabaseClient, result)
      
      return new Response(
        JSON.stringify(result),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const result: CleanupResult = {
      success: true,
      sessionsDeleted: sessionCleanup.count,
      tokensDeleted: tokenCleanup.count,
      duration
    }
    
    await logCleanupOperation(supabaseClient, result)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const duration = Date.now() - startTime
    const result: CleanupResult = {
      success: false,
      duration,
      error: {
        type: CleanupErrorType.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: {
          name: error instanceof Error ? error.name : 'UnknownError',
          stack: error instanceof Error ? error.stack : undefined
        }
      }
    }
    
    console.error('Cleanup operation failed:', error)
    
    return new Response(
      JSON.stringify(result),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
