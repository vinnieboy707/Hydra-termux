'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ingestVerifiedTransaction } = require('./revenue_engine_247');

function runRevenueTests() {
  console.log('[Revenue Test] Starting revenue engine & hash chaining & compounding tests...');

  const ledgerPath = path.resolve(__dirname, 'unified_financial_ledger.wal');
  // Back up existing ledger if any
  let backup = null;
  if (fs.existsSync(ledgerPath)) {
    backup = fs.readFileSync(ledgerPath);
  }
  fs.writeFileSync(ledgerPath, '');

  try {
    // Ingest transaction 1
    ingestVerifiedTransaction({
      txId: 'TX-TEST-001',
      streamId: 'STREAM_01',
      streamName: 'Micro-Arbitrage',
      category: 'DeFi',
      revenueUSD: 100.00
    });

    // Ingest transaction 2
    ingestVerifiedTransaction({
      txId: 'TX-TEST-002',
      streamId: 'STREAM_02',
      streamName: 'SaaS',
      category: 'Enterprise',
      revenueUSD: 200.00
    });

    const content = fs.readFileSync(ledgerPath, 'utf8').trim();
    const lines = content.split('\n');
    assert.strictEqual(lines.length, 2, 'Should have exactly 2 ledger entries');

    const entry1 = JSON.parse(lines[0]);
    const entry2 = JSON.parse(lines[1]);

    assert.strictEqual(entry1.baseRevenueUSD, 100);
    assert.ok(entry1.revenueUSD > 100, 'Compounded revenue should be greater than base revenue');
    assert.ok(entry1.hash, 'Entry 1 must have a cryptographic hash');
    assert.strictEqual(entry1.previousHash, '0'.repeat(64), 'First entry previousHash should be 64 zeros');

    assert.strictEqual(entry2.baseRevenueUSD, 200);
    assert.ok(entry2.revenueUSD > 200, 'Compounded revenue should be greater than base revenue');
    assert.ok(entry2.hash, 'Entry 2 must have a cryptographic hash');
    assert.strictEqual(entry2.previousHash, entry1.hash, 'Entry 2 previousHash must equal Entry 1 hash');

    console.log('[Revenue Test] All revenue engine, hash chaining, and exponential compounding tests passed successfully.');
  } finally {
    // Restore backup
    if (backup !== null) {
      fs.writeFileSync(ledgerPath, backup);
    } else if (fs.existsSync(ledgerPath)) {
      fs.unlinkSync(ledgerPath);
    }
  }

  process.exit(0);
}

runRevenueTests();
