# Backend Improvements Documentation

## Overview

This document outlines the recent improvements made to the Hydra-Termux backend to enhance logging, error handling, and security.

## 🆕 New Features

### 1. Structured Logging with Winston

We've replaced all `console.log()` and `console.error()` statements with a professional Winston-based logging system.

**Features:**
- **Multiple log levels**: error, warn, info, http, debug
- **Color-coded console output** for easy reading
- **File-based logging** with rotation:
  - `logs/error.log` - Error-level logs only
  - `logs/combined.log` - All logs
- **Contextual logging** with metadata (userId, endpoint, IP, etc.)
- **Morgan HTTP request logging** integrated

**Usage Example:**
```javascript
const logger = require('./utils/logger');

// Basic logging
logger.info('Server started successfully');
logger.error('Database connection failed', { error: err.message });

// Contextual logging
logger.logWithContext('info', 'User action completed', {
  userId: user.id,
  endpoint: '/api/attacks',
  method: 'POST',
  ip: req.ip,
  metadata: { attackId: attack.id }
});
```

**Configuration:**
Set the `LOG_LEVEL` environment variable to control verbosity:
```bash
LOG_LEVEL=debug  # Show everything (development)
LOG_LEVEL=info   # Production default
LOG_LEVEL=error  # Only errors
```

---

### 2. Centralized Error Handling

**New Middleware: `errorHandler.js`**

**Features:**
- **Unique error IDs** for tracking and debugging
- **Safe error responses** - no stack traces in production
- **Request context logging** - every error logged with user, endpoint, IP
- **Custom error class** (`AppError`) for consistent error handling
- **Async handler wrapper** to eliminate try-catch boilerplate

**Usage Example:**
```javascript
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Wrap async routes
router.post('/attack', asyncHandler(async (req, res) => {
  // No try-catch needed!
  if (!req.body.target) {
    throw new AppError('Target is required', 400);
  }
  
  const result = await executeAttack(req.body);
  res.json(result);
}));
```

**Error Response Format:**
```json
{
  "error": true,
  "errorId": "ERR-1706860234567-abc123xyz",
  "message": "An error occurred processing your request"
}
```

In development mode, additional details are included:
```json
{
  "error": true,
  "errorId": "ERR-1706860234567-abc123xyz",
  "message": "Target not found",
  "stack": "Error: Target not found\n    at ...",
  "details": { "targetId": 123 }
}
```

---

### 3. JWT Security Improvements

**Critical Change:** JWT_SECRET validation on startup

```javascript
// Server will not start in production without JWT_SECRET
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-this') {
  logger.error('CRITICAL: JWT_SECRET must be set in environment variables');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required for production');
  }
}
```

**Generate a secure JWT_SECRET:**
```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 64
```

Add to your `.env`:
```bash
JWT_SECRET=your_generated_secret_here
```

---

## 📝 Migration Guide

### For Route Developers

**Before:**
```javascript
router.post('/attack', async (req, res) => {
  try {
    console.log('Attack started');
    if (!req.body.target) {
      return res.status(400).json({ error: 'Target required' });
    }
    const result = await executeAttack(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Attack failed' });
  }
});
```

**After:**
```javascript
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

router.post('/attack', asyncHandler(async (req, res) => {
  logger.info('Attack initiated', { 
    userId: req.user?.id, 
    target: req.body.target 
  });
  
  if (!req.body.target) {
    throw new AppError('Target required', 400);
  }
  
  const result = await executeAttack(req.body);
  logger.info('Attack completed successfully', { attackId: result.id });
  res.json(result);
}));
```

**Benefits:**
- No more try-catch boilerplate
- Consistent error handling
- Better logging with context
- Error tracking with unique IDs

---

## 🔒 Security Benefits

1. **No Information Leakage:**
   - Production errors return generic messages
   - Stack traces only in development
   - Internal errors logged with context for debugging

2. **JWT Secret Validation:**
   - Prevents running production with default/weak secrets
   - Fails fast on startup instead of runtime

3. **Request Tracking:**
   - Every error has a unique ID
   - Easy to correlate logs with user reports
   - IP and user context captured

4. **Audit Trail:**
   - All authentication events logged
   - Failed login attempts tracked
   - User actions captured with context

---

## 📊 Log Files Location

```
fullstack-app/backend/logs/
├── combined.log     # All logs (info, warn, error)
└── error.log        # Errors only
```

**Note:** Log files are automatically excluded from git via `.gitignore`

---

## 🚀 Performance Impact

- **Minimal overhead:** Winston is highly optimized
- **Async file writes:** Non-blocking I/O
- **Log level filtering:** Only relevant logs are processed
- **No console in production:** File-only logging for performance

---

## 🧪 Testing

Test the logging system:
```bash
cd fullstack-app/backend
npm start

# You should see:
# ✅ Colored, structured console logs
# ✅ JWT_SECRET warning if using default
# ✅ Log files created in logs/ directory
```

---

## 📚 Additional Resources

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Express Error Handling Best Practices](https://expressjs.com/en/guide/error-handling.html)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 🤝 Contributing

When adding new routes or features:
1. Use `asyncHandler` for all async routes
2. Throw `AppError` for expected errors
3. Use `logger.logWithContext()` for important events
4. Never log sensitive data (passwords, tokens)
5. Include relevant context in logs (userId, IP, action)

---

**Questions?** Open an issue or see [CONTRIBUTING.md](../../../CONTRIBUTING.md)
