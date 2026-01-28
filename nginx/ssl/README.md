# SSL Certificate Directory

This directory is for SSL certificates used by Nginx.

## For Development/Testing

Generate self-signed certificates:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=localhost"
```

## For Production

Use Let's Encrypt with Certbot:

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Get certificate
certbot certonly --standalone -d your-domain.com

# Link certificates
ln -s /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
ln -s /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

Or manually place your SSL certificate files here:
- `cert.pem` - SSL certificate
- `key.pem` - Private key
