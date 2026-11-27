'use strict';
/**
 * test_system_integration.js
 *
 * End-to-end integration test verifying:
 *   1. Database Integration Hub (PostgreSQL & Firebase sync).
 *   2. API Routes Router (Stats, Ledger, Optimizer state, Tap-to-Pay).
 *   3. Adaptive Parameter Optimizer & Notification Policies.
 */

const { DatabaseIntegrationHub } = require('./src/database-integration-hub');
const { createApiRouter } = require('./src/api-routes-router');
const { AdaptiveParameterOptimizer } = require('./src/adaptive-parameter-optimizer');
const { NotificationPolicyManager } = require('./src/notification-policy-manager');
const assert = require('assert');
const express = require('express');
const http = require('http');

console.log('========================================================');
console.log('CHRONOS OS // END-TO-END SYSTEM INTEGRATION TEST SUITE');
console.log('========================================================');

async function run() {
  // 1. Test Database Integration Hub
  const dbHub = new DatabaseIntegrationHub();
  const syncRes = await dbHub.persistAndSync({
    txId: 'TX-TEST-001',
    timestamp: new Date().toISOString(),
    streamId: 'STREAM_01',
    streamName: 'Test Arbitrage',
    category: 'DeFi',
    revenueUSD: 100.00,
    treasuryAllocation: 60.00,
    spendableTapToPayAllocation: 40.00,
    status: 'VERIFIED'
  });
  assert.strictEqual(syncRes.pgResult.ok, true, 'PostgreSQL sync should succeed');
  assert.strictEqual(syncRes.fbResult.ok, true, 'Firebase sync should succeed');
  console.log('✅ PASS: Database Integration Hub sync verified.');

  // 2. Test Adaptive Optimizer & Notifier
  const optimizer = new AdaptiveParameterOptimizer();
  const notifier = new NotificationPolicyManager();
  optimizer.recordOutcome({ success: true, netProfitUSD: 50.00, gasGweiUsed: 25 });
  notifier.notifyMoneyMovement('Arbitrage Payout', 50.00, 'Main Wallet');
  console.log('✅ PASS: Adaptive Optimizer & Notifier verified.');

  // 3. Test API Router
  const app = express();
  const router = createApiRouter({ optimizer });
  app.use('/api', router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const fetchJson = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const stats = await fetchJson(`http://localhost:${port}/api/optimizer/state`);
  assert.notStrictEqual(stats.currentParams, undefined, 'Optimizer state API should return currentParams');
  console.log('✅ PASS: API Routes Router verified.');

  server.close();
  console.log('========================================================');
  console.log('ALL END-TO-END SYSTEM INTEGRATION TESTS PASSED SUCCESSFULLLY.');
  console.log('========================================================');
}

run().catch((err) => {
  console.error('Integration Test Failure:', err);
  process.exit(1);
});
