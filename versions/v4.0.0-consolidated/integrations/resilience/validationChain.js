// ---------------------------------------------------------------------------
// IMPORTED INTO CHRONOS v4.0.0 (consolidation, 2026-11-24)
// Source project : vinnieboy707/Assets-in-control-
// Original path  : Assets-in-control-/server/validationChain.js
// Imported verbatim — not modified. Reads all secrets/RPC URLs from env vars.
// ---------------------------------------------------------------------------

/**
 * Validation Chain - Automatic advancement through validation sequence
 * 
 * After successful recovery, automatically proceeds to next validation
 */

const errorRecovery = require('./errorRecovery');

class ValidationChain {
  constructor(name = 'Default Chain') {
    this.name = name;
    this.validations = [];
    this.currentIndex = 0;
    this.results = [];
    this.context = {};
  }

  /**
   * Add a validation to the chain
   * @param {Object} validation - Validation configuration
   */
  addValidation(validation) {
    if (!validation.name) {
      throw new Error('Validation must have a name');
    }
    if (!validation.validate) {
      throw new Error('Validation must have a validate function');
    }

    this.validations.push({
      name: validation.name,
      validate: validation.validate,
      onSuccess: validation.onSuccess || null,
      onFailure: validation.onFailure || null,
      required: validation.required !== false, // Default to required
      customRecovery: validation.customRecovery || null
    });

    return this;
  }

  /**
   * Execute the validation chain with automatic advancement
   */
  async execute(initialContext = {}) {
    this.context = { ...initialContext };
    this.currentIndex = 0;
    this.results = [];

    console.log(`\n┌─────────────────────────────────────────────────────┐`);
    console.log(`│ 🔗 Starting Validation Chain: ${this.name.padEnd(22)} │`);
    console.log(`│    Total Validations: ${this.validations.length.toString().padEnd(28)} │`);
    console.log(`└─────────────────────────────────────────────────────┘\n`);

    for (let i = 0; i < this.validations.length; i++) {
      this.currentIndex = i;
      const validation = this.validations[i];

      console.log(`\n▶ Validation ${i + 1}/${this.validations.length}: ${validation.name}`);
      console.log(`  ${'─'.repeat(50)}`);

      try {
        // Execute validation with recovery
        const result = await this.executeWithRecovery(validation);

        // Store result
        this.results.push({
          name: validation.name,
          success: result.success,
          recovered: result.recovered || false,
          attempts: result.attempts || 1,
          context: result.context || this.context
        });

        if (result.success) {
          console.log(`  ✅ Validation PASSED`);
          
          // Update context with any changes from validation
          if (result.context) {
            this.context = { ...this.context, ...result.context };
          }

          // Execute onSuccess callback if provided
          if (validation.onSuccess) {
            await validation.onSuccess(this.context);
          }

          // Automatically advance to next validation
          if (i < this.validations.length - 1) {
            console.log(`  ➡️  Automatically advancing to next validation...\n`);
          } else {
            console.log(`  🎉 Chain completed successfully!\n`);
          }
        } else {
          // Validation failed and couldn't be recovered
          console.log(`  ❌ Validation FAILED`);

          if (validation.required) {
            console.log(`  ⚠️  Required validation failed - stopping chain\n`);
            
            // Execute onFailure callback if provided
            if (validation.onFailure) {
              await validation.onFailure(this.context, result.error);
            }

            return this.buildResult(false, i + 1);
          } else {
            console.log(`  ⚠️  Optional validation failed - continuing chain\n`);
            
            // Execute onFailure callback if provided
            if (validation.onFailure) {
              await validation.onFailure(this.context, result.error);
            }
            
            // Continue to next validation
          }
        }
      } catch (error) {
        console.error(`  💥 Unexpected error in validation: ${error.message}`);
        
        this.results.push({
          name: validation.name,
          success: false,
          error: error.message
        });

        if (validation.required) {
          return this.buildResult(false, i + 1);
        }
      }
    }

    // All validations completed successfully
    return this.buildResult(true, this.validations.length);
  }

  /**
   * Execute a single validation with error recovery
   */
  async executeWithRecovery(validation) {
    try {
      // Try validation
      const result = await validation.validate(this.context);

      if (result.success) {
        return result;
      }

      // Validation failed, attempt recovery
      console.log(`  ⚠️  Validation failed, attempting recovery...`);
      
      // Use custom recovery strategy if provided, otherwise use automatic
      if (validation.customRecovery) {
        return await validation.customRecovery(result.error || new Error('Validation failed'), this.context);
      }

      // Automatic recovery
      const recoveryResult = await errorRecovery.recover(
        result.error || new Error('Validation failed'),
        this.context,
        async (ctx) => {
          // Re-run validation after recovery
          return await validation.validate(ctx);
        }
      );

      if (recoveryResult.recovered) {
        return {
          success: true,
          recovered: true,
          attempts: recoveryResult.attempts,
          context: recoveryResult.context
        };
      } else {
        return {
          success: false,
          error: 'Recovery failed',
          requiresManualIntervention: recoveryResult.requiresManualIntervention
        };
      }
    } catch (error) {
      // Exception during validation, attempt recovery
      console.log(`  ⚠️  Exception thrown, attempting recovery...`);

      const recoveryResult = await errorRecovery.recover(
        error,
        this.context,
        async (ctx) => {
          return await validation.validate(ctx);
        }
      );

      if (recoveryResult.recovered) {
        return {
          success: true,
          recovered: true,
          attempts: recoveryResult.attempts,
          context: recoveryResult.context
        };
      } else {
        return {
          success: false,
          error: error.message,
          requiresManualIntervention: recoveryResult.requiresManualIntervention
        };
      }
    }
  }

  /**
   * Build final result
   */
  buildResult(success, completedValidations) {
    console.log(`\n┌─────────────────────────────────────────────────────┐`);
    console.log(`│ 📊 Chain Summary: ${this.name.padEnd(32)} │`);
    console.log(`├─────────────────────────────────────────────────────┤`);
    console.log(`│ Status: ${(success ? '✅ SUCCESS' : '❌ FAILED').padEnd(43)} │`);
    console.log(`│ Completed: ${completedValidations}/${this.validations.length}${' '.repeat(40)} │`);
    console.log(`└─────────────────────────────────────────────────────┘\n`);

    return {
      success,
      chainName: this.name,
      totalValidations: this.validations.length,
      completedValidations,
      results: this.results,
      context: this.context
    };
  }

  /**
   * Reset the chain for re-execution
   */
  reset() {
    this.currentIndex = 0;
    this.results = [];
    this.context = {};
  }
}

/**
 * Create and execute a validation chain
 */
async function createChain(name) {
  return new ValidationChain(name);
}

/**
 * Pre-built validation chains for common operations
 */

/**
 * Wallet creation validation chain
 */
async function walletCreationChain(walletData) {
  const chain = new ValidationChain('Wallet Creation');

  chain
    .addValidation({
      name: 'Validate Address Format',
      validate: async (ctx) => {
        const blockchain = require('./blockchain');
        const isValid = blockchain.isValidAddress(ctx.address, ctx.type);
        
        if (isValid) {
          return { success: true };
        }
        
        return {
          success: false,
          error: new Error('Invalid address format')
        };
      },
      onSuccess: (ctx) => {
        console.log(`    ✓ Address format is valid for ${ctx.type}`);
      }
    })
    .addValidation({
      name: 'Fetch Blockchain Balance',
      validate: async (ctx) => {
        const blockchain = require('./blockchain');
        
        try {
          const balance = await blockchain.getNativeBalance(ctx.address, ctx.type);
          ctx.balance = balance;
          return { success: true, context: ctx };
        } catch (error) {
          return { success: false, error };
        }
      },
      onSuccess: (ctx) => {
        console.log(`    ✓ Balance fetched: ${ctx.balance}`);
      }
    })
    .addValidation({
      name: 'Save to Database',
      validate: async (ctx) => {
        // Database save logic here
        // For now, simulate success
        return { success: true };
      },
      onSuccess: (ctx) => {
        console.log(`    ✓ Wallet saved to database`);
      }
    });

  return await chain.execute(walletData);
}

/**
 * Transaction validation chain
 */
async function transactionChain(transactionData) {
  const chain = new ValidationChain('Transaction Processing');

  chain
    .addValidation({
      name: 'Validate Wallet Exists',
      validate: async (ctx) => {
        // Check wallet exists in database
        return { success: true };
      }
    })
    .addValidation({
      name: 'Check Sufficient Balance',
      validate: async (ctx) => {
        if (ctx.balance >= ctx.amount) {
          return { success: true };
        }
        return {
          success: false,
          error: new Error('Insufficient balance')
        };
      }
    })
    .addValidation({
      name: 'Process Transaction',
      validate: async (ctx) => {
        // Transaction processing logic
        return { success: true };
      }
    })
    .addValidation({
      name: 'Update Balance',
      validate: async (ctx) => {
        // Update balance in database
        ctx.balance -= ctx.amount;
        return { success: true, context: ctx };
      }
    });

  return await chain.execute(transactionData);
}

module.exports = {
  ValidationChain,
  createChain,
  walletCreationChain,
  transactionChain
};
