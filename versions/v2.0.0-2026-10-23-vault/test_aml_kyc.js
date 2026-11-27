/**
 * Test Suite for AML/KYC Validator Middleware
 */

const assert = require('assert');
const { AMLKYCValidator } = require('./src/aml_kyc_validator');

function runTests() {
  console.log('[Test] Starting AML/KYC validator tests...');
  const validator = new AMLKYCValidator();

  // Test transaction validation within limits
  const normalTx = { amountUsd: 500, customerTier: 'LOW', isSanctioned: false, isPep: false };
  const txRes1 = validator.validateTransaction(normalTx);
  assert.strictEqual(txRes1.approved, true, 'Normal transaction should pass compliance checks');

  // Test transaction exceeding single limit
  const largeTx = { amountUsd: 15000, customerTier: 'LOW', isSanctioned: false, isPep: false };
  const txRes2 = validator.validateTransaction(largeTx);
  assert.strictEqual(txRes2.approved, false, 'Large transaction should be blocked/flagged');

  console.log('[Test] All AML/KYC validator tests passed successfully.');
}

runTests();
