// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/Assets-in-control-
// Original path  : Assets-in-control-/server/rateLimiter.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints
 * Stricter limits to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for general API endpoints
 * More lenient for regular API usage
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for export endpoints
 * Moderate limits to prevent abuse
 */
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 export requests per windowMs
  message: {
    error: 'Too many export requests, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  apiLimiter,
  exportLimiter
};
