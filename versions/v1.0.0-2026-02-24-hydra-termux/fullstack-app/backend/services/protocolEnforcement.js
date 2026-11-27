// Protocol Enforcement Service
// Implements automated protocol checks from SECURITY_PROTOCOLS.md Section 9.1

const { get, run, all } = require('../database');

const PROTOCOL_CHECKS = {
  '2FA_ENFORCEMENT': {
    check: async (user) => {
      if (!user) return false;
      
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        return user.twofa_enabled === 1;
      }
      return true;
    },
    action: 'BLOCK_ACCESS',
    message: '2FA is required for your role. Please enable 2FA in security settings.',
    severity: 'HIGH'
  },
  
  'PASSWORD_AGE': {
    check: async (user) => {
      if (!user || !user.last_password_change) return false;
      
      const age = Date.now() - new Date(user.last_password_change);
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      
      return age < maxAge;
    },
    action: 'FORCE_CHANGE',
    message: 'Your password must be changed. Passwords expire after 90 days.',
    severity: 'MEDIUM'
  },
  
  'SESSION_TIMEOUT': {
    check: async (session) => {
      if (!session || !session.last_activity) return false;
      
      const idle = Date.now() - new Date(session.last_activity);
      const maxIdle = 30 * 60 * 1000; // 30 minutes
      
      return idle < maxIdle;
    },
    action: 'TERMINATE_SESSION',
    message: 'Session expired due to inactivity (30 minutes).',
    severity: 'LOW'
  },
  
  'MAX_SESSIONS': {
    check: async (user) => {
      if (!user) return false;
      
      const ROLES = require('../middleware/rbac').ROLES;
      const role = ROLES[user.role];
      
      if (!role) return false;
      
      const sessions = await all(
        `SELECT COUNT(*) as count FROM user_sessions 
         WHERE user_id = ? AND expires_at > datetime('now')`,
        [user.id]
      );
      
      return sessions[0].count < role.maxSessions;
    },
    action: 'BLOCK_LOGIN',
    message: 'Maximum concurrent sessions reached. Please log out from another device.',
    severity: 'MEDIUM'
  },
  
  'IP_WHITELIST': {
    check: async (user, context) => {
      if (!user || !context || !context.ipAddress) return false;
      
      const ROLES = require('../middleware/rbac').ROLES;
      const role = ROLES[user.role];
      
      if (!role || !role.requiresIPWhitelist) {
        return true; // No IP whitelist required
      }
      
      if (!user.ip_whitelist_enabled) {
        return false; // Whitelist required but not configured
      }
      
      const whitelist = JSON.parse(user.ip_whitelist || '[]');
      return whitelist.includes(context.ipAddress);
    },
    action: 'BLOCK_ACCESS',
    message: 'Access denied. Your IP address is not whitelisted.',
    severity: 'HIGH'
  },
  
  'ACCOUNT_LOCKOUT': {
    check: async (user) => {
      if (!user || !user.account_locked_until) return true;
      
      const lockoutExpiry = new Date(user.account_locked_until);
      return Date.now() > lockoutExpiry.getTime();
    },
    action: 'BLOCK_ACCESS',
    message: 'Account is locked due to suspicious activity. Please contact support.',
    severity: 'CRITICAL'
  }
};

/**
 * Enforce all protocols for a user
 * @param {Object} user - User object
 * @param {Object} context - Context object (session, ipAddress, etc.)
 * @throws {Error} If protocol violation detected
 */
async function enforceProtocols(user, context = {}) {
  const violations = [];
  
  for (const [protocolName, config] of Object.entries(PROTOCOL_CHECKS)) {
    try {
      const passed = await config.check(user, context);
      
      if (!passed) {
        violations.push({
          protocol: protocolName,
          action: config.action,
          message: config.message,
          severity: config.severity
        });
        
        // Log violation
        await logProtocolViolation(protocolName, user?.id, context);
        
        // Execute action
        await executeAction(config.action, user, context);
      }
    } catch (error) {
      console.error(`Protocol check failed: ${protocolName}`, error);
    }
  }
  
  if (violations.length > 0) {
    const error = new Error(violations[0].message);
    error.violations = violations;
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Log protocol violation
 */
async function logProtocolViolation(protocol, userId, context) {
  try {
    await run(
      `INSERT INTO security_events (user_id, event_type, details, ip_address)
       VALUES (?, ?, ?, ?)`,
      [
        userId || null,
        'protocol_violation',
        JSON.stringify({ protocol, context }),
        context.ipAddress || null
      ]
    );
  } catch (error) {
    console.error('Failed to log protocol violation:', error);
  }
}

/**
 * Execute enforcement action
 */
async function executeAction(action, user, context) {
  switch (action) {
    case 'BLOCK_ACCESS':
      // Access is blocked by throwing error in enforceProtocols
      break;
      
    case 'FORCE_CHANGE':
      // Set flag requiring password change
      if (user && user.id) {
        await run(
          `UPDATE users SET force_password_change = 1 WHERE id = ?`,
          [user.id]
        );
      }
      break;
      
    case 'TERMINATE_SESSION':
      // Terminate the session
      if (context.sessionId) {
        await run(
          `DELETE FROM user_sessions WHERE id = ?`,
          [context.sessionId]
        );
      }
      break;
      
    case 'BLOCK_LOGIN':
      // Prevent new session creation (handled by check)
      break;
      
    default:
      console.warn(`Unknown action: ${action}`);
  }
}

/**
 * Middleware to enforce protocols
 */
function protocolEnforcementMiddleware(req, res, next) {
  if (!req.user) {
    return next(); // Skip if not authenticated
  }
  
  const context = {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    sessionId: req.session?.id
  };
  
  enforceProtocols(req.user, context)
    .then(() => next())
    .catch(error => {
      res.status(error.statusCode || 403).json({
        error: error.message,
        violations: error.violations
      });
    });
}

/**
 * Check specific protocol
 */
async function checkProtocol(protocolName, user, context = {}) {
  const protocol = PROTOCOL_CHECKS[protocolName];
  
  if (!protocol) {
    throw new Error(`Unknown protocol: ${protocolName}`);
  }
  
  return await protocol.check(user, context);
}

/**
 * Get all protocol statuses for a user
 */
async function getProtocolStatus(user, context = {}) {
  const statuses = {};
  
  for (const [protocolName, config] of Object.entries(PROTOCOL_CHECKS)) {
    try {
      statuses[protocolName] = {
        passed: await config.check(user, context),
        message: config.message,
        severity: config.severity
      };
    } catch (error) {
      statuses[protocolName] = {
        passed: false,
        error: error.message
      };
    }
  }
  
  return statuses;
}

module.exports = {
  enforceProtocols,
  protocolEnforcementMiddleware,
  checkProtocol,
  getProtocolStatus,
  PROTOCOL_CHECKS
};
