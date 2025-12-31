# Supabase Setup Guide for Hydra-Termux

## Prerequisites

- Supabase account
- Supabase CLI installed: `npm install -g supabase`
- PostgreSQL client (for local testing)

## Quick Setup

### 1. Initialize Supabase Project

```bash
cd fullstack-app
supabase init
supabase login
```

### 2. Link to Your Supabase Project

```bash
supabase link --project-ref your-project-ref
```

### 3. Apply Database Schema

```bash
# Apply the complete schema
supabase db push

# Or manually apply via SQL editor in Supabase dashboard:
# Copy contents of backend/schema/complete-database-schema.sql
```

### 4. Setup Environment Variables

Create `.env` file in backend/:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres

# JWT
JWT_SECRET=your-jwt-secret-from-supabase

# Application
NODE_ENV=production
PORT=3000
```

## Database Schema

### Tables

The complete schema includes:

1. **users** - User authentication and authorization
2. **targets** - Target systems for attacks
3. **wordlists** - Password/username lists
4. **attacks** - Attack execution and status
5. **results** - Discovered credentials
6. **logs** - System and attack logs
7. **webhooks** - Event notification configuration
8. **webhook_logs** - Webhook delivery tracking
9. **sessions** - Session management
10. **refresh_tokens** - Token refresh
11. **attack_optimizations** - Optimization tracking
12. **protocol_statistics** - Protocol analytics

### Functions

- `update_updated_at_column()` - Auto-update timestamps
- `cleanup_expired_sessions()` - Session maintenance
- `cleanup_expired_refresh_tokens()` - Token cleanup
- `update_protocol_statistics()` - Real-time stats

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- Users see only their own data
- Admins have elevated access
- Super admins see everything

## Edge Functions

### Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy attack-webhook
supabase functions deploy cleanup-sessions
supabase functions deploy send-notification
```

### Test Edge Functions

```bash
# Test locally
supabase functions serve

# Test specific function
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/attack-webhook' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"attack_id":1}'
```

## Webhooks Configuration

### Creating Webhooks via API

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Attack Completion Webhook",
    "url": "https://your-server.com/webhook",
    "events": ["attack.completed", "credentials.found"]
  }'
```

### Webhook Events

Available events:
- `attack.queued` - Attack added to queue
- `attack.started` - Attack execution started
- `attack.completed` - Attack finished
- `attack.failed` - Attack failed
- `credentials.found` - New credentials discovered
- `target.added` - New target added
- `wordlist.uploaded` - New wordlist available

### Webhook Payload Example

```json
{
  "event": "attack.completed",
  "timestamp": "2025-12-31T21:00:00Z",
  "data": {
    "attack_id": 123,
    "protocol": "ssh",
    "host": "192.168.1.100",
    "port": 22,
    "status": "completed",
    "credentials_found": 3,
    "duration_seconds": 145
  },
  "signature": "sha256=..."
}
```

### Verifying Webhook Signatures

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```

## Database Migrations

### Creating New Migration

```bash
supabase migration new your_migration_name
```

### Apply Migrations

```bash
# Local
supabase db reset

# Production
supabase db push
```

## Scheduled Functions

Setup cron jobs in Supabase dashboard:

### Cleanup Expired Sessions (Every Hour)

```sql
SELECT cron.schedule(
  'cleanup-sessions',
  '0 * * * *', 
  $$SELECT cleanup_expired_sessions()$$
);
```

### Cleanup Expired Tokens (Every Day)

```sql
SELECT cron.schedule(
  'cleanup-tokens',
  '0 0 * * *',
  $$SELECT cleanup_expired_refresh_tokens()$$
);
```

### Update Statistics (Every 5 Minutes)

```sql
SELECT cron.schedule(
  'update-stats',
  '*/5 * * * *',
  $$
  UPDATE protocol_statistics SET updated_at = CURRENT_TIMESTAMP
  WHERE last_attack_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
  $$
);
```

## Security Configuration

### Enable RLS Policies

```sql
-- Run in Supabase SQL editor
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
-- ... etc for all tables
```

### API Rate Limiting

Configure in Supabase dashboard:
- Authentication: 100 requests/minute
- API: 1000 requests/minute
- Database: 500 requests/minute

## Monitoring

### Enable Logs

In Supabase dashboard:
1. Go to Logs
2. Enable API logs
3. Enable Postgres logs
4. Enable Function logs

### Setup Alerts

Configure alerts for:
- Failed authentication attempts
- High database load
- Webhook failures
- Error rates

## Backup & Recovery

### Automated Backups

Supabase provides:
- Daily automated backups
- Point-in-time recovery
- 7-day retention (free tier)
- 30-day retention (pro tier)

### Manual Backup

```bash
# Export database
supabase db dump > backup.sql

# Import database
supabase db reset --db-url "postgresql://..."
psql -f backup.sql
```

## Performance Optimization

### Indexes

All tables have appropriate indexes (see schema):
- Primary keys
- Foreign keys
- Search columns
- Timestamp columns

### Connection Pooling

Configure in `.env`:

```env
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_IDLE_TIMEOUT=30000
```

### Query Optimization

Use views for complex queries:
- `attack_summary` - Pre-joined attack data
- `user_statistics` - Aggregated user stats

## Troubleshooting

### Cannot Connect to Database

```bash
# Check connection
supabase status

# Reset connection
supabase stop
supabase start
```

### RLS Blocking Queries

```sql
-- Disable RLS temporarily (development only!)
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';
```

### Edge Function Errors

```bash
# Check logs
supabase functions logs attack-webhook

# Deploy with logs
supabase functions deploy attack-webhook --debug
```

## Production Checklist

- [ ] Database schema applied
- [ ] RLS policies enabled
- [ ] Environment variables configured
- [ ] Edge functions deployed
- [ ] Webhooks tested
- [ ] Backups configured
- [ ] Monitoring enabled
- [ ] Rate limiting configured
- [ ] SSL certificates valid
- [ ] Security audit passed

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

## Support

For issues:
1. Check Supabase status: https://status.supabase.com/
2. Review logs in Supabase dashboard
3. Open issue on GitHub
4. Contact Supabase support

---

## API Response Examples

### Webhook Creation Response

```json
{
  "message": "Webhook created successfully",
  "webhookId": 42,
  "secret": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
}
```

**IMPORTANT**: Save the secret immediately - it's only shown once!

### Webhook Payload Example

```json
{
  "event": "attack.completed",
  "timestamp": "2025-12-31T21:00:00.000Z",
  "webhook_id": 42,
  "data": {
    "attack_id": 123,
    "protocol": "ssh",
    "host": "192.168.1.100",
    "port": 22,
    "status": "completed",
    "credentials_found": 3,
    "duration_seconds": 145
  }
}
```

### Webhook Signature Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook endpoint:
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  if (!verifyWebhookSignature(payload, signature, YOUR_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook...
  res.json({ received: true });
});
```

### Webhook Signature Verification (Python)

```python
import hmac
import hashlib
import json

def verify_webhook_signature(payload, signature, secret):
    expected_signature = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

# In your webhook endpoint:
@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.json
    
    if not verify_webhook_signature(payload, signature, YOUR_SECRET):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process webhook...
    return jsonify({'received': True})
```

### Attack Creation API Example

```bash
curl -X POST https://your-api.com/api/attacks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_id": 5,
    "protocol": "ssh",
    "host": "192.168.1.100",
    "port": 22,
    "wordlist_id": 3,
    "threads": 16,
    "timeout": 30
  }'
```

**Response:**
```json
{
  "message": "Attack queued successfully",
  "attackId": 123,
  "status": "queued",
  "estimatedDuration": 180
}
```

### Results Query API Example

```bash
curl -X GET 'https://your-api.com/api/results?attack_id=123' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "results": [
    {
      "id": 456,
      "attack_id": 123,
      "protocol": "ssh",
      "host": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "password": "password123",
      "is_verified": true,
      "created_at": "2025-12-31T21:15:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "perPage": 50
}
```

---

## Edge Function Deployment Troubleshooting

### Common Issues and Solutions

#### 1. Function Not Deploying

**Error**: `Failed to deploy function`

**Solutions**:
- Check Supabase CLI version: `supabase --version`
- Update CLI: `npm install -g supabase@latest`
- Verify you're logged in: `supabase login`
- Check project link: `supabase link --project-ref YOUR_REF`

#### 2. Environment Variables Not Set

**Error**: `Missing required environment variables`

**Solutions**:
```bash
# Set environment variables for edge function
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
supabase secrets set APP_URL=https://your-app.com

# Verify secrets
supabase secrets list
```

#### 3. CORS Issues

**Error**: `CORS policy blocking requests`

**Solution**: Ensure corsHeaders are properly set in edge function:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Always handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}
```

#### 4. Function Timeout

**Error**: `Function execution timed out`

**Solutions**:
- Optimize database queries
- Use batch processing for multiple operations
- Implement pagination for large datasets
- Consider moving long-running tasks to background jobs

#### 5. Rate Limit Errors

**Error**: `Rate limit exceeded`

**Solutions**:
- Implement proper rate limiting in your edge function
- Use caching for frequently accessed data
- Consider upgrading Supabase plan for higher limits

### Debug Edge Functions Locally

```bash
# Serve edge functions locally
supabase functions serve

# Test function locally
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/attack-webhook' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "attack_id": 123,
    "event_type": "attack.completed"
  }'

# View logs
supabase functions logs attack-webhook
```

### Monitor Edge Functions

```bash
# View recent logs
supabase functions logs attack-webhook --tail

# View logs with filter
supabase functions logs attack-webhook --filter "error"

# View specific time range
supabase functions logs attack-webhook --since "1h ago"
```

---

## Performance Optimization

### Database Indexes

Ensure proper indexes are created (included in schema):

```sql
-- Attack lookups
CREATE INDEX idx_attacks_user_id ON attacks(user_id);
CREATE INDEX idx_attacks_status ON attacks(status);
CREATE INDEX idx_attacks_created_at ON attacks(created_at);

-- Result searches
CREATE INDEX idx_results_attack_id ON results(attack_id);
CREATE INDEX idx_results_host ON results(host);
CREATE INDEX idx_results_created_at ON results(created_at);

-- Webhook queries
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);
```

### Connection Pooling

Configure connection pooling in backend:

```javascript
// database-pg.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching Strategy

Implement caching for protocol statistics:

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

router.get('/dashboard/protocols', async (req, res) => {
  const cacheKey = 'protocol_stats';
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return res.json(cached);
  }
  
  const stats = await fetchProtocolStatistics();
  cache.set(cacheKey, stats);
  
  res.json(stats);
});
```

---

## Security Best Practices

### 1. Rate Limiting

Implement rate limiting on all endpoints:

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/api/', apiLimiter);
```

### 2. Input Validation

Always validate and sanitize inputs:

```javascript
const { body, validationResult } = require('express-validator');

router.post('/webhooks',
  body('url').isURL().withMessage('Must be a valid URL'),
  body('name').isLength({ min: 3, max: 100 }),
  body('events').isArray({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process request...
  }
);
```

### 3. HTTPS Only

Enforce HTTPS for all webhook URLs:

```javascript
function validateWebhookUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URLs must use HTTPS');
  }
  return true;
}
```

### 4. IP Whitelisting (Optional)

For additional security, implement IP whitelisting:

```sql
-- Add to webhooks table
ALTER TABLE webhooks ADD COLUMN allowed_ips TEXT[];

-- In webhook validation
CREATE OR REPLACE FUNCTION is_ip_allowed(webhook_id INT, source_ip INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM webhooks 
    WHERE id = webhook_id 
    AND (
      allowed_ips IS NULL 
      OR source_ip <<= ANY(allowed_ips::inet[])
    )
  );
END;
$$ LANGUAGE plpgsql;
```

---

## Testing Guide

### Unit Tests for Edge Functions

Create `attack-webhook.test.ts`:

```typescript
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

Deno.test('webhook signature generation', async () => {
  const payload = { test: 'data' }
  const secret = 'test-secret'
  
  const signature = await generateHmacSignature(
    JSON.stringify(payload),
    secret
  )
  
  assertEquals(signature.startsWith('sha256='), false)
  assertEquals(signature.length, 64) // SHA-256 hex length
})

Deno.test('rate limiting', () => {
  const userId = 'test-user'
  
  // First request should succeed
  const result1 = checkRateLimit(userId)
  assertEquals(result1.allowed, true)
  
  // After max requests, should fail
  for (let i = 0; i < 100; i++) {
    checkRateLimit(userId)
  }
  
  const result2 = checkRateLimit(userId)
  assertEquals(result2.allowed, false)
})
```

### Integration Tests

Create `integration.test.js`:

```javascript
const request = require('supertest');
const app = require('../server');

describe('Webhook API', () => {
  let token;
  let webhookId;
  
  beforeAll(async () => {
    // Login and get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'test123' });
    token = response.body.token;
  });
  
  test('Create webhook', async () => {
    const response = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['attack.completed']
      });
    
    expect(response.status).toBe(201);
    expect(response.body.webhookId).toBeDefined();
    webhookId = response.body.webhookId;
  });
  
  test('Get webhooks', async () => {
    const response = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.webhooks).toBeInstanceOf(Array);
  });
  
  test('Test webhook', async () => {
    const response = await request(app)
      .post(`/api/webhooks/${webhookId}/test`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });
});
```

---

## Monitoring and Alerts

### Setup Monitoring

```bash
# Install monitoring dependencies
npm install @sentry/node @sentry/tracing

# Configure in server.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Health Check Endpoint

```javascript
router.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'healthy',
    checks: {
      database: 'checking...',
      supabase: 'checking...'
    }
  };
  
  try {
    // Check database
    await pool.query('SELECT 1');
    health.checks.database = 'healthy';
  } catch (error) {
    health.checks.database = 'unhealthy';
    health.status = 'degraded';
  }
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

---

## Production Deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] Edge functions deployed
- [ ] Webhooks tested
- [ ] SSL certificates valid
- [ ] Rate limiting enabled
- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Load testing completed
- [ ] Error tracking configured
- [ ] Log retention policy set
- [ ] Disaster recovery plan documented

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/current/tutorial.html)
- [Webhook Security Guide](https://webhooks.fyi)
- [API Rate Limiting](https://www.npmjs.com/package/express-rate-limit)

---

## Support

For issues or questions:

1. Check the [Troubleshooting Guide](#edge-function-deployment-troubleshooting)
2. Review [API Examples](#api-response-examples)
3. Check Supabase status: https://status.supabase.com/
4. Open GitHub issue with:
   - Error logs
   - Environment details
   - Steps to reproduce
   - Expected vs actual behavior

---

**Last Updated**: 2025-12-31
**Version**: 2.1.0
**Status**: Production Ready ✅
