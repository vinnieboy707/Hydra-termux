# Environment Variables Setup Guide

This guide explains all environment variables required for the Hydra-Termux application.

## Quick Setup

### Backend Setup

1. Navigate to backend directory:
```bash
cd fullstack-app/backend
```

2. Copy the example environment file:
```bash
cp .env.example .env
```

3. Edit `.env` and update the required values (see below for details)

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd fullstack-app/frontend
```

2. Copy the example environment file:
```bash
cp .env.example .env
```

3. Edit `.env` if needed (defaults usually work for development)

---

## Backend Environment Variables

### 🔧 Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port for the backend server |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |

### 🔐 JWT Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ Yes | Secret key for JWT tokens (min 32 characters). **MUST CHANGE IN PRODUCTION** |

**Security Note**: Generate a secure key with:
```bash
openssl rand -base64 32
```

### 💾 Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TYPE` | `sqlite` | Database type: `sqlite` or `postgres` |
| `DB_PATH` | `./database.sqlite` | Path to SQLite database file |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `hydra_termux` | PostgreSQL database name |
| `POSTGRES_USER` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | - | PostgreSQL password. **REQUIRED if using PostgreSQL** |

**Usage**: For development, SQLite is fine. For production, use PostgreSQL.

### ☁️ Supabase Configuration (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | No | Supabase service role key |

**Usage**: Required for advanced features like analytics and credential vault.

### 🗄️ Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_ENABLED` | `true` | Enable/disable Redis |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password (if required) |
| `REDIS_DB` | `0` | Redis database number |

**Usage**: Required for attack queues and caching. Falls back to in-memory if disabled.

### 📧 Email Notifications (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | Enable email notifications |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS/SSL |
| `SMTP_USER` | - | SMTP username |
| `SMTP_PASSWORD` | - | SMTP password (app-specific for Gmail) |
| `SMTP_FROM` | - | From email address |

**Gmail Setup**:
1. Enable 2FA on your Google account
2. Generate an [App Password](https://myaccount.google.com/apppasswords)
3. Use the app password for `SMTP_PASSWORD`

### 🔗 Webhook Notifications (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_NOTIFICATIONS_ENABLED` | `false` | Enable webhook notifications |
| `WEBHOOK_URLS` | - | Comma-separated webhook URLs (Slack, Discord, etc.) |

**Example**:
```
WEBHOOK_URLS=https://hooks.slack.com/services/YOUR/WEBHOOK/URL,https://discord.com/api/webhooks/YOUR/WEBHOOK
```

### ⚡ Attack Orchestration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_ATTACKS` | `3` | Maximum concurrent attacks |
| `ATTACK_TIMEOUT` | `3600000` | Attack timeout in milliseconds (1 hour) |

### 🔒 Encryption

| Variable | Required | Description |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | ✅ Yes | 32-byte hex key for general encryption |
| `CREDENTIAL_ENCRYPTION_KEY` | ✅ Yes | 32-byte hex key for credential encryption |

**Generate secure keys**:
```bash
openssl rand -hex 32
```

### 📁 File Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRIPTS_PATH` | `../../scripts` | Path to attack scripts |
| `LOGS_PATH` | `../../logs` | Path to log files |
| `RESULTS_PATH` | `../../results` | Path to results |
| `WORDLISTS_PATH` | `../../wordlists` | Path to wordlists |
| `CONFIG_PATH` | `../../config/hydra.conf` | Path to config file |
| `EXPORT_DIR` | `./exports` | Path to export directory |

### 📝 Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (`error`, `warn`, `info`, `debug`) |
| `LOG_QUERIES` | `false` | Log database queries |
| `LOG_CACHE` | `false` | Log cache operations |

### 🌐 WebSocket & CORS

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_PORT` | `3000` | WebSocket port |
| `CORS_ORIGIN` | `http://localhost:3001` | CORS allowed origin |

### 🛡️ Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

### 🔑 Session Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | ✅ Yes | Session secret for Express sessions |

---

## Frontend Environment Variables

### 🔌 Port Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Frontend development server port |

### 🔗 Backend API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_URL` | `http://localhost:3000/api` | Backend API URL |
| `REACT_APP_WS_URL` | `ws://localhost:3000` | WebSocket URL |

### 🎚️ Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_ENABLE_EMAIL_IP_ATTACKS` | `true` | Enable Email-IP attacks feature |
| `REACT_APP_ENABLE_SUPREME_COMBOS` | `true` | Enable supreme combo scripts |
| `REACT_APP_ENABLE_ANALYTICS` | `true` | Enable analytics dashboard |
| `REACT_APP_ENABLE_NOTIFICATIONS` | `true` | Enable notifications |

### 🎨 UI Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_THEME` | `dark` | UI theme (`dark`, `light`) |
| `REACT_APP_AUTO_REFRESH_INTERVAL` | `30000` | Auto-refresh interval in ms |

### 🏗️ Build Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GENERATE_SOURCEMAP` | `true` | Generate source maps (set to `false` in production) |

---

## Production Deployment Checklist

### Security

- [ ] Change `JWT_SECRET` to a strong random value (min 32 characters)
- [ ] Change `SESSION_SECRET` to a strong random value
- [ ] Generate secure `ENCRYPTION_KEY` and `CREDENTIAL_ENCRYPTION_KEY`
- [ ] Use PostgreSQL instead of SQLite (`DB_TYPE=postgres`)
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Enable Redis with authentication (`REDIS_PASSWORD`)
- [ ] Set `NODE_ENV=production`
- [ ] Set `GENERATE_SOURCEMAP=false` in frontend

### Optional Services

- [ ] Configure Supabase (if using advanced features)
- [ ] Configure SMTP (if using email notifications)
- [ ] Configure webhooks (if using webhook notifications)

### Paths & CORS

- [ ] Update file paths to production locations
- [ ] Update `CORS_ORIGIN` to your frontend domain
- [ ] Update `REACT_APP_API_URL` to your backend domain

---

## Environment Variable Templates

### Minimal Development Setup (.env)

```bash
# Backend minimal .env
PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-key-change-in-production-minimum-32-chars
DB_TYPE=sqlite
DB_PATH=./database.sqlite
ENCRYPTION_KEY=$(openssl rand -hex 32)
CREDENTIAL_ENCRYPTION_KEY=$(openssl rand -hex 32)
SESSION_SECRET=dev-session-secret-change-in-production
```

### Production Setup (.env)

```bash
# Backend production .env
PORT=3000
NODE_ENV=production
JWT_SECRET=<generated-with-openssl-rand-base64-32>
DB_TYPE=postgres
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=hydra_termux
POSTGRES_USER=hydra_user
POSTGRES_PASSWORD=<strong-password>
ENCRYPTION_KEY=<generated-with-openssl-rand-hex-32>
CREDENTIAL_ENCRYPTION_KEY=<generated-with-openssl-rand-hex-32>
SESSION_SECRET=<generated-with-openssl-rand-base64-32>
REDIS_ENABLED=true
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
CORS_ORIGIN=https://yourdomain.com
```

---

## Troubleshooting

### Common Issues

**Issue**: "JWT_SECRET must be at least 32 characters"
- **Solution**: Generate a secure key: `openssl rand -base64 32`

**Issue**: "Cannot connect to PostgreSQL"
- **Solution**: Check `POSTGRES_*` variables and ensure PostgreSQL is running

**Issue**: "Redis connection failed"
- **Solution**: Set `REDIS_ENABLED=false` or ensure Redis is running

**Issue**: "Email notifications not working"
- **Solution**: Check SMTP settings and use app-specific passwords for Gmail

**Issue**: "CORS errors in browser"
- **Solution**: Update `CORS_ORIGIN` in backend to match frontend URL

---

## Verification

### Backend Health Check

```bash
curl http://localhost:3000/api/system/health
```

Should return:
```json
{
  "status": "ok",
  "environment": "development",
  "uptime": 123.45
}
```

### Frontend Connection Test

Visit `http://localhost:3001` and check browser console for API connection errors.

---

## Security Best Practices

1. **Never commit `.env` files** - They're in `.gitignore` for a reason
2. **Use strong secrets** - Generate with `openssl` commands
3. **Rotate keys regularly** - Especially in production
4. **Use environment-specific configs** - Different keys for dev/staging/prod
5. **Enable HTTPS in production** - Update URLs to use `https://`
6. **Restrict CORS** - Only allow your frontend domain
7. **Use Redis authentication** - Set `REDIS_PASSWORD` in production
8. **Encrypt sensitive data** - Use the encryption keys properly
9. **Monitor access logs** - Enable `LOG_LEVEL=info` or higher
10. **Use PostgreSQL in production** - SQLite is for development only

---

## Support

For issues or questions:
1. Check this guide first
2. Review `.env.example` files
3. Check application logs
4. Open an issue on GitHub
