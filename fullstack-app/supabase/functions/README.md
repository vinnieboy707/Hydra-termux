# Supabase Edge Functions

This directory contains Deno-based edge functions for the Hydra-Termux application.

## Functions

### 1. attack-webhook
Triggers webhooks when attacks complete, with HMAC-SHA256 signatures, retry logic, and rate limiting.

### 2. cleanup-sessions  
Removes expired sessions and tokens with comprehensive error handling.

### 3. send-notification
Sends email/SMS notifications with template support and delivery tracking.

## TypeScript Configuration

These functions use **Deno TypeScript**, not Node.js TypeScript. They include:

- `deno.json` - Deno compiler options
- `import_map.json` - Import path mappings
- Triple-slash directives (`/// <reference lib="deno.ns" />`) for Deno types

## Type Checking

To check types with Deno (when available):
```bash
deno check attack-webhook/index.ts
deno check cleanup-sessions/index.ts
deno check send-notification/index.ts
```

**Note:** Standard TypeScript compiler (`tsc`) will show errors because these files use Deno-specific:
- HTTP imports (`https://deno.land/...`)
- Deno global APIs (`Deno.env`)
- Deno standard library

These are **not errors** - the files are designed for Deno runtime, not Node.js.

## Deployment

Deploy using the included script:
```bash
cd ../..
bash deploy-edge-functions.sh
```

Or manually:
```bash
supabase functions deploy attack-webhook
supabase functions deploy cleanup-sessions
supabase functions deploy send-notification
```

## Environment Variables

Set in Supabase Dashboard → Edge Functions:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `RESEND_API_KEY` - For email notifications (send-notification)
- `TWILIO_ACCOUNT_SID` - For SMS (send-notification)
- `TWILIO_AUTH_TOKEN` - For SMS (send-notification)
- `TWILIO_PHONE_NUMBER` - For SMS (send-notification)

## Testing

Test functions locally with Supabase CLI:
```bash
supabase functions serve attack-webhook
```

Then invoke:
```bash
curl -X POST http://localhost:54321/functions/v1/attack-webhook \
  -H "Content-Type: application/json" \
  -d '{"attack_id":1,"event_type":"attack.completed"}'
```

## Documentation

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Manual](https://deno.land/manual)
- [Complete Deployment Guide](../COMPLETE_DEPLOYMENT_GUIDE.md)
