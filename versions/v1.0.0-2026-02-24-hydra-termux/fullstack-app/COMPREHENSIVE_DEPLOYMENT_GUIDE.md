# Comprehensive Deployment Guide
## Supabase + PostgreSQL + Edge Functions + Docker + Webhooks + Points System

This guide provides complete instructions for deploying the Hydra-Termux system with all components.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Setup](#environment-setup)
4. [Database Deployment](#database-deployment)
5. [Edge Functions Deployment](#edge-functions-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Workflow Configuration](#workflow-configuration)
8. [Testing & Validation](#testing--validation)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- Node.js 18.x or higher
- Docker & Docker Compose
- Supabase CLI: `npm install -g supabase`
- PostgreSQL client tools
- Git

### Supabase Account
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Note your project details:
   - Project Reference ID
   - Database Password
   - API URL
   - Anon Key
   - Service Role Key

---

## Quick Start

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/vinnieboy707/Hydra-termux.git
cd Hydra-termux

# Create environment file
cp fullstack-app/backend/.env.example fullstack-app/backend/.env

# Edit with your values
nano fullstack-app/backend/.env
```

### 2. Deploy Everything

```bash
# Deploy database schema
cd fullstack-app
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

# Deploy edge functions
./deploy-edge-functions.sh

# Start Docker stack
cd ..
docker-compose -f docker-compose-full-stack.yml up -d

# Verify deployment
curl http://localhost:4000/api/health
```

---

## Environment Setup

### Local Development (.env)

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_database_password
POSTGRES_DB=hydra_db
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/hydra_db

# Redis
REDIS_PASSWORD=your_secure_redis_password
REDIS_URL=redis://:your_redis_password@localhost:6379

# JWT & Security
JWT_SECRET=your_random_32_char_string
SESSION_SECRET=your_random_32_char_string

# Application
NODE_ENV=development
PORT=4000
FRONTEND_PORT=3002
BACKEND_PORT=4000

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3003
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin_password
```

### Production Environment

```env
# Production-specific overrides
NODE_ENV=production
SUPABASE_URL=https://your-prod-project.supabase.co
DATABASE_URL=postgresql://postgres:strong_password@your-prod-db:5432/hydra_db

# Enable monitoring
ENABLE_METRICS=true
SENTRY_DSN=your_sentry_dsn
```

### GitHub Secrets Configuration

For CI/CD workflows, configure these secrets in GitHub:

```
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_PASSWORD
JWT_SECRET
SESSION_SECRET
```

---

## Database Deployment

### Schema Files

Located in `fullstack-app/backend/schema/`:
- `points-system-schema.sql` - Main points system (NEW)
- `complete-database-schema.sql` - Core tables
- `supreme-features-schema.sql` - Additional features
- `security-enhancements.sql` - Security policies
- `optimization-enhancements.sql` - Performance tuning

### Deployment Methods

#### Method 1: Supabase CLI (Recommended)

```bash
cd fullstack-app

# Link to project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push

# Verify deployment
supabase db remote status
```

#### Method 2: Direct SQL Execution

```bash
# Connect to database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Execute schema files
\i backend/schema/points-system-schema.sql
\i backend/schema/complete-database-schema.sql

# Verify tables
\dt
```

#### Method 3: Migration Script

```bash
cd fullstack-app
chmod +x migrate-database.sh
./migrate-database.sh
```

### Post-Deployment Verification

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify user_points table
SELECT * FROM user_points LIMIT 1;

-- Check materialized views
SELECT * FROM mv_leaderboard_alltime LIMIT 10;

-- Test point award function
SELECT award_points(1, 'daily_login', 'login', NULL, '{}');
```

---

## Edge Functions Deployment

### Available Edge Functions

1. **points-manager** - Points & achievements management
2. **leaderboard-manager** - Leaderboard operations
3. **webhook-delivery-manager** - Webhook processing
4. **attack-webhook** - Attack event notifications
5. **cleanup-sessions** - Session maintenance
6. **send-notification** - Push notifications

### Deploy Individual Function

```bash
cd fullstack-app

# Deploy single function
supabase functions deploy points-manager \
  --project-ref YOUR_PROJECT_REF

# View logs
supabase functions logs points-manager
```

### Deploy All Functions

```bash
# Using deployment script
chmod +x deploy-edge-functions.sh
./deploy-edge-functions.sh
```

### Set Environment Variables

```bash
# Set secrets for edge functions
supabase secrets set \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" \
  APP_URL="https://your-app.com"

# Verify secrets
supabase secrets list
```

### Test Edge Functions

```bash
# Test points-manager
curl -i -X POST \
  "https://your-project.supabase.co/functions/v1/points-manager?action=balance" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1}'

# Expected response
{
  "success": true,
  "current_balance": 0,
  "total_points_earned": 0,
  "streak_days": 0
}
```

---

## Docker Deployment

### Full Stack Deployment

```bash
# Start all services
docker-compose -f docker-compose-full-stack.yml up -d

# View logs
docker-compose -f docker-compose-full-stack.yml logs -f

# Check service health
docker-compose -f docker-compose-full-stack.yml ps
```

### Services Overview

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3002 | React application |
| Backend | 4000 | Node.js API server |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & sessions |
| Supabase Studio | 3000 | Database management |
| PostgREST | 3001 | Auto-generated API |
| Nginx | 80/443 | Reverse proxy |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3003 | Dashboards |
| Adminer | 8080 | DB admin UI |
| Redis Insight | 8001 | Redis admin UI |

### Service Management

```bash
# Stop all services
docker-compose -f docker-compose-full-stack.yml stop

# Restart specific service
docker-compose -f docker-compose-full-stack.yml restart backend

# View service logs
docker-compose -f docker-compose-full-stack.yml logs -f backend

# Rebuild and restart
docker-compose -f docker-compose-full-stack.yml up -d --build backend
```

### Volume Management

```bash
# List volumes
docker volume ls | grep hydra

# Backup database
docker exec hydra-postgres pg_dump -U postgres hydra_db > backup.sql

# Restore database
cat backup.sql | docker exec -i hydra-postgres psql -U postgres hydra_db

# Clean up volumes (⚠️ DATA LOSS)
docker-compose -f docker-compose-full-stack.yml down -v
```

---

## Workflow Configuration

### GitHub Actions Setup

Workflows are automatically triggered on:
- Push to `main` or `develop` branches
- Changes to Supabase files
- Manual workflow dispatch

### Configure Required Secrets

In GitHub repo settings → Secrets and variables → Actions:

```
SUPABASE_ACCESS_TOKEN - From Supabase dashboard
SUPABASE_PROJECT_ID - Your project reference ID
SUPABASE_URL - Your project URL
SUPABASE_ANON_KEY - From project settings
SUPABASE_SERVICE_ROLE_KEY - From project settings
SUPABASE_DB_PASSWORD - Database password
JWT_SECRET - Random string (32+ chars)
SESSION_SECRET - Random string (32+ chars)
APP_URL - Your application URL
```

### Manual Workflow Trigger

```bash
# Using GitHub CLI
gh workflow run supabase-deploy.yml \
  -f deploy_edge_functions=true \
  -f run_migrations=true \
  -f refresh_views=true

# Via GitHub UI
# Go to Actions → Supabase Comprehensive Deployment → Run workflow
```

### Monitoring Workflow Status

```bash
# List workflow runs
gh run list --workflow=supabase-deploy.yml

# View specific run
gh run view RUN_ID

# Download artifacts
gh run download RUN_ID
```

---

## Testing & Validation

### Database Tests

```sql
-- Test point awarding
SELECT award_points(1, 'attack_completed', 'attack', 123, '{}');

-- Verify balance
SELECT * FROM user_points WHERE user_id = 1;

-- Check transactions
SELECT * FROM point_transactions WHERE user_id = 1 ORDER BY created_at DESC;

-- Test achievements
SELECT check_achievements(1);

-- View leaderboard
SELECT * FROM mv_leaderboard_alltime LIMIT 10;
```

### Edge Function Tests

```bash
# Test points manager
curl -X POST "YOUR_SUPABASE_URL/functions/v1/points-manager?action=award" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "action": "attack_completed",
    "reference_type": "attack",
    "reference_id": 123
  }'

# Test leaderboard
curl "YOUR_SUPABASE_URL/functions/v1/points-manager?action=leaderboard&type=all_time&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Integration Tests

```bash
cd fullstack-app/backend

# Run test suite
npm test

# Run specific tests
npm test -- --grep "points"
npm test -- --grep "webhooks"
npm test -- --grep "leaderboard"
```

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test points endpoint
ab -n 1000 -c 10 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -p test-payload.json \
  YOUR_SUPABASE_URL/functions/v1/points-manager?action=balance
```

---

## Monitoring & Maintenance

### Prometheus Metrics

Access: `http://localhost:9090`

Key metrics to monitor:
- `http_requests_total` - Request count
- `http_request_duration_seconds` - Response time
- `postgres_connections` - Database connections
- `redis_memory_usage_bytes` - Redis memory
- `points_awarded_total` - Points distribution
- `webhook_delivery_duration` - Webhook latency

### Grafana Dashboards

Access: `http://localhost:3003` (admin/admin)

Pre-configured dashboards:
1. **System Overview** - All services health
2. **Database Performance** - PostgreSQL metrics
3. **API Performance** - Request/response times
4. **Points System** - Transaction rates, leaderboards
5. **Webhooks** - Delivery success rates

### Scheduled Maintenance

```bash
# Refresh materialized views (manual)
psql -c "SELECT refresh_leaderboards();"

# Cleanup old sessions (manual)
psql -c "SELECT cleanup_expired_sessions();"

# Vacuum database
psql -c "VACUUM ANALYZE;"

# Backup database
pg_dump hydra_db > backup_$(date +%Y%m%d).sql
```

### Log Management

```bash
# View backend logs
docker logs hydra-backend --tail=100 -f

# View Postgres logs
docker logs hydra-postgres --tail=100 -f

# View edge function logs
supabase functions logs points-manager --tail

# Export logs
docker logs hydra-backend > backend_logs.txt
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection from container
docker exec hydra-backend psql $DATABASE_URL -c "SELECT 1;"

# Verify credentials
echo $DATABASE_URL
```

#### Edge Function Errors

```bash
# Check function logs
supabase functions logs points-manager

# Test locally
supabase functions serve
curl http://localhost:54321/functions/v1/points-manager?action=balance

# Redeploy function
supabase functions deploy points-manager --debug
```

#### Points Not Awarding

```sql
-- Check point_rewards table
SELECT * FROM point_rewards WHERE action = 'attack_completed';

-- Verify user exists
SELECT * FROM user_points WHERE user_id = 1;

-- Check recent transactions
SELECT * FROM point_transactions 
WHERE user_id = 1 
ORDER BY created_at DESC 
LIMIT 10;

-- Test award function
SELECT award_points(1, 'attack_completed', 'attack', 123, '{}');
```

#### Webhook Not Delivering

```sql
-- Check webhook configuration
SELECT * FROM webhooks WHERE user_id = 1 AND enabled = TRUE;

-- View pending deliveries
SELECT * FROM webhook_events_extended 
WHERE delivery_status = 'pending' 
ORDER BY created_at DESC;

-- Check failed deliveries
SELECT * FROM webhook_events_extended 
WHERE delivery_status = 'failed' 
ORDER BY created_at DESC;
```

#### Leaderboard Not Updating

```bash
# Manually refresh
psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_alltime;"
psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_monthly;"

# Check cron job
psql -c "SELECT * FROM cron.job WHERE jobname = 'refresh-leaderboards';"

# Enable if missing
psql -c "
  SELECT cron.schedule(
    'refresh-leaderboards',
    '*/5 * * * *',
    \$\$SELECT refresh_leaderboards();\$\$
  );
"
```

---

## Performance Tuning

### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM user_points ORDER BY total_points_earned DESC LIMIT 100;

-- Update statistics
ANALYZE user_points;
ANALYZE point_transactions;

-- Reindex tables
REINDEX TABLE user_points;
REINDEX TABLE point_transactions;
```

### Redis Configuration

```bash
# Check memory usage
docker exec hydra-redis redis-cli -a $REDIS_PASSWORD INFO memory

# Configure eviction policy
docker exec hydra-redis redis-cli -a $REDIS_PASSWORD CONFIG SET maxmemory-policy allkeys-lru

# Monitor commands
docker exec hydra-redis redis-cli -a $REDIS_PASSWORD MONITOR
```

### Edge Function Optimization

- Use connection pooling
- Cache frequently accessed data
- Implement rate limiting
- Use materialized views
- Batch database operations

---

## Security Checklist

- [ ] All secrets stored in environment variables
- [ ] Database RLS policies enabled
- [ ] JWT tokens properly validated
- [ ] Webhook signatures verified
- [ ] Rate limiting implemented
- [ ] HTTPS enforced in production
- [ ] Database backups automated
- [ ] Monitoring alerts configured
- [ ] Audit logging enabled
- [ ] Security headers configured

---

## Support & Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Docker Docs](https://docs.docker.com/)

### Tools
- Supabase Dashboard: `https://app.supabase.com`
- Local Studio: `http://localhost:3000`
- Adminer: `http://localhost:8080`
- Grafana: `http://localhost:3003`

### Getting Help
1. Check logs first
2. Review error messages
3. Consult documentation
4. Open GitHub issue with:
   - Environment details
   - Error logs
   - Steps to reproduce
   - Expected vs actual behavior

---

**Last Updated**: 2025-01-28  
**Version**: 3.0.0  
**Status**: Production Ready ✅
