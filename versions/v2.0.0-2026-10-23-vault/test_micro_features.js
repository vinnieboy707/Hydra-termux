/**
 * Test Suite for Premium Micro-Features
 * Validates ResourceGovernor, HealthTelemetry, and LedgerVerifier.
 */

const assert = require('assert');
const { ResourceGovernor } = require('./src/resource_governor');
const { HealthTelemetry } = require('./src/health_telemetry');
const { LedgerVerifier } = require('./src/ledger_verifier');

async function runTests() {
  console.log('[Test] Starting micro-features test suite...');

  // 1. Test ResourceGovernor
  const governor = new ResourceGovernor({ heapLimitMb: 1024, rssLimitMb: 2048 });
  governor.start();
  const govStatus = governor.evaluate();
  assert.strictEqual(govStatus.status, 'healthy', 'ResourceGovernor should report healthy status under limits');
  governor.stop();
  console.log('[Test] ResourceGovernor test passed.');

  // 2. Test HealthTelemetry
  const telemetry = new HealthTelemetry('test-service');
  const report = telemetry.generateReport();
  assert.strictEqual(report.service, 'test-service', 'Telemetry service name should match');
  assert.ok(report.correlationId, 'Telemetry should include a correlation ID');
  assert.strictEqual(report.status, 'GREEN', 'Telemetry status should be GREEN');
  console.log('[Test] HealthTelemetry test passed.');

  // 3. Test LedgerVerifier
  const verifier = new LedgerVerifier('unified_financial_ledger.wal');
  const integrity = verifier.verifyIntegrity();
  assert.ok(typeof integrity.valid === 'boolean', 'LedgerVerifier should return validation result');
  console.log('[Test] LedgerVerifier test passed. Result:', integrity);

  console.log('[Test] All micro-features test suites passed successfully.');
}

runTests().catch((err) => {
  console.error('[Test] Test suite failed:', err);
  process.exit(1);
});
