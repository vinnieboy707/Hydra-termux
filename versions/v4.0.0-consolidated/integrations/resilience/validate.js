// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/daugherty-INC
// Original path  : daugherty-INC/backend/src/middleware/validate.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  
  next();
};

module.exports = validate;
