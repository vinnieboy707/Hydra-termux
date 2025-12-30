# Hydra-Termux Full-Stack API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Table of Contents
1. [Authentication](#authentication-endpoints)
2. [Attacks](#attack-endpoints)
3. [Targets](#target-endpoints)
4. [Results](#result-endpoints)
5. [Wordlists](#wordlist-endpoints)
6. [Dashboard](#dashboard-endpoints)
7. [Configuration](#configuration-endpoints)
8. [Logs](#log-endpoints)
9. [System](#system-endpoints)
10. [Webhooks](#webhook-endpoints)

---

## Authentication Endpoints

### Register User
```http
POST /api/auth/register
```
**Body:**
```json
{
  "username": "string",
  "password": "string",
  "email": "string (optional)"
}
```

### Login
```http
POST /api/auth/login
```
**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

### Verify Token
```http
GET /api/auth/verify
```
**Headers:** `Authorization: Bearer <token>`

---

## Attack Endpoints

### List All Attacks
```http
GET /api/attacks?status=<status>&protocol=<protocol>&limit=50&offset=0
```
**Query Parameters:**
- `status` (optional): Filter by status (queued, running, completed, stopped, failed)
- `protocol` (optional): Filter by protocol (ssh, ftp, http, etc.)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

### Get Attack Details
```http
GET /api/attacks/:id
```
**Returns:** Attack details, results, and logs

### Create New Attack
```http
POST /api/attacks
```
**Body:**
```json
{
  "attack_type": "string",
  "target_host": "string",
  "target_port": "number (optional)",
  "protocol": "string",
  "config": {
    "threads": 16,
    "timeout": 30,
    "wordlist": "string"
  }
}
```

### Stop Running Attack
```http
POST /api/attacks/:id/stop
```

### Delete Attack
```http
DELETE /api/attacks/:id
```

### Get Available Attack Types
```http
GET /api/attacks/types/list
```
**Returns:** List of supported attack types with descriptions

---

## Target Endpoints

### List All Targets
```http
GET /api/targets
```

### Get Target Details
```http
GET /api/targets/:id
```

### Create New Target
```http
POST /api/targets
```
**Body:**
```json
{
  "name": "string",
  "host": "string",
  "port": "number (optional)",
  "protocol": "string (optional)",
  "description": "string (optional)",
  "tags": "string (optional)"
}
```

### Update Target
```http
PUT /api/targets/:id
```
**Body:** Same as create

### Delete Target
```http
DELETE /api/targets/:id
```

---

## Result Endpoints

### List All Results
```http
GET /api/results?protocol=<protocol>&success=<boolean>&limit=100&offset=0
```
**Query Parameters:**
- `protocol` (optional): Filter by protocol
- `success` (optional): Filter by success status (true/false)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

### Get Results by Attack ID
```http
GET /api/results/attack/:attackId
```

### Get Result Statistics
```http
GET /api/results/stats
```

### Export Results
```http
GET /api/results/export?format=<format>
```
**Query Parameters:**
- `format` (optional): Export format (json, csv) (default: json)

---

## Wordlist Endpoints

### List All Wordlists
```http
GET /api/wordlists
```

### Scan Wordlists Directory
```http
POST /api/wordlists/scan
```
**Description:** Scans the wordlists directory and imports found wordlists into database

---

## Dashboard Endpoints

### Get Dashboard Statistics
```http
GET /api/dashboard/stats
```
**Returns:**
```json
{
  "attackStats": [...],
  "protocolStats": [...],
  "recentCredentials": [...],
  "totals": {
    "total_attacks": 0,
    "total_credentials": 0,
    "total_targets": 0
  },
  "recentActivity": [...]
}
```

---

## Configuration Endpoints

### Get Configuration
```http
GET /api/config
```
**Returns:** Current hydra.conf configuration file content

### Update Configuration
```http
PUT /api/config
```
**Body:**
```json
{
  "config": "string (configuration file content)"
}
```

### Get Configuration Schema
```http
GET /api/config/schema
```
**Returns:** Configuration options and their descriptions

---

## Log Endpoints

### Get Database Logs
```http
GET /api/logs?level=<level>&limit=100&offset=0&attackId=<id>
```
**Query Parameters:**
- `level` (optional): Filter by log level (info, warn, error)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)
- `attackId` (optional): Filter by attack ID

### Get Log Files
```http
GET /api/logs/files
```
**Returns:** List of log files in the logs directory

### Get Log File Content
```http
GET /api/logs/files/:filename?tail=1000
```
**Query Parameters:**
- `tail` (optional): Number of lines to return from end of file (default: 1000)

### Cleanup Old Logs
```http
DELETE /api/logs/cleanup
```
**Body:**
```json
{
  "daysOld": 30
}
```

---

## System Endpoints

### Get System Information
```http
GET /api/system/info
```
**Returns:**
```json
{
  "info": {
    "version": "string",
    "platform": "string",
    "nodeVersion": "string",
    "environment": "string",
    "uptime": "number",
    "memory": { ... },
    "cpu": "string",
    "cores": "number",
    "hydraInstalled": "boolean",
    "hydraVersion": "string"
  }
}
```

### Check for Updates
```http
GET /api/system/update/check
```
**Returns:**
```json
{
  "upToDate": "boolean",
  "currentVersion": "string",
  "latestVersion": "string",
  "changesAvailable": "number"
}
```

### Apply Update (Admin Only)
```http
POST /api/system/update/apply
```
**Requires:** Admin role

### Get Help Documentation
```http
GET /api/system/help
```
**Returns:** Comprehensive help documentation for all menu items (1-18)

### Get About Information
```http
GET /api/system/about
```
**Returns:** Application information, credits, and disclaimer

---

## Webhook Endpoints

### List All Webhooks
```http
GET /api/webhooks
```

### Get Webhook Details
```http
GET /api/webhooks/:id
```

### Create New Webhook
```http
POST /api/webhooks
```
**Body:**
```json
{
  "name": "string",
  "url": "string",
  "events": ["attack.started", "attack.completed", "credentials.found"],
  "description": "string (optional)"
}
```
**Available Events:**
- `attack.started`
- `attack.completed`
- `attack.failed`
- `attack.stopped`
- `credentials.found`
- `target.created`
- `target.updated`
- `target.deleted`

### Update Webhook
```http
PUT /api/webhooks/:id
```
**Body:** Same as create, plus:
```json
{
  "enabled": "boolean"
}
```

### Delete Webhook
```http
DELETE /api/webhooks/:id
```

### Test Webhook
```http
POST /api/webhooks/:id/test
```
**Description:** Sends a test payload to the webhook URL

### Get Webhook Delivery Logs
```http
GET /api/webhooks/:id/deliveries?limit=50&offset=0
```
**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

---

## Webhook Payload Format

When a webhook event is triggered, the following payload is sent:

```json
{
  "event": "string",
  "timestamp": "ISO 8601 string",
  "data": {
    // Event-specific data
  }
}
```

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: HMAC-SHA256 signature
X-Webhook-Event: event name
```

**Signature Verification:**
```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "message": "Detailed error description (optional)"
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Health Check

```http
GET /api/health
```
**Returns:**
```json
{
  "status": "ok",
  "timestamp": "ISO 8601 string",
  "version": "string"
}
```

---

## Menu Items 1-18 API Mapping

| Menu # | Name | Related API Endpoints |
|--------|------|----------------------|
| 1 | SSH Admin Attack | POST /api/attacks (attack_type: "ssh") |
| 2 | FTP Admin Attack | POST /api/attacks (attack_type: "ftp") |
| 3 | Web Admin Attack | POST /api/attacks (attack_type: "http") |
| 4 | RDP Admin Attack | POST /api/attacks (attack_type: "rdp") |
| 5 | MySQL Admin Attack | POST /api/attacks (attack_type: "mysql") |
| 6 | PostgreSQL Admin Attack | POST /api/attacks (attack_type: "postgres") |
| 7 | SMB Admin Attack | POST /api/attacks (attack_type: "smb") |
| 8 | Multi-Protocol Auto Attack | POST /api/attacks (attack_type: "auto") |
| 9 | Download Wordlists | POST /api/wordlists/scan |
| 10 | Generate Custom Wordlist | (Script-based, not API) |
| 11 | Scan Target | POST /api/targets (with scan) |
| 12 | View Attack Results | GET /api/results |
| 13 | View Configuration | GET /api/config |
| 14 | View Logs | GET /api/logs |
| 15 | Export Results | GET /api/results/export |
| 16 | Update Hydra-Termux | GET/POST /api/system/update/* |
| 17 | Help & Documentation | GET /api/system/help |
| 18 | About & Credits | GET /api/system/about |

---

## Database Support

The backend supports both SQLite and PostgreSQL databases:

**SQLite (Default):**
- Set `DB_TYPE=sqlite` in .env
- Lightweight, no additional setup required
- Suitable for development and single-user deployments

**PostgreSQL:**
- Set `DB_TYPE=postgres` in .env
- Configure PostgreSQL connection in .env:
  ```
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5432
  POSTGRES_DB=hydra_termux
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=your-password
  ```
- Suitable for production and multi-user deployments
- Better performance and concurrent access

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Window: 15 minutes
- Max Requests: 100 per IP
- Configurable via environment variables

---

## WebSocket Real-Time Updates

Connect to WebSocket for real-time updates:
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

**Update Types:**
- Attack status changes
- Progress updates
- New credentials found
- System notifications
