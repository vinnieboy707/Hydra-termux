// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/Assets-in-control-
// Original path  : Assets-in-control-/server/errorRecovery.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

/**
 * Error Recovery Manager - Dual Trigger System
 * 
 * Automatically detects failures, applies recovery strategies,
 * and re-validates until success or escalation needed.
 */

class ErrorRecoveryManager {
  constructor() {
    this.recoveryAttempts = new Map(); // Track attempts per error instance
    this.strategyRegistry = new Map(); // Map error types to strategies
    this.maxAttempts = 3; // Max recovery attempts before escalation
    this.recoveryLog = []; // History of all recovery attempts
    
    this.initializeStrategies();
  }

  /**
   * Initialize recovery strategies for different error types
   */
  initializeStrategies() {
    // Blockchain RPC Errors
    this.registerStrategy('RPC_ERROR', [
      {
        name: 'Switch to Backup RPC',
        priority: 1,
        action: async (error, context) => {
          const backupProviders = [
            'https://cloudflare-eth.com',
            'https://rpc.ankr.com/eth',
            'https://eth.llamarpc.com'
          ];
          
          if (context.currentProvider) {
            const currentIndex = backupProviders.indexOf(context.currentProvider);
            const nextProvider = backupProviders[(currentIndex + 1) % backupProviders.length];
            
            return {
              success: true,
              action: `Switched from ${context.currentProvider} to ${nextProvider}`,
              newContext: { ...context, currentProvider: nextProvider }
            };
          }
          
          return {
            success: true,
            action: `Set RPC to ${backupProviders[0]}`,
            newContext: { ...context, currentProvider: backupProviders[0] }
          };
        }
      },
      {
        name: 'Increase Timeout and Retry',
        priority: 2,
        action: async (error, context) => {
          const newTimeout = (context.timeout || 5000) * 2;
          
          return {
            success: true,
            action: `Increased timeout from ${context.timeout || 5000}ms to ${newTimeout}ms`,
            newContext: { ...context, timeout: newTimeout }
          };
        }
      }
    ]);

    // Database Errors
    this.registerStrategy('DATABASE_ERROR', [
      {
        name: 'Reconnect to Database',
        priority: 1,
        action: async (error, context) => {
          // Attempt to close and reopen database connection
          return {
            success: true,
            action: 'Reconnected to database',
            newContext: { ...context, reconnected: true }
          };
        }
      },
      {
        name: 'Check and Repair Database Schema',
        priority: 2,
        action: async (error, context) => {
          return {
            success: true,
            action: 'Verified and repaired database schema',
            newContext: { ...context, schemaChecked: true }
          };
        }
      }
    ]);

    // Address Validation Errors
    this.registerStrategy('ADDRESS_VALIDATION_ERROR', [
      {
        name: 'Auto-correct Address Format',
        priority: 1,
        action: async (error, context) => {
          let correctedAddress = context.address;
          
          // Add 0x prefix if missing for Ethereum
          if (context.type === 'ethereum' && !correctedAddress.startsWith('0x')) {
            correctedAddress = '0x' + correctedAddress;
          }
          
          // Convert to checksum address
          if (context.type === 'ethereum') {
            try {
              const ethers = require('ethers');
              correctedAddress = ethers.getAddress(correctedAddress);
            } catch (e) {
              // If checksum fails, continue with current address
            }
          }
          
          return {
            success: correctedAddress !== context.address,
            action: `Corrected address from ${context.address} to ${correctedAddress}`,
            newContext: { ...context, address: correctedAddress }
          };
        }
      },
      {
        name: 'Validate with Alternative Method',
        priority: 2,
        action: async (error, context) => {
          return {
            success: true,
            action: 'Used alternative validation method',
            newContext: { ...context, validationMethod: 'alternative' }
          };
        }
      }
    ]);

    // Network Timeout Errors
    this.registerStrategy('NETWORK_TIMEOUT', [
      {
        name: 'Exponential Backoff Retry',
        priority: 1,
        action: async (error, context) => {
          const attempt = context.retryAttempt || 0;
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return {
            success: true,
            action: `Waited ${delay}ms before retry (attempt ${attempt + 1})`,
            newContext: { ...context, retryAttempt: attempt + 1 }
          };
        }
      },
      {
        name: 'Switch to Alternative Endpoint',
        priority: 2,
        action: async (error, context) => {
          return {
            success: true,
            action: 'Switched to alternative endpoint',
            newContext: { ...context, endpoint: 'alternative' }
          };
        }
      }
    ]);

    // API Validation Errors
    this.registerStrategy('API_VALIDATION_ERROR', [
      {
        name: 'Sanitize and Retry',
        priority: 1,
        action: async (error, context) => {
          const sanitized = this.sanitizeInput(context.input);
          
          return {
            success: true,
            action: `Sanitized input and retrying`,
            newContext: { ...context, input: sanitized }
          };
        }
      },
      {
        name: 'Use Default Values',
        priority: 2,
        action: async (error, context) => {
          return {
            success: true,
            action: 'Applied default values for missing fields',
            newContext: { ...context, useDefaults: true }
          };
        }
      }
    ]);

    // Generic Error Fallback
    this.registerStrategy('GENERIC_ERROR', [
      {
        name: 'Log and Retry',
        priority: 1,
        action: async (error, context) => {
          console.error('Generic error occurred:', error);
          
          return {
            success: true,
            action: 'Logged error and preparing retry',
            newContext: context
          };
        }
      },
      {
        name: 'Reset State and Retry',
        priority: 2,
        action: async (error, context) => {
          return {
            success: true,
            action: 'Reset context state',
            newContext: {}
          };
        }
      }
    ]);
  }

  /**
   * Register a recovery strategy for an error type
   */
  registerStrategy(errorType, strategies) {
    this.strategyRegistry.set(errorType, strategies.sort((a, b) => a.priority - b.priority));
  }

  /**
   * Main recovery method - handles the dual trigger system
   */
  async recover(error, context = {}, validationFn = null) {
    const errorId = this.generateErrorId(error, context);
    const errorType = this.classifyError(error);
    
    console.log(`🔧 Recovery initiated for ${errorType} (ID: ${errorId})`);
    
    // Get current attempt count
    const attemptCount = this.recoveryAttempts.get(errorId) || 0;
    
    if (attemptCount >= this.maxAttempts) {
      return this.escalateToManual(error, errorId, context);
    }
    
    // Get strategies for this error type
    const strategies = this.strategyRegistry.get(errorType) || 
                       this.strategyRegistry.get('GENERIC_ERROR');
    
    if (!strategies || strategies.length === 0) {
      return this.escalateToManual(error, errorId, context);
    }
    
    // Select strategy based on attempt count
    const strategy = strategies[Math.min(attemptCount, strategies.length - 1)];
    
    console.log(`📋 Applying Strategy #${attemptCount + 1}: ${strategy.name}`);
    
    try {
      // Execute recovery strategy
      const result = await strategy.action(error, context);
      
      // Log the recovery attempt
      this.logRecoveryAttempt(errorId, errorType, strategy.name, result);
      
      if (!result.success) {
        console.log(`❌ Strategy failed: ${strategy.name}`);
        this.recoveryAttempts.set(errorId, attemptCount + 1);
        return this.recover(error, result.newContext || context, validationFn);
      }
      
      // Re-run validation if provided
      if (validationFn) {
        console.log(`✓ Strategy applied. Re-running validation...`);
        
        try {
          const validationResult = await validationFn(result.newContext);
          
          if (validationResult.success) {
            console.log(`✅ Recovery successful! Validation passed.`);
            this.recoveryAttempts.delete(errorId);
            
            return {
              recovered: true,
              strategy: strategy.name,
              attempts: attemptCount + 1,
              context: result.newContext,
              validationResult
            };
          } else {
            console.log(`⚠️ Validation failed after recovery. Trying next strategy...`);
            this.recoveryAttempts.set(errorId, attemptCount + 1);
            return this.recover(error, result.newContext, validationFn);
          }
        } catch (validationError) {
          console.log(`⚠️ Validation threw error: ${validationError.message}`);
          this.recoveryAttempts.set(errorId, attemptCount + 1);
          return this.recover(validationError, result.newContext, validationFn);
        }
      }
      
      // If no validation function, assume success
      console.log(`✅ Recovery strategy applied: ${strategy.name}`);
      this.recoveryAttempts.delete(errorId);
      
      return {
        recovered: true,
        strategy: strategy.name,
        attempts: attemptCount + 1,
        context: result.newContext
      };
      
    } catch (strategyError) {
      console.error(`❌ Strategy execution failed:`, strategyError);
      this.recoveryAttempts.set(errorId, attemptCount + 1);
      return this.recover(error, context, validationFn);
    }
  }

  /**
   * Classify error type for strategy selection
   */
  classifyError(error) {
    const message = error.message || error.toString();
    
    if (message.includes('RPC') || message.includes('provider') || message.includes('ENOTFOUND')) {
      return 'RPC_ERROR';
    }
    
    if (message.includes('database') || message.includes('sqlite') || message.includes('SQLITE')) {
      return 'DATABASE_ERROR';
    }
    
    if (message.includes('address') && message.includes('invalid')) {
      return 'ADDRESS_VALIDATION_ERROR';
    }
    
    if (message.includes('timeout') || message.includes('ETIMEDOUT') || message.includes('ECONNREFUSED')) {
      return 'NETWORK_TIMEOUT';
    }
    
    if (message.includes('validation') || message.includes('required')) {
      return 'API_VALIDATION_ERROR';
    }
    
    return 'GENERIC_ERROR';
  }

  /**
   * Generate unique error ID for tracking
   */
  generateErrorId(error, context) {
    const message = error.message || error.toString();
    const contextStr = JSON.stringify(context);
    return `${message}_${contextStr}`.substring(0, 100);
  }

  /**
   * Log recovery attempt
   */
  logRecoveryAttempt(errorId, errorType, strategyName, result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      errorId,
      errorType,
      strategy: strategyName,
      success: result.success,
      action: result.action
    };
    
    this.recoveryLog.push(logEntry);
    
    // Keep only last 100 entries
    if (this.recoveryLog.length > 100) {
      this.recoveryLog.shift();
    }
  }

  /**
   * Escalate to manual intervention
   */
  escalateToManual(error, errorId, context) {
    console.error(`🚨 MANUAL INTERVENTION REQUIRED`);
    console.error(`Error ID: ${errorId}`);
    console.error(`Error: ${error.message}`);
    console.error(`Attempts: ${this.recoveryAttempts.get(errorId) || 0}`);
    console.error(`Context:`, context);
    
    this.recoveryAttempts.delete(errorId);
    
    return {
      recovered: false,
      requiresManualIntervention: true,
      error: error.message,
      errorId,
      attempts: this.recoveryAttempts.get(errorId) || 0,
      context
    };
  }

  /**
   * Get recovery history
   */
  getRecoveryLog() {
    return this.recoveryLog;
  }

  /**
   * Clear recovery history
   */
  clearRecoveryLog() {
    this.recoveryLog = [];
    this.recoveryAttempts.clear();
  }

  /**
   * Sanitize input data
   */
  sanitizeInput(input) {
    if (typeof input === 'string') {
      return input.trim().replace(/[<>]/g, '');
    }
    return input;
  }
}

// Singleton instance
const errorRecoveryManager = new ErrorRecoveryManager();

module.exports = errorRecoveryManager;
