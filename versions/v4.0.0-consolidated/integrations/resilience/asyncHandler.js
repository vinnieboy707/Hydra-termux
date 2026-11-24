// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/daugherty-INC
// Original path  : daugherty-INC/backend/src/middleware/asyncHandler.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

// Async handler wrapper to catch errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
