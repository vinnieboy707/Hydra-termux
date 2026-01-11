# Complete Deployment Guide

## Overview

This guide covers the complete deployment process for Hydra-Termux Full-Stack Application, including:
- Backend API deployment
- Frontend UI deployment  
- Supabase edge functions deployment
- Database setup and migrations
- CI/CD pipeline configuration

---

## Prerequisites

### Required Software
- Node.js 16.x or higher
- npm or yarn
- Git
- PostgreSQL 14+ (if using local database) or Supabase account
- Supabase CLI: `npm install -g supabase`

### Required Accounts
- GitHub account (for CI/CD)
- Supabase account (recommended) or PostgreSQL database
- Hosting provider account (Netlify, Vercel, or your own server)

---

## Part 1: Database Setup

### Option A: Supabase (Recommended)

1. **Create Supabase Project**
   ```bash
   # Go to https://app.supabase.com
   # Create a new project
   # Note your project URL and API keys
   ```

2. **Link Local Project to Supabase**
   ```bash
   cd fullstack-app
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

3. **Apply Database Schema**
   ```bash
   # Automated way:
   bash migrate-database.sh --type supabase
   
   # Manual way:
   supabase db push
   ```

4. **Verify Schema**
   - Go to Supabase Dashboard → Table Editor
   - Verify all 12 tables are created
   - Check Row Level Security policies are enabled

### Option B: Self-Hosted PostgreSQL

1. **Install PostgreSQL**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   ```

2. **Create Database**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE hydra_termux;
   CREATE USER hydra_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE hydra_termux TO hydra_user;
   \q
   ```

3. **Apply Schema**
   ```bash
   bash migrate-database.sh \
     --type postgres \
     --host localhost \
     --user hydra_user \
     --db hydra_termux \
     --password your_secure_password
   ```

---

## Part 2: Backend Deployment

### Local Development

1. **Install Dependencies**
   ```bash
   cd fullstack-app/backend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start Backend**
   ```bash
   npm start
   # Backend runs on http://localhost:3000
   ```

### Production Deployment

#### Option A: Deploy to VPS/Server

1. **Prepare Server**
   ```bash
   # SSH into your server
   ssh user@your-server.com
   
   # Install Node.js and PM2
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install nodejs
   sudo npm install -g pm2
   ```

2. **Clone Repository**
   ```bash
   cd /opt
   sudo git clone https://github.com/vinnieboy707/Hydra-termux.git
   cd Hydra-termux/fullstack-app/backend
   sudo npm install --production
   ```

3. **Configure Environment**
   ```bash
   sudo nano .env
   # Add production settings
   ```

4. **Start with PM2**
   ```bash
   sudo pm2 start server.js --name hydra-backend
   sudo pm2 save
   sudo pm2 startup
   ```

5. **Setup Nginx Reverse Proxy**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/hydra-api
   ```
   
   Add configuration:
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   Enable site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/hydra-api /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

6. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

#### Option B: Deploy to Heroku

1. **Install Heroku CLI**
   ```bash
   curl https://cli-assets.heroku.com/install.sh | sh
   heroku login
   ```

2. **Create Heroku App**
   ```bash
   cd fullstack-app/backend
   heroku create your-app-name
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set JWT_SECRET=your-secret
   heroku config:set DB_TYPE=postgres
   heroku config:set DATABASE_URL=your-database-url
   ```

4. **Deploy**
   ```bash
   git push heroku main
   heroku logs --tail
   ```

---

## Part 3: Frontend Deployment

### Local Development

1. **Install Dependencies**
   ```bash
   cd fullstack-app/frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Set REACT_APP_API_URL to your backend URL
   ```

3. **Start Frontend**
   ```bash
   npm start
   # Opens http://localhost:3001
   ```

### Production Deployment

#### Option A: Netlify

1. **Build Frontend**
   ```bash
   cd fullstack-app/frontend
   npm run build
   ```

2. **Deploy to Netlify**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Login
   netlify login
   
   # Deploy
   netlify deploy --prod --dir=build
   ```

3. **Configure Environment Variables**
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add `REACT_APP_API_URL=https://api.yourdomain.com`

#### Option B: Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd fullstack-app/frontend
   vercel --prod
   ```

3. **Add Environment Variables**
   ```bash
   vercel env add REACT_APP_API_URL production
   ```

#### Option C: Static Server (Nginx)

1. **Build Frontend**
   ```bash
   cd fullstack-app/frontend
   npm run build
   ```

2. **Copy to Server**
   ```bash
   scp -r build/* user@server:/var/www/hydra-frontend/
   ```

3. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       root /var/www/hydra-frontend;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

---

## Part 4: Supabase Edge Functions Deployment

1. **Ensure Logged In**
   ```bash
   cd fullstack-app
   supabase login
   ```

2. **Deploy All Functions**
   ```bash
   # Prerequisites:
   # - Supabase CLI is installed and you have run `supabase login` (see step 1 above).
   # - Any required Supabase project configuration or environment variables for the CLI
   #   are available in your current shell session (see earlier Supabase setup steps).
   bash deploy-edge-functions.sh
   ```

3. **Set Environment Variables**
   - Go to Supabase Dashboard → Edge Functions
   - For each function, set required environment variables:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `RESEND_API_KEY` (for send-notification)
     - `TWILIO_*` (for SMS notifications)

4. **Test Functions**
   ```bash
   # Test attack-webhook
   supabase functions invoke attack-webhook \
     --data '{"attack_id":1,"event_type":"attack.completed"}'
   
   # Test cleanup-sessions
   supabase functions invoke cleanup-sessions
   
   # Test send-notification
   supabase functions invoke send-notification \
     --data '{"user_id":1,"event_type":"attack.completed","data":{}}'
   ```

---

## Part 5: CI/CD Setup (GitHub Actions)

### Prerequisites
- Repository pushed to GitHub
- GitHub Actions enabled

### Configure Secrets

Go to GitHub Repository → Settings → Secrets and variables → Actions

Add the following secrets:

**For Deployment:**
- `DEPLOY_HOST` - Your server hostname
- `DEPLOY_USER` - SSH username
- `DEPLOY_KEY` - SSH private key

**For Supabase:**
- `SUPABASE_ACCESS_TOKEN` - From Supabase dashboard
- `SUPABASE_PROJECT_ID` - Your project reference

**For Frontend:**
- `REACT_APP_API_URL` - Production API URL

**For Notifications (Optional):**
- `SLACK_WEBHOOK_URL` - For deployment notifications

### Workflows Configured

1. **CI Workflow** (`.github/workflows/ci.yml`)
   - Runs on every push and PR
   - Tests Node.js 16, 18, 20
   - Lints code
   - Runs tests
   - Validates SQL schema
   - Checks shell scripts

2. **Security Workflow** (`.github/workflows/security.yml`)
   - CodeQL analysis
   - Dependency vulnerability scanning
   - Secret scanning with TruffleHog
   - SQL injection checks
   - Shell script security checks

3. **Deploy Workflow** (`.github/workflows/deploy.yml`)
   - Deploys on push to main branch
   - Deploys backend to server
   - Deploys frontend to CDN
   - Deploys Supabase edge functions
   - Runs database migrations
   - Creates GitHub releases for tags

### Trigger Deployment

```bash
# Push to main branch to trigger deployment
git checkout main
git merge your-feature-branch
git push origin main

# Or create a release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

---

## Part 6: Post-Deployment Verification

### Health Checks

1. **Backend Health**
   ```bash
   curl https://api.yourdomain.com/api/system/health
   ```

2. **Frontend Access**
   - Open https://yourdomain.com in browser
   - Verify UI loads correctly
   - Test login functionality

3. **Database Connection**
   ```bash
   # Check from backend logs
   pm2 logs hydra-backend
   ```

4. **Edge Functions**
   ```bash
   # View function logs in Supabase dashboard
   # Or use CLI:
   supabase functions logs attack-webhook
   ```

### Performance Testing

```bash
# Test API response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.yourdomain.com/api/system/about

# Load test (using Apache Bench)
ab -n 1000 -c 10 https://api.yourdomain.com/api/system/about
```

### Security Verification

1. **SSL Certificate**
   ```bash
   openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com
   ```

2. **Security Headers**
   ```bash
   curl -I https://api.yourdomain.com
   # Check for: X-Content-Type-Options, X-Frame-Options, etc.
   ```

3. **Rate Limiting**
   ```bash
   # Send multiple rapid requests
   for i in {1..100}; do curl https://api.yourdomain.com/api/system/about; done
   # Should eventually return 429 Too Many Requests
   ```

---

## Part 7: Monitoring and Maintenance

### Setup Monitoring

1. **Backend Monitoring with PM2**
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

2. **Uptime Monitoring**
   - Use services like UptimeRobot, Pingdom, or Better Uptime
   - Monitor: https://api.yourdomain.com/api/system/health

3. **Application Monitoring**
   - Consider: New Relic, Datadog, or Sentry
   - Track errors, performance, user analytics

### Backup Strategy

1. **Database Backups**
   ```bash
   # For PostgreSQL
   pg_dump -h localhost -U hydra_user hydra_termux > backup_$(date +%Y%m%d).sql
   
   # For Supabase - automated in dashboard
   # Settings → Database → Backups
   ```

2. **Automate Backups**
   ```bash
   # Create backup script
   sudo nano /opt/backup-hydra.sh
   ```
   
   ```bash
   #!/bin/bash
   BACKUP_DIR="/opt/backups/hydra"
   mkdir -p $BACKUP_DIR
   pg_dump -h localhost -U hydra_user hydra_termux > $BACKUP_DIR/backup_$(date +%Y%m%d).sql
   # Keep only last 7 days
   find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
   ```
   
   ```bash
   chmod +x /opt/backup-hydra.sh
   # Add to crontab
   (crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup-hydra.sh") | crontab -
   ```

### Update Strategy

1. **Backend Updates**
   ```bash
   cd /opt/Hydra-termux/fullstack-app/backend
   git pull origin main
   npm install --production
   pm2 restart hydra-backend
   ```

2. **Frontend Updates**
   ```bash
   cd fullstack-app/frontend
   npm run build
   netlify deploy --prod --dir=build
   ```

3. **Database Migrations**
   ```bash
   bash migrate-database.sh --type supabase
   ```

---

## Troubleshooting

### Common Issues

1. **Backend won't start**
   ```bash
   # Check logs
   pm2 logs hydra-backend
   
   # Check environment variables
   pm2 env hydra-backend
   
   # Restart
   pm2 restart hydra-backend
   ```

2. **Database connection fails**
   ```bash
   # Test connection manually
   psql -h localhost -U hydra_user -d hydra_termux
   
   # Check .env configuration
   cat .env | grep POSTGRES
   ```

3. **CORS errors in frontend**
   - Verify backend CORS configuration allows frontend domain
   - Check `REACT_APP_API_URL` in frontend .env

4. **Edge functions timing out**
   - Check function logs in Supabase dashboard
   - Verify environment variables are set
   - Increase timeout in function configuration

### Getting Help

- GitHub Issues: https://github.com/vinnieboy707/Hydra-termux/issues
- Documentation: See other .md files in this directory
- Supabase Support: https://supabase.com/support

---

## Next Steps

1. Configure monitoring and alerts
2. Set up automated backups
3. Implement log aggregation
4. Configure CDN for better performance
5. Set up staging environment
6. Implement blue-green deployment strategy

---

## Security Checklist

- [ ] All secrets stored in environment variables, not in code
- [ ] SSL/TLS certificates configured and auto-renewing
- [ ] Database access restricted to backend only
- [ ] Rate limiting configured on all endpoints
- [ ] CORS properly configured
- [ ] Security headers enabled (via Helmet.js)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Regular dependency updates
- [ ] Security scanning in CI/CD
- [ ] Logging and monitoring enabled
- [ ] Backup and recovery plan tested

---

## Performance Optimization

1. **Backend**
   - Enable compression middleware
   - Implement caching (Redis)
   - Use connection pooling
   - Optimize database queries
   - Use CDN for static assets

2. **Frontend**
   - Code splitting
   - Lazy loading
   - Image optimization
   - Minification
   - Service workers for offline support

3. **Database**
   - Create appropriate indexes
   - Optimize slow queries
   - Regular VACUUM (PostgreSQL)
   - Connection pooling
   - Read replicas for scaling

---

For more information, see:
- [API Documentation](./API_DOCUMENTATION.md)
- [Supabase Setup](./SUPABASE_SETUP.md)
- [Security Protocols](./SECURITY_PROTOCOLS.md)
- [Main README](../README.md)
