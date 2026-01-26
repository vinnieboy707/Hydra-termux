// Security Sanitization Utilities
// Comprehensive input sanitization and validation

const path = require('path');

/**
 * Sanitize file paths to prevent path traversal attacks
 * @param {string} userPath - User-provided path
 * @param {string} baseDir - Allowed base directory
 * @returns {string|null} Sanitized path or null if invalid
 */
function sanitizePath(userPath, baseDir) {
  if (!userPath || typeof userPath !== 'string') {
    return null;
  }

  // Remove any null bytes
  const cleanPath = userPath.replace(/\0/g, '');
  
  // Resolve to absolute path
  const resolvedPath = path.resolve(baseDir, cleanPath);
  const resolvedBase = path.resolve(baseDir);
  
  // Ensure the resolved path is within the base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    return null;
  }
  
  return resolvedPath;
}

/**
 * Sanitize filename to prevent directory traversal
 * @param {string} filename - User-provided filename
 * @returns {string|null} Sanitized filename or null if invalid
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return null;
  }
  
  // Remove path separators and null bytes
  const cleaned = filename.replace(/[/\\.\0]/g, '_');
  
  // Remove leading/trailing whitespace
  const trimmed = cleaned.trim();
  
  // Ensure filename is not empty and doesn't start with a dot
  if (!trimmed || trimmed.startsWith('_')) {
    return null;
  }
  
  return trimmed;
}

/**
 * Sanitize log messages to prevent log injection
 * @param {string} message - Log message
 * @returns {string} Sanitized message
 */
function sanitizeLogMessage(message) {
  if (typeof message !== 'string') {
    return String(message);
  }
  
  // Remove newlines, carriage returns, and control characters
  return message
    .replace(/[\n\r]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize error messages for user display (prevent stack trace exposure)
 * @param {Error|string} error - Error object or message
 * @returns {string} Safe error message
 */
function sanitizeError(error) {
  if (error instanceof Error) {
    // Only return the message, not the stack trace
    return error.message || 'An error occurred';
  }
  
  if (typeof error === 'string') {
    // Remove any stack trace patterns
    return error.split('\n')[0].trim();
  }
  
  return 'An error occurred';
}

/**
 * Validate IP address format
 * @param {string} ip - IP address
 * @returns {boolean} True if valid
 */
function isValidIP(ip) {
  if (typeof ip !== 'string') return false;
  
  // IPv4 validation
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }
  
  // IPv6 validation (basic)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
  return ipv6Pattern.test(ip);
}

/**
 * Validate and sanitize 2FA token
 * @param {string} token - 2FA token
 * @returns {string|null} Sanitized token or null if invalid
 */
function sanitize2FAToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  // 2FA tokens should be 6 digits
  const cleaned = token.replace(/\D/g, '');
  
  if (cleaned.length !== 6) {
    return null;
  }
  
  return cleaned;
}

/**
 * Check if 2FA verification is required and valid
 * @param {object} user - User object with twofa_enabled
 * @param {string} providedToken - Token provided by user
 * @returns {object} {required: boolean, valid: boolean, reason: string}
 */
function check2FARequirement(user, providedToken) {
  if (!user) {
    return { required: false, valid: false, reason: 'No user' };
  }
  
  // Always check if 2FA is enabled on the user object
  const is2FAEnabled = Boolean(user.twofa_enabled);
  
  if (!is2FAEnabled) {
    return { required: false, valid: true, reason: '2FA not enabled' };
  }
  
  // 2FA is enabled, token must be provided
  if (!providedToken) {
    return { required: true, valid: false, reason: '2FA token required' };
  }
  
  return { required: true, valid: true, reason: 'Token provided' };
}

module.exports = {
  sanitizePath,
  sanitizeFilename,
  sanitizeLogMessage,
  sanitizeError,
  isValidIP,
  sanitize2FAToken,
  check2FARequirement
};
