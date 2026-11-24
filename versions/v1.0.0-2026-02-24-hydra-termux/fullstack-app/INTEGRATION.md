# 🔗 Integration Guide - Hydra Full-Stack Platform

This guide explains how the full-stack application integrates with the existing Hydra-Termux scripts and how to extend it.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Port 3001)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │ Attacks  │  │ Results  │  │ Targets  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│                    Axios HTTP Client                         │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                      REST API / WebSocket
                           │
┌──────────────────────────┼───────────────────────────────────┐
│              Express.js Backend (Port 3000)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   Routes    │  │  Middleware  │  │    Database     │    │
│  │ - Attacks   │  │ - Auth (JWT) │  │   (SQLite3)     │    │
│  │ - Targets   │  │ - Rate Limit │  │                 │    │
│  │ - Results   │  │ - CORS       │  │  8 Tables:      │    │
│  └──────┬──────┘  └──────────────┘  │  - users        │    │
│         │                            │  - attacks      │    │
│  ┌──────┴─────────────┐             │  - targets      │    │
│  │  Attack Service    │             │  - results      │    │
│  │  (Job Executor)    │             │  - wordlists    │    │
│  └──────┬─────────────┘             │  - logs         │    │
│         │                            └─────────────────┘    │
└─────────┼──────────────────────────────────────────────────┘
          │
    child_process.spawn()
          │
┌─────────┼──────────────────────────────────────────────────┐
│         │         Bash Scripts Layer                       │
│  ┌──────▼─────────────────────────────────────────────┐   │
│  │  scripts/                                           │   │
│  │  - ssh_admin_attack.sh                              │   │
│  │  - ftp_admin_attack.sh                              │   │
│  │  - web_admin_attack.sh                              │   │
│  │  - rdp_admin_attack.sh                              │   │
│  │  - mysql_admin_attack.sh                            │   │
│  │  - postgres_admin_attack.sh                         │   │
│  │  - smb_admin_attack.sh                              │   │
│  │  - admin_auto_attack.sh                             │   │
│  └──────┬──────────────────────────────────────────────┘   │
│         │                                                   │
└─────────┼───────────────────────────────────────────────────┘
          │
          │  Execute: hydra -L users.txt -P pass.txt ...
          │
┌─────────▼───────────────────────────────────────────────────┐
│                    THC-Hydra Tool                           │
│            (Actual Network Attack Execution)                │
└─────────────────────────────────────────────────────────────┘
```

## How Attacks Are Executed

### 1. User Initiates Attack (Frontend)

User fills out attack form in React UI:
```javascript
// Frontend: pages/Attacks.js
const formData = {
  attack_type: 'ssh',
  target_host: '192.168.1.100',
  target_port: 22,
  protocol: 'ssh',
  config: { threads: 16, verbose: false }
};

// POST to backend
await api.post('/attacks', formData);
```

### 2. API Receives Request (Backend)

Backend validates and creates attack record:
```javascript
// Backend: routes/attacks.js
router.post('/', authMiddleware, async (req, res) => {
  // Validate input
  const { attack_type, target_host, protocol } = req.body;
  
  // Create database record
  const result = await run(
    'INSERT INTO attacks (...) VALUES (...)',
    [attack_type, target_host, ...]
  );
  
  // Queue attack for execution
  attackService.queueAttack({
    id: result.id,
    attack_type,
    target_host,
    ...
  });
  
  res.json({ attackId: result.id, status: 'queued' });
});
```

### 3. Attack Service Executes (Backend)

Service spawns bash script:
```javascript
// Backend: services/attackService.js
executeAttack(attackData) {
  // Map attack type to script
  const scriptPath = path.join(scriptsPath, 'ssh_admin_attack.sh');
  
  // Build arguments
  const args = [scriptPath, '-t', target_host, '-p', port];
  
  // Spawn process
  const process = spawn('bash', args);
  
  // Capture output
  process.stdout.on('data', (data) => {
    parseCredentials(data);  // Parse Hydra output
    broadcast({ type: 'progress', data });  // Send to frontend
  });
  
  process.on('close', (code) => {
    updateDatabase(attackId, 'completed');
  });
}
```

### 4. Script Executes Hydra (Scripts)

Bash script calls Hydra:
```bash
# scripts/ssh_admin_attack.sh
hydra -L "$USER_LIST" -P "$PASS_LIST" \
      -t "$THREADS" \
      -v \
      ssh://"$TARGET" -s "$PORT"
```

### 5. Results Parsed and Stored (Backend)

Hydra output is parsed:
```javascript
// Backend: services/attackService.js
parseCredentials(output) {
  // Regex to match Hydra output format
  const regex = /\[(\d+)\]\[(\w+)\]\s+host:\s+([^\s]+)\s+login:\s+([^\s]+)\s+password:\s+(.+)/gi;
  
  while ((match = regex.exec(output)) !== null) {
    const [, port, protocol, host, username, password] = match;
    
    // Store in database
    await run(
      'INSERT INTO results (...) VALUES (...)',
      [attackId, host, username, password, ...]
    );
    
    // Broadcast to frontend
    broadcast({
      type: 'credentials_found',
      username,
      password,
      host
    });
  }
}
```

### 6. Frontend Updates in Real-Time (Frontend)

WebSocket receives updates:
```javascript
// Frontend: websocket connection
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'credentials_found':
      showNotification('Credentials found!');
      updateResultsList(data);
      break;
    case 'attack_progress':
      updateProgressBar(data);
      break;
    case 'attack_completed':
      showSuccess('Attack completed!');
      break;
  }
};
```

## Adding New Attack Types

To add a new attack type (e.g., Telnet):

### 1. Create Bash Script

```bash
# scripts/telnet_admin_attack.sh
#!/bin/bash

TARGET="$1"
PORT="${2:-23}"

hydra -L users.txt -P passwords.txt \
      -t 16 \
      telnet://"$TARGET" -s "$PORT"
```

### 2. Update Backend Route

```javascript
// Backend: routes/attacks.js

// Add to attack types endpoint
router.get('/types/list', authMiddleware, async (req, res) => {
  const attackTypes = [
    // ... existing types ...
    { 
      id: 'telnet', 
      name: 'Telnet', 
      description: 'Telnet brute-force attack',
      default_port: 23
    }
  ];
  res.json({ attackTypes });
});
```

### 3. Update Attack Service

```javascript
// Backend: services/attackService.js

executeAttack(attackData) {
  const scriptMap = {
    // ... existing mappings ...
    'telnet': 'telnet_admin_attack.sh'
  };
  
  const scriptName = scriptMap[attack_type];
  // ... rest of execution logic
}
```

### 4. Frontend Automatically Updates

No frontend changes needed! The UI automatically:
- Fetches available attack types from API
- Displays them in dropdown
- Handles the new attack type

## Database Integration

### Querying Results

```javascript
// Get all SSH results
const results = await all(
  'SELECT * FROM results WHERE protocol = ? AND success = 1',
  ['ssh']
);

// Get results by date range
const results = await all(
  'SELECT * FROM results WHERE created_at BETWEEN ? AND ?',
  [startDate, endDate]
);

// Get top targets with most successful attacks
const stats = await all(`
  SELECT target_host, COUNT(*) as count
  FROM results
  WHERE success = 1
  GROUP BY target_host
  ORDER BY count DESC
  LIMIT 10
`);
```

### Custom Reports

```javascript
// Generate attack summary report
async function generateReport(userId, dateRange) {
  const attacks = await all(`
    SELECT 
      a.*,
      COUNT(r.id) as total_attempts,
      SUM(CASE WHEN r.success = 1 THEN 1 ELSE 0 END) as successful
    FROM attacks a
    LEFT JOIN results r ON r.attack_id = a.id
    WHERE a.user_id = ?
      AND a.created_at BETWEEN ? AND ?
    GROUP BY a.id
  `, [userId, dateRange.start, dateRange.end]);
  
  return attacks;
}
```

## API Integration Examples

### Using the API from External Tools

```bash
# Authenticate
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.token')

# Create attack
ATTACK_ID=$(curl -s -X POST http://localhost:3000/api/attacks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attack_type": "ssh",
    "target_host": "192.168.1.100",
    "target_port": 22,
    "protocol": "ssh"
  }' | jq -r '.attackId')

# Monitor attack
curl -s http://localhost:3000/api/attacks/$ATTACK_ID \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.attack.status'

# Get results
curl -s http://localhost:3000/api/results/attack/$ATTACK_ID \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.results'
```

### Python Integration

```python
import requests

class HydraAPI:
    def __init__(self, base_url, username, password):
        self.base_url = base_url
        self.token = self.login(username, password)
    
    def login(self, username, password):
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={"username": username, "password": password}
        )
        return response.json()['token']
    
    def create_attack(self, attack_type, target_host, **kwargs):
        headers = {"Authorization": f"Bearer {self.token}"}
        data = {
            "attack_type": attack_type,
            "target_host": target_host,
            "protocol": attack_type,
            **kwargs
        }
        response = requests.post(
            f"{self.base_url}/attacks",
            json=data,
            headers=headers
        )
        return response.json()['attackId']
    
    def get_results(self, attack_id):
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.get(
            f"{self.base_url}/results/attack/{attack_id}",
            headers=headers
        )
        return response.json()['results']

# Usage
api = HydraAPI("http://localhost:3000/api", "admin", "admin")
attack_id = api.create_attack("ssh", "192.168.1.100", target_port=22)
results = api.get_results(attack_id)
```

## Extending the Platform

### Adding Custom Middleware

```javascript
// Backend: middleware/custom.js
const customMiddleware = (req, res, next) => {
  // Add custom logic
  console.log(`Request from ${req.ip}`);
  next();
};

// Backend: server.js
app.use('/api/', customMiddleware);
```

### Custom Attack Parsers

```javascript
// Backend: services/parsers/customParser.js
module.exports = {
  parse(output) {
    // Custom parsing logic for non-Hydra output
    const credentials = [];
    // ... parse output ...
    return credentials;
  }
};
```

### Adding Plugins

```javascript
// Backend: plugins/notification.js
class NotificationPlugin {
  async onCredentialsFound(credentials) {
    // Send email, Slack message, etc.
    await sendSlackMessage({
      text: `Credentials found: ${credentials.username}:${credentials.password}`
    });
  }
}

// Register plugin
attackService.registerPlugin(new NotificationPlugin());
```

## Security Considerations

### Rate Limiting

```javascript
// Custom rate limit for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10  // Only 10 requests per 15 minutes
});

app.use('/api/attacks', strictLimiter);
```

### Input Validation

```javascript
// Validate target host
const validateTarget = (req, res, next) => {
  const { target_host } = req.body;
  
  // Check format
  if (!/^[\w\.-]+$/.test(target_host)) {
    return res.status(400).json({ error: 'Invalid target format' });
  }
  
  next();
};

router.post('/attacks', authMiddleware, validateTarget, ...);
```

### Audit Logging

```javascript
// Log all attack creation
router.post('/attacks', authMiddleware, async (req, res) => {
  // ... create attack ...
  
  // Audit log
  await run(
    'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
    [req.user.id, 'CREATE_ATTACK', JSON.stringify(req.body)]
  );
});
```

## Performance Optimization

### Database Indexing

```sql
-- Add indexes for common queries
CREATE INDEX idx_results_protocol ON results(protocol);
CREATE INDEX idx_results_success ON results(success);
CREATE INDEX idx_attacks_user ON attacks(user_id);
CREATE INDEX idx_attacks_status ON attacks(status);
```

### Caching

```javascript
// Cache attack types
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 });

router.get('/types/list', authMiddleware, async (req, res) => {
  let attackTypes = cache.get('attack_types');
  
  if (!attackTypes) {
    attackTypes = loadAttackTypes();
    cache.set('attack_types', attackTypes);
  }
  
  res.json({ attackTypes });
});
```

## Troubleshooting Integration Issues

### Script Not Found
- Check SCRIPTS_PATH in .env
- Verify script permissions: `chmod +x scripts/*.sh`
- Ensure scripts directory is accessible

### Output Not Parsed
- Check regex patterns match Hydra output format
- Test with verbose mode to see raw output
- Log output for debugging: `console.log(output)`

### Database Locked
- Only one connection should write at a time
- Use connection pooling for high concurrency
- Consider upgrading to PostgreSQL for production

### WebSocket Not Connecting
- Check CORS settings
- Verify WebSocket port is not blocked
- Ensure client uses correct WebSocket URL

---

**For more help, see the main README.md or open an issue on GitHub.**
