# Hydra-Termux Production Deployment Guide

This guide covers deploying Hydra-Termux to production using Docker and Docker Compose.

## 🎯 Overview

Hydra-Termux production deployment includes:
- Multi-stage Docker builds for optimized images
- PostgreSQL database with persistent storage
- Redis caching layer
- Nginx reverse proxy with SSL support
- Optional monitoring stack (Prometheus + Grafana)
- Automated backups and health checks

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+ / RHEL 8+
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB minimum (8GB+ recommended)
- **Disk**: 20GB minimum (50GB+ recommended)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### Network Requirements
- Ports 80/443 available for HTTP/HTTPS
- Outbound internet access for updates
- Firewall configured for SSH access

## 🚀 Quick Deployment

### 1. Clone Repository
```bash
git clone https://github.com/vinnieboy707/Hydra-termux.git
cd Hydra-termux
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.production.template .env.production

# Edit with your secure values
nano .env.production
```

**CRITICAL**: Change these values:
- `JWT_SECRET` - Random string (32+ characters)
- `SESSION_SECRET` - Random string (32+ characters)
- `POSTGRES_PASSWORD` - Strong database password
- `REDIS_PASSWORD` - Strong Redis password
- `GRAFANA_PASSWORD` - Grafana admin password

### 3. Create Required Directories
```bash
mkdir -p data/{postgres,backups/postgres,uploads}
mkdir -p logs/{app,access,error,nginx}
mkdir -p nginx/{conf.d,ssl}
mkdir -p monitoring/{prometheus,grafana/provisioning}
mkdir -p config
```

### 4. Configure Nginx

Create `nginx/nginx.conf`:
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss;
    
    include /etc/nginx/conf.d/*.conf;
}
```

Create `nginx/conf.d/hydra.conf`:
```nginx
upstream backend {
    server hydra-app:3000;
}

upstream frontend {
    server hydra-app:3001;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API Proxy
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Frontend Proxy
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. SSL Certificates

#### Option A: Self-Signed (Development/Testing)
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=your-domain.com"
```

#### Option B: Let's Encrypt (Production)
```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot certonly --standalone -d your-domain.com

# Link certificates
ln -s /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
ln -s /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

### 6. Build and Start Services
```bash
# Build images
docker-compose -f docker-compose.production.yml build

# Start services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

### 7. Verify Deployment
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Test health endpoint
curl http://localhost:3000/api/health

# Check all containers
docker ps
```

## 🔧 Configuration Options

### Environment Variables

Edit `.env.production`:

```bash
# Application
NODE_ENV=production
VERSION=1.0.0

# Ports
APP_PORT=3000
HTTP_PORT=80
HTTPS_PORT=443

# Security (CHANGE THESE!)
JWT_SECRET=your-random-32-char-secret
SESSION_SECRET=your-random-32-char-secret
POSTGRES_PASSWORD=secure-password
REDIS_PASSWORD=secure-password

# Database
POSTGRES_USER=hydra
POSTGRES_DB=hydra_db

# Performance
MAX_WORKERS=4
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=15

# Monitoring
ENABLE_MONITORING=true
GRAFANA_PASSWORD=admin-password
```

### Resource Limits

Add to `docker-compose.production.yml`:
```yaml
services:
  hydra-app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 📊 Monitoring (Optional)

### Enable Monitoring Stack
```bash
# Start with monitoring profile
docker-compose -f docker-compose.production.yml \
  --profile monitoring up -d
```

### Access Monitoring Tools
- **Prometheus**: http://your-domain:9090
- **Grafana**: http://your-domain:3002
  - Default login: admin / (GRAFANA_PASSWORD from .env)

### Configure Grafana
1. Log in to Grafana
2. Add Prometheus data source (http://prometheus:9090)
3. Import dashboards:
   - Node Exporter Full (ID: 1860)
   - Docker Container Metrics (ID: 193)

## 🔐 Security Hardening

### 1. Firewall Configuration
```bash
# UFW (Ubuntu)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# iptables
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -j DROP
```

### 2. Container Security
- Containers run as non-root user `hydra` (UID 1000)
- Minimal base images (Alpine Linux)
- No new privileges (`no-new-privileges:true`)
- Read-only root filesystem where possible

### 3. Network Security
- Internal Docker networks for service communication
- Only expose required ports (80, 443)
- Use environment variables for secrets
- Enable SSL/TLS for all external connections

### 4. Regular Updates
```bash
# Update images
docker-compose -f docker-compose.production.yml pull

# Restart with new images
docker-compose -f docker-compose.production.yml up -d

# Remove old images
docker image prune -a
```

## 💾 Backup Strategy

### Database Backups

Create backup script `scripts/backup-database.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/data/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

docker exec hydra-postgres-prod pg_dump -U hydra hydra_db | gzip > "$BACKUP_FILE"

# Keep only last 30 days
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

### Automated Backups (Cron)
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/Hydra-termux/scripts/backup-database.sh >> /var/log/hydra-backup.log 2>&1
```

### Restore from Backup
```bash
# Stop application
docker-compose -f docker-compose.production.yml stop hydra-app

# Restore database
gunzip -c backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i hydra-postgres-prod psql -U hydra hydra_db

# Restart application
docker-compose -f docker-compose.production.yml start hydra-app
```

## 🔄 Updates and Maintenance

### Zero-Downtime Updates
```bash
# Pull latest code
git pull origin main

# Build new images
docker-compose -f docker-compose.production.yml build

# Rolling update (one container at a time)
docker-compose -f docker-compose.production.yml up -d --no-deps --build hydra-app

# Verify
docker-compose -f docker-compose.production.yml ps
docker-compose -f docker-compose.production.yml logs hydra-app
```

### Health Checks
```bash
# Manual health check
curl http://localhost:3000/api/health

# View container health
docker inspect --format='{{.State.Health.Status}}' hydra-termux-prod
```

## 🚨 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs hydra-app

# Check system resources
docker stats

# Verify environment variables
docker-compose -f docker-compose.production.yml config
```

### Database Connection Issues
```bash
# Test database connection
docker exec hydra-postgres-prod psql -U hydra -d hydra_db -c '\l'

# Check database logs
docker-compose -f docker-compose.production.yml logs postgres
```

### High Memory Usage
```bash
# Add memory limits (see Resource Limits section)
# Monitor with docker stats
docker stats --no-stream

# Restart services if needed
docker-compose -f docker-compose.production.yml restart
```

## 📈 Scaling

### Horizontal Scaling
```yaml
services:
  hydra-app:
    deploy:
      replicas: 3
    # Add load balancer configuration
```

### Vertical Scaling
- Increase RAM/CPU allocation
- Optimize database parameters
- Enable Redis caching
- Use CDN for static assets

## 📞 Support

For production deployment issues:
1. Check logs: `docker-compose logs`
2. Review documentation: `/docs`
3. Open GitHub issue with:
   - Environment details
   - Error logs
   - Steps to reproduce

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

---

**⚠️ Security Notice**: This is a penetration testing tool. Ensure compliance with local laws and regulations. Only use on systems you own or have permission to test.
