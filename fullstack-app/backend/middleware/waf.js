// Web Application Firewall Middleware
// Implements WAF rules from SECURITY_PROTOCOLS.md Section 4.3

const { run } = require('../database');

// Attack patterns to detect and block
const WAF_PATTERNS = {
  sqlInjection: {
    patterns: [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bSELECT\b.*\bFROM\b.*\bWHERE\b)/i,
      /(\bINSERT\b.*\bINTO\b.*\bVALUES\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bDROP\b.*\b(TABLE|DATABASE)\b)/i,
      /(--|\#|\/\*|\*\/)/,
      /(\bOR\b.*=.*)/i,
      /('.*OR.*'.*=.*')/i
    ],
    severity: 'CRITICAL',
    action: 'BLOCK'
  },
  
  xss: {
    patterns: [
      /<script[\s\S]*?<\/script\s*>/gi,  // Fixed: Match script end tags with optional spaces
      /<iframe[\s\S]*?<\/iframe\s*>/gi,  // Fixed: Match iframe end tags with optional spaces
      /<object[\s\S]*?<\/object\s*>/gi,  // Fixed: Match object end tags with optional spaces
      /<embed[^>]*>/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /javascript:/gi,
      /<img[^>]*onerror/gi
    ],
    severity: 'HIGH',
    action: 'BLOCK'
  },
  
  commandInjection: {
    patterns: [
      /[;&|`$(){}[\]<>]/,
      /\$\(.*\)/,
      /`.*`/,
      /\|.*\|/,
      /&&/,
      /\|\|/
    ],
    severity: 'CRITICAL',
    action: 'BLOCK'
  },
  
  pathTraversal: {
    patterns: [
      /\.\.[\/\\]/,
      /%2e%2e[\/\\]/i,
      /\.\.%2f/i,
      /\.\.%5c/i,
      /%252e%252e/i
    ],
    severity: 'HIGH',
    action: 'BLOCK'
  },
  
  xxe: {
    patterns: [
      /<!ENTITY/i,
      /<!DOCTYPE.*\[/i,
      /SYSTEM.*["']/i
    ],
    severity: 'HIGH',
    action: 'BLOCK'
  },
  
  ldapInjection: {
    patterns: [
      /\(\|/,
      /\(&/,
      /\(!/,
      /\*\)/,
      /\)\(/
    ],
    severity: 'HIGH',
    action: 'BLOCK'
  },
  
  noSqlInjection: {
    patterns: [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$regex/i
    ],
    severity: 'HIGH',
    action: 'BLOCK'
  }
};

// Rate limiting for WAF violations
const violationCounts = new Map();
const VIOLATION_THRESHOLD = 10; // Block after 10 violations
const VIOLATION_WINDOW = 3600000; // 1 hour

/**
 * Check a value against attack patterns
 * @param {string} value - Value to check
 * @returns {Object|null} Attack details if detected, null otherwise
 */
function detectAttack(value) {
  if (typeof value !== 'string') {
    return null;
  }
  
  for (const [attackType, config] of Object.entries(WAF_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(value)) {
        return {
          type: attackType,
          pattern: pattern.toString(),
          value: value.substring(0, 100), // Truncate for logging
          severity: config.severity,
          action: config.action
        };
      }
    }
  }
  
  return null;
}

/**
 * Check all request inputs for attacks
 * @param {Object} req - Express request object
 * @returns {Object|null} Attack details if detected
 */
function checkRequest(req) {
  const inputs = [];
  
  // Collect all inputs
  if (req.query) {
    inputs.push(...Object.entries(req.query).map(([key, val]) => ({ source: 'query', key, value: val })));
  }
  
  if (req.body) {
    inputs.push(...collectBodyInputs(req.body, 'body'));
  }
  
  if (req.params) {
    inputs.push(...Object.entries(req.params).map(([key, val]) => ({ source: 'params', key, value: val })));
  }
  
  if (req.headers) {
    // Check specific headers
    const headersToCheck = ['user-agent', 'referer', 'x-forwarded-for'];
    for (const header of headersToCheck) {
      if (req.headers[header]) {
        inputs.push({ source: 'headers', key: header, value: req.headers[header] });
      }
    }
  }
  
  // Check each input
  for (const input of inputs) {
    const attack = detectAttack(input.value);
    if (attack) {
      return {
        ...attack,
        source: input.source,
        key: input.key
      };
    }
  }
  
  return null;
}

/**
 * Recursively collect inputs from body object
 */
function collectBodyInputs(obj, prefix = '') {
  const inputs = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      inputs.push({ source: 'body', key: fullKey, value });
    } else if (typeof value === 'object' && value !== null) {
      inputs.push(...collectBodyInputs(value, fullKey));
    }
  }
  
  return inputs;
}

/**
 * Log WAF event
 */
async function logWAFEvent(req, attack) {
  try {
    await run(
      `INSERT INTO security_events (user_id, event_type, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        'waf_blocked',
        JSON.stringify({
          attack: attack.type,
          source: attack.source,
          key: attack.key,
          pattern: attack.pattern,
          severity: attack.severity,
          url: req.originalUrl,
          method: req.method
        }),
        req.ip || req.connection.remoteAddress,
        req.headers['user-agent']
      ]
    );
  } catch (error) {
    console.error('Failed to log WAF event:', error);
  }
}

/**
 * Track violations per IP
 */
function trackViolation(ip) {
  const now = Date.now();
  
  if (!violationCounts.has(ip)) {
    violationCounts.set(ip, []);
  }
  
  const violations = violationCounts.get(ip);
  
  // Remove old violations outside window
  const recentViolations = violations.filter(timestamp => now - timestamp < VIOLATION_WINDOW);
  recentViolations.push(now);
  
  violationCounts.set(ip, recentViolations);
  
  return recentViolations.length;
}

/**
 * Check if IP is blocked
 */
function isIPBlocked(ip) {
  const violations = violationCounts.get(ip) || [];
  const now = Date.now();
  
  const recentViolations = violations.filter(timestamp => now - timestamp < VIOLATION_WINDOW);
  
  return recentViolations.length >= VIOLATION_THRESHOLD;
}

/**
 * WAF Middleware
 */
function wafMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Check if IP is already blocked
  if (isIPBlocked(ip)) {
    return res.status(403).json({
      error: 'Access denied',
      reason: 'Too many security violations',
      blockedUntil: new Date(Date.now() + VIOLATION_WINDOW).toISOString()
    });
  }
  
  // Check request for attacks
  const attack = checkRequest(req);
  
  if (attack) {
    // Track violation
    const violationCount = trackViolation(ip);
    
    // Log the event
    logWAFEvent(req, attack);
    
    // Return error response
    return res.status(400).json({
      error: 'Potentially malicious input detected',
      type: attack.type,
      severity: attack.severity,
      message: 'Your request has been blocked by our Web Application Firewall',
      violationCount,
      warning: violationCount >= VIOLATION_THRESHOLD - 3 ? 
        `You have ${VIOLATION_THRESHOLD - violationCount} attempts remaining before temporary block` : 
        undefined
    });
  }
  
  next();
}

/**
 * Get WAF statistics
 */
function getWAFStats() {
  const stats = {
    totalIPsTracked: violationCounts.size,
    blockedIPs: 0,
    recentViolations: 0
  };
  
  const now = Date.now();
  
  for (const [ip, violations] of violationCounts.entries()) {
    const recent = violations.filter(t => now - t < VIOLATION_WINDOW);
    
    if (recent.length >= VIOLATION_THRESHOLD) {
      stats.blockedIPs++;
    }
    
    stats.recentViolations += recent.length;
  }
  
  return stats;
}

/**
 * Unblock an IP (admin function)
 */
function unblockIP(ip) {
  violationCounts.delete(ip);
}

module.exports = {
  wafMiddleware,
  detectAttack,
  getWAFStats,
  unblockIP,
  WAF_PATTERNS
};
