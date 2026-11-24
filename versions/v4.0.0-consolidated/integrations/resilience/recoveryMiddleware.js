// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/Assets-in-control-
// Original path  : Assets-in-control-/server/recoveryMiddleware.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

/**
 * Recovery Middleware - Wraps async functions with automatic error recovery
 * 
 * Usage:
 *   const { withRecovery } = require('./recoveryMiddleware');
 *   
 *   router.post('/wallets', withRecovery(async (req, res) => {
 *     // Your code here
 *   }));
 */

const errorRecovery = require('./errorRecovery');

/**
 * Wrap an async route handler with error recovery
 */
function withRecovery(handler, options = {}) {
  return async (req, res, next) => {
    const context = {
      method: req.method,
      path: req.path,
      body: req.body,
      params: req.params,
      query: req.query,
      ...options.context
    };

    const maxRetries = options.maxRetries || 2;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute the handler
        await handler(req, res, next);
        return; // Success - exit
      } catch (error) {
        lastError = error;
        
        console.log(`⚠️ Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);

        // If this is the last attempt, don't try recovery
        if (attempt >= maxRetries) {
          break;
        }

        // Attempt recovery
        const validationFn = options.validationFn || (async (ctx) => {
          // Default validation: just try the handler again
          try {
            await handler(req, res, next);
            return { success: true };
          } catch (e) {
            return { success: false, error: e };
          }
        });

        console.log(`🔧 Attempting automatic recovery...`);
        const recoveryResult = await errorRecovery.recover(error, context, validationFn);

        if (recoveryResult.recovered) {
          console.log(`✅ Recovered successfully with: ${recoveryResult.strategy}`);
          // Update context with recovered values
          Object.assign(context, recoveryResult.context);
          
          // Try again with updated context
          continue;
        } else if (recoveryResult.requiresManualIntervention) {
          console.error(`🚨 Manual intervention required`);
          
          if (!res.headersSent) {
            return res.status(500).json({
              error: 'Service temporarily unavailable',
              message: 'Multiple recovery attempts failed. Please try again later.',
              requiresManualIntervention: true,
              errorId: recoveryResult.errorId
            });
          }
          return;
        }
      }
    }

    // If we get here, all attempts failed
    console.error(`❌ All recovery attempts exhausted`);
    
    if (!res.headersSent) {
      return res.status(500).json({
        error: lastError.message || 'Internal server error',
        message: 'Unable to complete request after multiple attempts',
        attempts: maxRetries + 1
      });
    }
  };
}

/**
 * Wrap a promise-based function with error recovery
 */
async function withRecoveryAsync(fn, context = {}, validationFn = null) {
  const maxAttempts = 3;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn(context);
      return { success: true, result };
    } catch (error) {
      console.log(`⚠️ Operation failed (attempt ${attempt + 1}/${maxAttempts}):`, error.message);
      
      if (attempt >= maxAttempts - 1) {
        // Last attempt failed
        return { success: false, error: error.message };
      }
      
      // Attempt recovery
      const recoveryResult = await errorRecovery.recover(error, context, validationFn);
      
      if (recoveryResult.recovered) {
        console.log(`✅ Recovered with: ${recoveryResult.strategy}`);
        // Update context and try again
        Object.assign(context, recoveryResult.context);
        continue;
      } else {
        // Recovery failed, return error
        return {
          success: false,
          error: error.message,
          requiresManualIntervention: recoveryResult.requiresManualIntervention
        };
      }
    }
  }
  
  return { success: false, error: 'Max attempts exceeded' };
}

/**
 * Global error handler with recovery
 */
function errorRecoveryMiddleware(err, req, res, next) {
  console.error('Global error handler caught:', err);
  
  // Attempt recovery
  const context = {
    method: req.method,
    path: req.path,
    error: err.message
  };
  
  errorRecovery.recover(err, context).then(result => {
    if (result.recovered) {
      console.log('✅ Error recovered globally');
      // Don't send response if already sent
      if (!res.headersSent) {
        res.status(200).json({
          message: 'Request processed after recovery',
          recovered: true
        });
      }
    } else {
      if (!res.headersSent) {
        res.status(500).json({
          error: err.message || 'Internal server error',
          requiresManualIntervention: result.requiresManualIntervention
        });
      }
    }
  }).catch(recoveryError => {
    console.error('Recovery failed:', recoveryError);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Critical error occurred',
        message: err.message
      });
    }
  });
}

module.exports = {
  withRecovery,
  withRecoveryAsync,
  errorRecoveryMiddleware
};
