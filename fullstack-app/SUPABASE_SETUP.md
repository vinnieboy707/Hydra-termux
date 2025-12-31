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
