# Hydra-Termux Backend Modules

This directory contains comprehensive, production-ready Node.js modules for the Hydra-Termux fullstack application.

## 📦 Modules Overview

### Core Modules

#### 1. **dnsIntelligence.js**
DNS analysis and intelligence gathering module.

**Features:**
- MX, SPF, DMARC, DKIM record lookups
- Comprehensive DNS analysis
- Security scoring system
- Reverse DNS lookups
- Built-in caching layer

**Usage:**
```javascript
const { dnsIntelligence } = require('./modules');

// Analyze a domain
const analysis = await dnsIntelligence.analyzeDomain('example.com');
console.log('Security Score:', analysis.security_score);
```

#### 2. **attackOrchestrator.js**
Attack queue management and execution using Bull.

**Features:**
- Queue-based attack management
- Priority queue support
- Job progress tracking
- Automatic retries
- Concurrent attack limiting

**Usage:**
```javascript
const { attackOrchestrator } = require('./modules');

// Queue an attack
const job = await attackOrchestrator.queueAttack({
  attackType: 'ssh',
  target: '192.168.1.100',
  options: { port: 22, passwordList: '/path/to/list.txt' }
});

// Check job status
const status = await attackOrchestrator.getJobStatus(job.jobId);
```

#### 3. **credentialManager.js**
Secure credential storage and retrieval with encryption.

**Features:**
- AES-256-GCM encryption
- Secure credential storage in Supabase
- Bulk operations support
- Search and filtering
- Duplicate detection

**Usage:**
```javascript
const { credentialManager } = require('./modules');

// Store credentials
await credentialManager.storeCredential({
  attackId: 'uuid',
  userId: 'uuid',
  target: '192.168.1.100',
  service: 'ssh',
  username: 'admin',
  password: 'secret123'
});

// Retrieve with decryption
const cred = await credentialManager.getCredential(credId, true);
```

#### 4. **resultParser.js**
Parse attack tool outputs and extract structured results.

**Features:**
- Multiple parser support (Hydra, Nmap, Masscan)
- Credential extraction
- Pattern matching
- Format validation
- Multiple output formats

**Usage:**
```javascript
const { resultParser } = require('./modules');

// Parse Hydra output
const results = resultParser.parse(hydraOutput, 'hydra');
console.log('Credentials found:', results.credentials);

// Format results
const formatted = resultParser.formatResults(results, 'table');
```

#### 5. **notificationManager.js**
Email and webhook notification system.

**Features:**
- SMTP email notifications
- Webhook support
- HTML email templates
- Event-based notifications
- Configuration testing

**Usage:**
```javascript
const { notificationManager } = require('./modules');

// Send attack completion notification
await notificationManager.notifyAttackComplete({
  attackId: 'uuid',
  target: '192.168.1.100',
  status: 'completed',
  credentialsFound: 3,
  userEmail: 'user@example.com'
});
```

#### 6. **analyticsEngine.js**
Attack analytics, statistics, and reporting.

**Features:**
- Attack statistics
- Credential analytics
- Performance metrics
- Trend analysis
- Time period comparison
- Chart data generation

**Usage:**
```javascript
const { analyticsEngine } = require('./modules');

// Generate comprehensive report
const report = await analyticsEngine.generateReport(userId, {
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  includeCharts: true
});

// Get attack trends
const trends = await analyticsEngine.getAttackTrends(userId, { days: 30 });
```

#### 7. **exportManager.js**
Export data to CSV, JSON, PDF, and Excel formats.

**Features:**
- Multiple format support (JSON, CSV, PDF, Excel)
- Credential export with password protection
- Attack report generation
- Analytics report export
- Multi-sheet Excel exports

**Usage:**
```javascript
const { exportManager } = require('./modules');

// Export credentials to Excel
const result = await exportManager.exportCredentials(credentials, 'excel', {
  filename: 'credentials_backup',
  includePasswords: false
});

// Export analytics to PDF
await exportManager.exportAnalyticsReport(analytics, 'pdf');
```

#### 8. **cacheManager.js**
Redis caching layer with fallback to in-memory cache.

**Features:**
- Redis primary cache
- NodeCache fallback
- TTL support
- Bulk operations
- Cache statistics
- Function wrapping

**Usage:**
```javascript
const { cacheManager } = require('./modules');

// Set cache
await cacheManager.set('key', { data: 'value' }, 600);

// Get cache
const value = await cacheManager.get('key');

// Get or set with refresh
const data = await cacheManager.getOrSet('key', async () => {
  return await fetchData();
}, 600);
```

### Utility Modules

#### 9. **logManager.js**
Winston logging configuration with multiple transports.

**Features:**
- Daily rotating file logs
- Separate logs for attacks, security, errors
- Console logging in development
- Structured logging
- Log streaming and reading

**Usage:**
```javascript
const { logger, logAttack, logSecurity } = require('./modules');

// General logging
logger.info('Application started');
logger.error('Error occurred', { error: error.message });

// Attack logging
logAttack({
  attackId: 'uuid',
  target: '192.168.1.100',
  status: 'completed'
});

// Security logging
logSecurity('authentication', {
  userId: 'uuid',
  action: 'login',
  success: true
});
```

#### 10. **validationSchemas.js**
Joi validation schemas for request validation.

**Features:**
- Comprehensive validation schemas
- Express middleware
- Input sanitization
- Custom error messages
- Nested validation

**Usage:**
```javascript
const { validateMiddleware, schemas } = require('./modules');

// Use as Express middleware
app.post('/api/attacks', 
  validateMiddleware(schemas.attackConfigSchema),
  async (req, res) => {
    // Request body is validated and sanitized
    const attack = await startAttack(req.body);
    res.json(attack);
  }
);

// Manual validation
const { valid, errors, value } = validate(data, schemas.userLoginSchema);
```

## 🚀 Getting Started

### Installation

All dependencies are already included in the backend `package.json`:

```bash
cd fullstack-app/backend
npm install
```

### Importing Modules

You can import individual modules or all at once:

```javascript
// Import all modules
const modules = require('./modules');
const { dnsIntelligence, attackOrchestrator, logger } = modules;

// Import specific module
const dnsIntelligence = require('./modules/dnsIntelligence');
```

### Initialization

Some modules require initialization:

```javascript
const { initializeModules, shutdown } = require('./modules');

// Initialize all modules
await initializeModules();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});
```

### Health Checks

Monitor module health:

```javascript
const { healthCheck } = require('./modules');

app.get('/health/modules', async (req, res) => {
  const health = await healthCheck();
  res.json(health);
});
```

## 📝 Environment Variables

### Required Variables

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# Email Notifications
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password
SMTP_FROM=noreply@hydra-termux.com

# Webhook Notifications
WEBHOOK_NOTIFICATIONS_ENABLED=true
WEBHOOK_URLS=https://webhook1.com,https://webhook2.com

# Attack Configuration
MAX_CONCURRENT_ATTACKS=3
ATTACK_TIMEOUT=3600000

# Logging
LOG_LEVEL=info
LOG_QUERIES=false
LOG_CACHE=false

# Encryption
CREDENTIAL_ENCRYPTION_KEY=your_32_byte_hex_key
```

## 🔒 Security Best Practices

1. **Credential Encryption**: All passwords are encrypted with AES-256-GCM
2. **Input Validation**: All inputs are validated with Joi schemas
3. **Input Sanitization**: XSS prevention through sanitization
4. **Secure Logging**: Passwords never logged in plain text
5. **Rate Limiting**: Built-in queue management prevents overload
6. **Environment Variables**: All sensitive data in environment variables

## 📊 Module Statistics

- **Total Modules**: 11 (10 modules + index)
- **Total Lines of Code**: ~5,700 lines
- **Total Size**: ~184 KB
- **JSDoc Coverage**: 100%
- **Error Handling**: Comprehensive try-catch blocks
- **Code Style**: ES6+ with async/await

## 🧪 Testing

Each module can be tested individually:

```javascript
// Test DNS Intelligence
const result = await dnsIntelligence.analyzeDomain('google.com');
console.log('DNS Analysis:', result);

// Test Cache Manager
await cacheManager.set('test', 'value');
const cached = await cacheManager.get('test');
console.log('Cache test:', cached);

// Test Export Manager
const exports = await exportManager.listExports();
console.log('Available exports:', exports);
```

## 🔧 Module Dependencies

Each module is designed as a singleton with minimal dependencies:

```
dnsIntelligence → logManager
attackOrchestrator → logManager, resultParser
credentialManager → logManager
resultParser → logManager
notificationManager → logManager
analyticsEngine → logManager
exportManager → logManager
cacheManager → logManager
validationSchemas → (no dependencies)
logManager → (no dependencies)
```

## 📚 API Documentation

Detailed JSDoc comments are provided for all:
- Public methods
- Private methods
- Parameters
- Return types
- Examples

Use an IDE with JSDoc support for inline documentation.

## 🐛 Error Handling

All modules follow consistent error handling patterns:

```javascript
try {
  // Operation
  logger.info('Operation started');
  const result = await operation();
  return result;
} catch (error) {
  logger.error(`Operation failed: ${error.message}`);
  throw error; // Re-throw for caller handling
}
```

## 🔄 Module Lifecycle

1. **Initialization**: `initializeModules()` - Setup all modules
2. **Operation**: Use modules normally
3. **Health Check**: `healthCheck()` - Monitor status
4. **Shutdown**: `shutdown()` - Graceful cleanup

## 📞 Support

For issues or questions about specific modules, check:
- JSDoc comments in the module files
- This README
- Backend API documentation

## 📄 License

MIT License - See LICENSE file in root directory

---

**Created for Hydra-Termux v2.0**  
Professional, Production-Ready Backend Modules
