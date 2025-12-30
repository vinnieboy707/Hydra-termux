# 🔐 Bank-Grade Security Implementation Guide

## Overview

This document details the enhanced security features and external API integrations that transform Hydra-Termux into a bank-grade penetration testing platform.

---

## 🛡️ Core Security Features

### 1. Two-Factor Authentication (2FA)

**Implementation**: TOTP (Time-based One-Time Password) using industry-standard algorithms

**Setup**:
```bash
# Enable 2FA
curl -X POST http://localhost:3000/api/security/2fa/enable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Response includes QR code and backup codes
```

**Supported Authenticator Apps**:
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- LastPass Authenticator

### 2. IP Whitelist

**Purpose**: Restrict access to specific IP addresses

```bash
# Enable IP whitelist
curl -X POST http://localhost:3000/api/security/ip-whitelist/enable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ipAddresses": [
      "203.0.113.1",
      "198.51.100.0/24",
      "2001:db8::1"
    ]
  }'
```

### 3. Session Management

**Features**:
- Per-device session tracking
- IP address and User-Agent logging
- Manual session termination
- Automatic session expiration

```bash
# View active sessions
curl -X GET http://localhost:3000/api/security/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Terminate specific session
curl -X DELETE http://localhost:3000/api/security/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Terminate all other sessions
curl -X POST http://localhost:3000/api/security/sessions/terminate-all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Security Audit Logging

**All security events are logged**:
- Login attempts (success/failure)
- 2FA enable/disable
- Password changes
- Session terminations
- IP whitelist changes
- Administrative actions

```bash
# View audit log
curl -X GET http://localhost:3000/api/security/audit-log?limit=100 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Strong Password Requirements

**Enforced Requirements**:
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Cannot be common/compromised password

### 6. Account Lockout Protection

**Features**:
- Automatic lockout after 5 failed attempts
- Exponential backoff (15 min, 30 min, 1 hour)
- Admin unlock capability
- Notification on suspicious activity

---

## 🌐 External API Integrations

### Integration 1: Have I Been Pwned API

**Purpose**: Check if passwords/emails have been compromised in data breaches

**Setup**:
```javascript
// backend/services/hibpService.js
const axios = require('axios');
const crypto = require('crypto');

async function checkPasswordCompromised(password) {
  // SHA-1 hash of password
  const hash = crypto.createHash('sha1')
    .update(password)
    .digest('hex')
    .toUpperCase();
  
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);
  
  try {
    const response = await axios.get(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          'Add-Padding': 'true',
          'User-Agent': 'Hydra-Termux-Security-Check'
        }
      }
    );
    
    const hashes = response.data.split('\n');
    const found = hashes.find(line => line.startsWith(suffix));
    
    if (found) {
      const count = parseInt(found.split(':')[1]);
      return { compromised: true, count };
    }
    
    return { compromised: false };
  } catch (error) {
    console.error('Error checking HIBP:', error);
    return { error: 'Unable to check password' };
  }
}

module.exports = { checkPasswordCompromised };
```

**Usage**:
```bash
# Check password before setting
curl -X POST http://localhost:3000/api/security/check-password \
  -H "Content-Type: application/json" \
  -d '{"password": "test123"}'
```

### Integration 2: VirusTotal API

**Purpose**: Scan discovered files/URLs for malware

**Setup**:
```javascript
// backend/services/virusTotalService.js
const axios = require('axios');

const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;

async function scanURL(url) {
  try {
    const response = await axios.post(
      'https://www.virustotal.com/api/v3/urls',
      `url=${encodeURIComponent(url)}`,
      {
        headers: {
          'x-apikey': VT_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error scanning URL:', error);
    return { error: 'Scan failed' };
  }
}

async function getScanResults(analysisId) {
  try {
    const response = await axios.get(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      {
        headers: {
          'x-apikey': VT_API_KEY
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error getting scan results:', error);
    return { error: 'Failed to get results' };
  }
}

module.exports = { scanURL, getScanResults };
```

**Configuration**:
```bash
# .env
VIRUSTOTAL_API_KEY=your_api_key_here
```

### Integration 3: Shodan API

**Purpose**: Reconnaissance and vulnerability intelligence

**Setup**:
```javascript
// backend/services/shodanService.js
const axios = require('axios');

const SHODAN_API_KEY = process.env.SHODAN_API_KEY;

async function hostInfo(ip) {
  try {
    const response = await axios.get(
      `https://api.shodan.io/shodan/host/${ip}?key=${SHODAN_API_KEY}`
    );
    
    return {
      ip: response.data.ip_str,
      organization: response.data.org,
      os: response.data.os,
      ports: response.data.ports,
      vulnerabilities: response.data.vulns,
      services: response.data.data.map(service => ({
        port: service.port,
        protocol: service.transport,
        product: service.product,
        version: service.version
      }))
    };
  } catch (error) {
    console.error('Error querying Shodan:', error);
    return { error: 'Query failed' };
  }
}

async function searchExploits(query) {
  try {
    const response = await axios.get(
      `https://exploits.shodan.io/api/search?query=${encodeURIComponent(query)}&key=${SHODAN_API_KEY}`
    );
    
    return response.data;
  } catch (error) {
    console.error('Error searching exploits:', error);
    return { error: 'Search failed' };
  }
}

module.exports = { hostInfo, searchExploits };
```

**Configuration**:
```bash
# .env
SHODAN_API_KEY=your_api_key_here
```

### Integration 4: CVE Details API

**Purpose**: Vulnerability database access

**Setup**:
```javascript
// backend/services/cveService.js
const axios = require('axios');

async function searchCVE(keyword) {
  try {
    const response = await axios.get(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}`
    );
    
    return response.data.vulnerabilities.map(vuln => ({
      id: vuln.cve.id,
      description: vuln.cve.descriptions[0]?.value,
      severity: vuln.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity,
      score: vuln.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore,
      published: vuln.cve.published,
      references: vuln.cve.references
    }));
  } catch (error) {
    console.error('Error searching CVE:', error);
    return { error: 'Search failed' };
  }
}

async function getCVEDetails(cveId) {
  try {
    const response = await axios.get(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`
    );
    
    return response.data.vulnerabilities[0];
  } catch (error) {
    console.error('Error getting CVE details:', error);
    return { error: 'Failed to get details' };
  }
}

module.exports = { searchCVE, getCVEDetails };
```

### Integration 5: AbuseIPDB

**Purpose**: Check IP reputation and report malicious IPs

**Setup**:
```javascript
// backend/services/abuseIPDBService.js
const axios = require('axios');

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;

async function checkIP(ip) {
  try {
    const response = await axios.get(
      'https://api.abuseipdb.com/api/v2/check',
      {
        params: {
          ipAddress: ip,
          maxAgeInDays: 90,
          verbose: true
        },
        headers: {
          'Key': ABUSEIPDB_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    return {
      ip: response.data.data.ipAddress,
      abuseScore: response.data.data.abuseConfidenceScore,
      country: response.data.data.countryCode,
      isp: response.data.data.isp,
      totalReports: response.data.data.totalReports,
      isWhitelisted: response.data.data.isWhitelisted,
      recentActivity: response.data.data.reports
    };
  } catch (error) {
    console.error('Error checking IP:', error);
    return { error: 'Check failed' };
  }
}

async function reportIP(ip, categories, comment) {
  try {
    const response = await axios.post(
      'https://api.abuseipdb.com/api/v2/report',
      {
        ip,
        categories: categories.join(','),
        comment
      },
      {
        headers: {
          'Key': ABUSEIPDB_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error reporting IP:', error);
    return { error: 'Report failed' };
  }
}

module.exports = { checkIP, reportIP };
```

**Configuration**:
```bash
# .env
ABUSEIPDB_API_KEY=your_api_key_here
```

### Integration 6: MaxMind GeoIP2

**Purpose**: Geographic IP location and ISP information

**Setup**:
```bash
# Install MaxMind library
npm install @maxmind/geoip2-node

# Download GeoIP2 database
wget https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz
```

```javascript
// backend/services/geoIPService.js
const Reader = require('@maxmind/geoip2-node').Reader;
const path = require('path');

let reader;

async function init() {
  const dbPath = path.join(__dirname, '../data/GeoLite2-City.mmdb');
  reader = await Reader.open(dbPath);
}

async function lookupIP(ip) {
  try {
    if (!reader) await init();
    
    const response = reader.city(ip);
    
    return {
      ip,
      country: response.country.isoCode,
      city: response.city.names.en,
      latitude: response.location.latitude,
      longitude: response.location.longitude,
      timezone: response.location.timeZone,
      isp: response.traits.isp,
      organization: response.traits.organization
    };
  } catch (error) {
    console.error('Error looking up IP:', error);
    return { error: 'Lookup failed' };
  }
}

module.exports = { lookupIP, init };
```

### Integration 7: Censys API

**Purpose**: Internet-wide scan data and certificate transparency

**Setup**:
```javascript
// backend/services/censysService.js
const axios = require('axios');

const CENSYS_API_ID = process.env.CENSYS_API_ID;
const CENSYS_API_SECRET = process.env.CENSYS_API_SECRET;

const auth = {
  username: CENSYS_API_ID,
  password: CENSYS_API_SECRET
};

async function searchHosts(query) {
  try {
    const response = await axios.post(
      'https://search.censys.io/api/v2/hosts/search',
      { q: query, per_page: 50 },
      { auth }
    );
    
    return response.data.result.hits;
  } catch (error) {
    console.error('Error searching Censys:', error);
    return { error: 'Search failed' };
  }
}

async function getHostDetails(ip) {
  try {
    const response = await axios.get(
      `https://search.censys.io/api/v2/hosts/${ip}`,
      { auth }
    );
    
    return {
      ip: response.data.result.ip,
      services: response.data.result.services,
      location: response.data.result.location,
      autonomous_system: response.data.result.autonomous_system,
      certificates: response.data.result.services
        .filter(s => s.service_name === 'HTTP')
        .map(s => s.tls)
    };
  } catch (error) {
    console.error('Error getting host details:', error);
    return { error: 'Failed to get details' };
  }
}

module.exports = { searchHosts, getHostDetails };
```

**Configuration**:
```bash
# .env
CENSYS_API_ID=your_api_id
CENSYS_API_SECRET=your_api_secret
```

---

## 🔒 Advanced Security Features

### Rate Limiting (DDoS Protection)

```javascript
// backend/middleware/advancedRateLimit.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// Strict rate limiting for sensitive endpoints
const strictLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:strict:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Normal rate limiting
const normalLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:normal:'
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { strictLimiter, normalLimiter };
```

### Request Signing

```javascript
// backend/middleware/requestSigning.js
const crypto = require('crypto');

function verifyRequestSignature(req, res, next) {
  const signature = req.headers['x-request-signature'];
  const timestamp = req.headers['x-request-timestamp'];
  const clientId = req.headers['x-client-id'];
  
  if (!signature || !timestamp || !clientId) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }
  
  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 300000) { // 5 minutes
    return res.status(401).json({ error: 'Request timestamp expired' });
  }
  
  // Get client secret from database
  // const clientSecret = await getClientSecret(clientId);
  
  // Verify signature
  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', 'client_secret_here')
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

module.exports = { verifyRequestSignature };
```

### Input Sanitization

```javascript
// backend/middleware/sanitization.js
const validator = require('validator');

function sanitizeInput(req, res, next) {
  // Sanitize all string inputs
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove HTML tags
        obj[key] = validator.stripLow(obj[key]);
        // Escape HTML entities
        obj[key] = validator.escape(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };
  
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  
  next();
}

module.exports = { sanitizeInput };
```

---

## 📊 Security Monitoring Dashboard

### Real-Time Security Metrics

```javascript
// backend/routes/security-metrics.js
router.get('/metrics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const metrics = {
      // Failed login attempts (last 24h)
      failedLogins: await all(`
        SELECT COUNT(*) as count
        FROM security_events
        WHERE event_type = 'auth.login_failed'
        AND created_at > datetime('now', '-24 hours')
      `),
      
      // Active sessions
      activeSessions: await all(`
        SELECT COUNT(*) as count
        FROM user_sessions
        WHERE expires_at > datetime('now')
      `),
      
      // 2FA adoption rate
      twoFAAdoption: await get(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN twofa_enabled = 1 THEN 1 ELSE 0 END) as enabled_users
        FROM users
      `),
      
      // Suspicious activities (last 24h)
      suspiciousActivities: await all(`
        SELECT event_type, COUNT(*) as count
        FROM security_events
        WHERE event_type LIKE 'security.suspicious%'
        AND created_at > datetime('now', '-24 hours')
        GROUP BY event_type
      `),
      
      // Geographic distribution of logins
      loginLocations: await all(`
        SELECT country, COUNT(*) as count
        FROM security_events
        WHERE event_type = 'auth.login_success'
        AND created_at > datetime('now', '-7 days')
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `)
    };
    
    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching security metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});
```

---

## 🚨 Security Alerts

### Automated Alert System

```javascript
// backend/services/alertService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendSecurityAlert(userId, alertType, details) {
  const user = await get('SELECT email, username FROM users WHERE id = ?', [userId]);
  
  if (!user || !user.email) return;
  
  const alerts = {
    'suspicious_login': {
      subject: '🔒 Suspicious Login Detected',
      body: `
        A suspicious login was detected on your Hydra-Termux account.
        
        Details:
        - IP Address: ${details.ip}
        - Location: ${details.location}
        - Time: ${details.timestamp}
        
        If this wasn't you, immediately:
        1. Change your password
        2. Enable 2FA if not already enabled
        3. Review your active sessions
        
        View security log: ${process.env.APP_URL}/security/audit-log
      `
    },
    'password_change': {
      subject: '🔐 Password Changed',
      body: `Your Hydra-Termux password was successfully changed.`
    },
    'new_device': {
      subject: '📱 New Device Login',
      body: `A new device logged into your account: ${details.device}`
    }
  };
  
  const alert = alerts[alertType];
  if (!alert) return;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: alert.subject,
    text: alert.body
  });
}

module.exports = { sendSecurityAlert };
```

---

## 📝 Configuration Summary

### Required Environment Variables

```bash
# .env

# Security
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
SESSION_SECRET=your_session_secret_key

# 2FA
TOTP_ISSUER=Hydra-Termux
TOTP_WINDOW=2

# External APIs
VIRUSTOTAL_API_KEY=your_vt_api_key
SHODAN_API_KEY=your_shodan_api_key
ABUSEIPDB_API_KEY=your_abuseipdb_key
CENSYS_API_ID=your_censys_id
CENSYS_API_SECRET=your_censys_secret
MAXMIND_LICENSE_KEY=your_maxmind_key

# Email Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="Hydra-Termux Security <noreply@hydra-termux.com>"

# Redis (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
APP_URL=https://yourdomain.com
```

---

## 🎯 Next Steps

1. **Obtain API Keys**: Sign up for each service
2. **Configure Environment**: Set all required variables
3. **Test Integrations**: Verify each API connection
4. **Enable 2FA**: Require for all admin accounts
5. **Monitor Security**: Review audit logs regularly
6. **Update Regularly**: Keep all dependencies current

---

*For questions or support, refer to the main documentation or open an issue on GitHub.*
