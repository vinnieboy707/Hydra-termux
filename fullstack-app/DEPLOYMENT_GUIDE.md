# 🚀 Complete Implementation & Deployment Guide

## Overview

This guide covers the complete setup of Hydra-Termux Ultimate Edition with bank-grade security, external API integrations, and comprehensive onboarding for penetration testing operations.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Security Setup](#security-setup)
3. [External API Configuration](#external-api-configuration)
4. [Database Setup](#database-setup)
5. [Testing & Validation](#testing--validation)
6. [User Onboarding](#user-onboarding)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd /path/to/Hydra-termux/fullstack-app

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Configure Environment

```bash
cd backend
cp .env.example .env
nano .env
```

**Minimal Configuration** (for local testing):
```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=$(openssl rand -base64 32)
DB_TYPE=sqlite
```

**Production Configuration** (with all features):
```bash
# Server
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
TOTP_ISSUER=Hydra-Termux

# Database (choose one)
# SQLite (development)
DB_TYPE=sqlite
DB_PATH=./database.sqlite

# PostgreSQL (production)
#DB_TYPE=postgres
#POSTGRES_HOST=localhost
#POSTGRES_PORT=5432
#POSTGRES_DB=hydra_termux
#POSTGRES_USER=hydra_user
#POSTGRES_PASSWORD=SecurePassword123!

# External APIs (get keys from respective services)
VIRUSTOTAL_API_KEY=your_key_here
SHODAN_API_KEY=your_key_here
ABUSEIPDB_API_KEY=your_key_here
CENSYS_API_ID=your_id_here
CENSYS_API_SECRET=your_secret_here

# Email Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
SMTP_FROM="Hydra-Termux <noreply@yourdomain.com>"

# Redis (optional, for advanced rate limiting)
#REDIS_HOST=localhost
#REDIS_PORT=6379

# Application
APP_URL=http://localhost:3001
```

### Step 3: Initialize Database

```bash
# SQLite (automatic)
npm start
# Database will be created automatically

# PostgreSQL (manual setup required)
# See POSTGRESQL_SETUP.md for detailed instructions
psql -U postgres
CREATE DATABASE hydra_termux;
CREATE USER hydra_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE hydra_termux TO hydra_user;
\q

# Apply security schema
psql -U hydra_user -d hydra_termux < schema/security-enhancements.sql
```

### Step 4: Start Services

```bash
# Terminal 1: Backend
cd fullstack-app/backend
npm start

# Terminal 2: Frontend
cd fullstack-app/frontend
npm start

# Access:
# Frontend: http://localhost:3001
# Backend API: http://localhost:3000/api
```

---

## 🔐 Security Setup

### 1. Create Admin Account

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "SuperSecure123!@#",
    "email": "admin@yourdomain.com"
  }'
```

### 2. Enable 2FA

```bash
# Login first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SuperSecure123!@#"}' \
  | jq -r '.token')

# Enable 2FA
curl -X POST http://localhost:3000/api/security/2fa/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Scan QR code with Google Authenticator/Authy
# Verify setup
curl -X POST http://localhost:3000/api/security/2fa/verify-setup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token": "123456"}'
```

### 3. Configure IP Whitelist (Optional)

```bash
curl -X POST http://localhost:3000/api/security/ip-whitelist/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ipAddresses": [
      "203.0.113.1",
      "198.51.100.0/24"
    ]
  }'
```

### 4. Set Up Security Alerts

```bash
# Configure email alerts in .env (already done in step 2)
# Test email
curl -X POST http://localhost:3000/api/security/test-alert \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🌐 External API Configuration

### 1. VirusTotal (Malware Scanning)

1. Sign up at https://www.virustotal.com/
2. Go to API Key section
3. Copy API key
4. Add to `.env`: `VIRUSTOTAL_API_KEY=your_key`

**Test:**
```bash
curl -X POST http://localhost:3000/api/security/scan-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://example.com"}'
```

### 2. Shodan (Network Intelligence)

1. Sign up at https://www.shodan.io/
2. Go to Account → API Key
3. Copy API key
4. Add to `.env`: `SHODAN_API_KEY=your_key`

**Test:**
```bash
curl -X GET "http://localhost:3000/api/intelligence/shodan/8.8.8.8" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. AbuseIPDB (IP Reputation)

1. Sign up at https://www.abuseipdb.com/
2. Generate API key
3. Add to `.env`: `ABUSEIPDB_API_KEY=your_key`

**Test:**
```bash
curl -X GET "http://localhost:3000/api/intelligence/ip-reputation/8.8.8.8" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Censys (Certificate & Host Intelligence)

1. Sign up at https://censys.io/
2. Go to Account → API
3. Copy API ID and Secret
4. Add to `.env`:
   ```
   CENSYS_API_ID=your_id
   CENSYS_API_SECRET=your_secret
   ```

**Test:**
```bash
curl -X GET "http://localhost:3000/api/intelligence/censys/8.8.8.8" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Have I Been Pwned (Password Breach Check)

No API key required! Uses k-anonymity model.

**Test:**
```bash
curl -X POST http://localhost:3000/api/security/check-password \
  -H "Content-Type: application/json" \
  -d '{"password": "password123"}'
```

---

## 🗄️ Database Setup

### SQLite (Development - Default)

No setup required! Database is created automatically.

**Location:** `fullstack-app/backend/database.sqlite`

### PostgreSQL (Production - Recommended)

See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for detailed instructions.

**Quick Setup:**
```bash
# 1. Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# 2. Create database
sudo -u postgres psql
CREATE DATABASE hydra_termux;
CREATE USER hydra_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE hydra_termux TO hydra_user;
\q

# 3. Update .env
DB_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=hydra_termux
POSTGRES_USER=hydra_user
POSTGRES_PASSWORD=your_secure_password

# 4. Start backend (schema auto-created)
npm start
```

---

## ✅ Testing & Validation

### 1. Run Validation Script

```bash
cd fullstack-app
bash validate-integration.sh
```

**Expected Output:**
```
✓ Success: 37
✗ Failed:  0
```

### 2. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# Security status
curl http://localhost:3000/api/security/status \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Attack Endpoints

```bash
# Create test target
curl -X POST http://localhost:3000/api/targets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Server",
    "host": "127.0.0.1",
    "description": "Local test"
  }'

# Launch attack
curl -X POST http://localhost:3000/api/attacks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attack_type": "ssh",
    "target_host": "127.0.0.1",
    "protocol": "ssh",
    "config": {"threads": 4}
  }'
```

### 4. Test Webhooks

```bash
# Create webhook
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Webhook",
    "url": "https://webhook.site/your-unique-id",
    "events": ["attack.completed"],
    "description": "Test webhook"
  }'

# Test webhook
curl -X POST "http://localhost:3000/api/webhooks/1/test" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 👥 User Onboarding

### For New Users

1. **Read Documentation:**
   - [ONBOARDING_TUTORIAL.md](ONBOARDING_TUTORIAL.md) - Complete tutorial
   - [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
   - [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) - Security features

2. **Complete Beginner Tutorial:**
   - Set up test environment
   - Run first attack
   - Understand results
   - Export findings

3. **Progress to Intermediate:**
   - Multiple protocols
   - Custom wordlists
   - Webhook notifications
   - Target reconnaissance

4. **Master Advanced Features:**
   - Multi-protocol assessments
   - External API integrations
   - Custom automation
   - Compliance reporting

### For Administrators

1. **Review Security Settings:**
   ```bash
   # Check security status
   curl http://localhost:3000/api/security/metrics \
     -H "Authorization: Bearer $TOKEN"
   ```

2. **Monitor Activity:**
   ```bash
   # View audit log
   curl http://localhost:3000/api/security/audit-log?limit=100 \
     -H "Authorization: Bearer $TOKEN"
   
   # View active sessions
   curl http://localhost:3000/api/security/status \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Manage Users:**
   - Enable 2FA for all users
   - Set IP restrictions
   - Review permissions
   - Monitor compliance

---

## 📊 Monitoring & Maintenance

### Daily Tasks

1. **Check Security Alerts:**
   ```bash
   curl http://localhost:3000/api/security/alerts?resolved=false \
     -H "Authorization: Bearer $TOKEN"
   ```

2. **Monitor Active Attacks:**
   ```bash
   curl http://localhost:3000/api/attacks?status=running \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Review Failed Logins:**
   ```bash
   curl http://localhost:3000/api/security/audit-log?eventType=auth.login_failed \
     -H "Authorization: Bearer $TOKEN"
   ```

### Weekly Tasks

1. **Database Backup:**
   ```bash
   # SQLite
   cp fullstack-app/backend/database.sqlite \
      backups/database-$(date +%Y%m%d).sqlite
   
   # PostgreSQL
   pg_dump -U hydra_user hydra_termux > \
      backups/hydra-$(date +%Y%m%d).sql
   ```

2. **Update System:**
   ```bash
   cd Hydra-termux
   git pull
   cd fullstack-app/backend
   npm install
   cd ../frontend
   npm install
   ```

3. **Review Security Metrics:**
   ```bash
   curl http://localhost:3000/api/security/metrics \
     -H "Authorization: Bearer $TOKEN"
   ```

### Monthly Tasks

1. **Rotate Secrets:**
   ```bash
   # Generate new JWT secret
   openssl rand -base64 32
   # Update .env and restart
   ```

2. **Clean Old Logs:**
   ```bash
   curl -X DELETE http://localhost:3000/api/logs/cleanup \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"daysOld": 90}'
   ```

3. **Review User Access:**
   - Deactivate unused accounts
   - Review permissions
   - Update whitelist

---

## 🔧 Troubleshooting

### Backend Won't Start

```bash
# Check Node version
node --version  # Should be 14+

# Check dependencies
cd fullstack-app/backend
npm install

# Check logs
npm start 2>&1 | tee startup.log
```

### Database Connection Issues

```bash
# SQLite
ls -la fullstack-app/backend/database.sqlite
chmod 664 fullstack-app/backend/database.sqlite

# PostgreSQL
psql -U hydra_user -d hydra_termux -c "SELECT 1;"
```

### External APIs Not Working

```bash
# Test API keys
curl "https://api.shodan.io/api-info?key=YOUR_KEY"
curl "https://www.virustotal.com/api/v3/search?query=test" \
  -H "x-apikey: YOUR_KEY"
```

### Frontend Can't Connect

```bash
# Check backend is running
curl http://localhost:3000/api/health

# Check proxy configuration
cat fullstack-app/frontend/package.json | grep proxy
```

---

## 📚 Additional Resources

- **Onboarding Tutorial:** [ONBOARDING_TUTORIAL.md](ONBOARDING_TUTORIAL.md)
- **API Documentation:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Security Implementation:** [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md)
- **PostgreSQL Setup:** [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)
- **Integration Summary:** [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)

---

## 🎯 Success Criteria

Your installation is successful when:

- ✅ Backend starts without errors
- ✅ Frontend loads at localhost:3001
- ✅ Can login with admin account
- ✅ 2FA is enabled
- ✅ Can launch test attack
- ✅ Results are visible
- ✅ Webhooks deliver notifications
- ✅ External APIs respond (if configured)
- ✅ Security alerts work
- ✅ All validation checks pass

---

## 🚀 Production Deployment Checklist

Before going to production:

- [ ] Change all default passwords
- [ ] Enable 2FA for all admin accounts
- [ ] Configure IP whitelist
- [ ] Set up SSL/TLS (HTTPS)
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Enable all security logging
- [ ] Test disaster recovery
- [ ] Configure monitoring/alerts
- [ ] Review and update API keys
- [ ] Set up log rotation
- [ ] Enable Redis for rate limiting
- [ ] Configure production database (PostgreSQL)
- [ ] Set up reverse proxy (nginx)
- [ ] Enable fail2ban or similar
- [ ] Document incident response procedures

---

**For support, refer to the comprehensive documentation or open an issue on GitHub.**

*Last Updated: December 2024*
*Version: 2.0.0 Ultimate Edition - Bank-Grade Security*
