# Production Environment Configuration Guide

## Complete Environment Variables Setup

This guide covers ALL required and optional environment variables for a complete production deployment of Hydra-Termux.

---

## Backend Environment Variables

Create `/fullstack-app/backend/.env`:

```env
# ============================================================================
# CORE CONFIGURATION
# ============================================================================

# Node Environment
NODE_ENV=production
PORT=3000

# Application URL
APP_URL=https://your-app.com

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# PostgreSQL Direct Connection
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# ============================================================================
# AUTHENTICATION & SECURITY
# ============================================================================

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=your-session-secret-key-min-32-characters
SESSION_MAX_AGE=86400000

# Password Requirements
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================================================
# EMAIL SERVICE (Resend)
# ============================================================================

# Resend API (https://resend.com)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Hydra-Termux <notifications@your-domain.com>

# Email Settings
EMAIL_ENABLED=true
EMAIL_RATE_LIMIT=100

# ============================================================================
# SMS SERVICE (Twilio)
# ============================================================================

# Twilio API (https://twilio.com)
TWILIO_ACCOUNT_SID=AC_your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SMS Settings
SMS_ENABLED=true
SMS_RATE_LIMIT=50

# ============================================================================
# WEBHOOK CONFIGURATION
# ============================================================================

# Webhook Settings
WEBHOOK_TIMEOUT=30000
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RATE_LIMIT=100
WEBHOOK_BATCH_SIZE=5

# ============================================================================
# STORAGE & UPLOADS
# ============================================================================

# File Upload Settings
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=txt,csv,json
UPLOAD_DIR=./uploads

# Wordlist Storage
WORDLIST_DIR=./wordlists
WORDLIST_MAX_SIZE=104857600

# ============================================================================
# MONITORING & LOGGING
# ============================================================================

# Sentry Error Tracking (https://sentry.io)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=1.0

# Log Settings
LOG_LEVEL=info
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=10

# ============================================================================
# REDIS (Optional - for caching)
# ============================================================================

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=false
REDIS_TTL=300

# ============================================================================
# SECURITY HEADERS
# ============================================================================

# CORS Configuration
CORS_ORIGIN=https://your-frontend.com,https://your-domain.com
CORS_CREDENTIALS=true

# CSP Configuration
CSP_ENABLED=true
CSP_DIRECTIVES=default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'

# ============================================================================
# ATTACK CONFIGURATION
# ============================================================================

# Default Attack Settings
DEFAULT_THREADS=16
DEFAULT_TIMEOUT=30
MAX_CONCURRENT_ATTACKS=5

# Attack Limits
MAX_THREADS_PER_ATTACK=64
MAX_TIMEOUT=300
MAX_WORDLIST_SIZE=100000000

# ============================================================================
# FEATURE FLAGS
# ============================================================================

# Feature Toggles
FEATURE_WEBHOOKS_ENABLED=true
FEATURE_NOTIFICATIONS_ENABLED=true
FEATURE_TWO_FACTOR_ENABLED=true
FEATURE_API_KEYS_ENABLED=true
FEATURE_RATE_LIMITING_ENABLED=true

# ============================================================================
# EXTERNAL INTEGRATIONS
# ============================================================================

# Slack Integration (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
SLACK_ENABLED=false

# Discord Integration (Optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your/webhook
DISCORD_ENABLED=false

# ============================================================================
# BACKUP & RECOVERY
# ============================================================================

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_DIR=./backups

# ============================================================================
# PERFORMANCE
# ============================================================================

# Cache Settings
CACHE_ENABLED=true
CACHE_TTL=300
CACHE_MAX_SIZE=1000

# Compression
COMPRESSION_ENABLED=true
COMPRESSION_THRESHOLD=1024

# ============================================================================
# DEVELOPMENT (Not for production!)
# ============================================================================

# Debug Settings
DEBUG=false
VERBOSE_LOGGING=false
```

---

## Edge Functions Environment Variables

Set these via Supabase CLI:

```bash
# Required for all edge functions
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set APP_URL=https://your-app.com

# For send-notification function
supabase secrets set RESEND_API_KEY=re_your_api_key_here
supabase secrets set EMAIL_FROM="Hydra-Termux <notifications@your-domain.com>"
supabase secrets set TWILIO_ACCOUNT_SID=AC_your_account_sid
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set TWILIO_PHONE_NUMBER=+1234567890

# Verify all secrets are set
supabase secrets list
```

---

## Frontend Environment Variables

Create `/fullstack-app/frontend/.env.production`:

```env
# API Configuration
REACT_APP_API_URL=https://api.your-domain.com/api

# Supabase Configuration (for direct client access if needed)
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here

# Feature Flags
REACT_APP_FEATURE_WEBHOOKS=true
REACT_APP_FEATURE_NOTIFICATIONS=true
REACT_APP_FEATURE_TWO_FACTOR=true

# Analytics (Optional)
REACT_APP_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
REACT_APP_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Application Settings
REACT_APP_NAME=Hydra-Termux
REACT_APP_VERSION=2.1.0
REACT_APP_SUPPORT_EMAIL=support@your-domain.com
```

---

## Docker Environment Variables

If using Docker, create `/fullstack-app/docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    env_file:
      - ./frontend/.env.production
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=hydra_termux
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## Environment Variables Validation

Create a validation script `/fullstack-app/backend/scripts/validate-env.js`:

```javascript
const required = [
  'NODE_ENV',
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'JWT_SECRET',
];

const optional = [
  'RESEND_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'SENTRY_DSN',
  'REDIS_URL',
];

console.log('🔍 Validating environment variables...\n');

let hasErrors = false;

// Check required variables
required.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing required variable: ${key}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${key} is set`);
  }
});

// Check optional variables
console.log('\n📋 Optional variables:');
optional.forEach(key => {
  if (!process.env[key]) {
    console.warn(`⚠️  Optional variable not set: ${key}`);
  } else {
    console.log(`✅ ${key} is set`);
  }
});

if (hasErrors) {
  console.error('\n❌ Environment validation failed!');
  process.exit(1);
}

console.log('\n✅ Environment validation passed!');
```

Run validation:
```bash
cd backend
node scripts/validate-env.js
```

---

## Security Best Practices

### 1. Never Commit .env Files
Add to `.gitignore`:
```
.env
.env.local
.env.production
.env.*.local
*.env
```

### 2. Use Strong Secrets
Generate secure secrets:
```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Rotate Secrets Regularly
- JWT secrets: Every 90 days
- API keys: Every 180 days
- Database passwords: Every year

### 4. Use Environment-Specific Files
- `.env.development` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

### 5. Encrypt Sensitive Variables
For CI/CD, use encrypted secrets:
```bash
# GitHub Actions
gh secret set SUPABASE_SERVICE_ROLE_KEY

# GitLab CI
gitlab-ci-lint .gitlab-ci.yml
```

---

## Quick Setup Scripts

### Backend Setup
```bash
#!/bin/bash
cd fullstack-app/backend

# Copy example env
cp .env.example .env

# Generate secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update .env with secrets
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env

echo "✅ Backend environment configured!"
echo "⚠️  Update Supabase credentials in .env"
```

### Edge Functions Setup
```bash
#!/bin/bash
cd fullstack-app

# Set required secrets
read -p "Enter SUPABASE_URL: " SUPABASE_URL
read -p "Enter SUPABASE_SERVICE_ROLE_KEY: " SERVICE_KEY
read -p "Enter APP_URL: " APP_URL

supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"
supabase secrets set APP_URL="$APP_URL"

echo "✅ Edge function secrets configured!"
```

---

## Troubleshooting

### Issue: "Missing environment variable"
**Solution**: Run validation script to identify missing vars
```bash
node scripts/validate-env.js
```

### Issue: "Invalid JWT secret"
**Solution**: Generate a new secret (min 32 characters)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Issue: "Database connection failed"
**Solution**: Check DATABASE_URL format:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

### Issue: "Email/SMS not sending"
**Solution**: Verify service credentials:
```bash
# Test Resend
curl https://api.resend.com/emails \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json"

# Test Twilio
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json" \
  -u "${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}"
```

---

## Production Checklist

- [ ] All required environment variables set
- [ ] Secrets generated with crypto-secure methods
- [ ] .env files added to .gitignore
- [ ] Database connection tested
- [ ] Email service configured and tested
- [ ] SMS service configured (if used)
- [ ] Webhooks configured with valid secrets
- [ ] Rate limiting enabled
- [ ] CORS configured for frontend domain
- [ ] Monitoring/error tracking configured
- [ ] Backups scheduled
- [ ] SSL certificates installed
- [ ] Environment validation passing

---

**Last Updated**: 2025-12-31
**Version**: 2.1.0
