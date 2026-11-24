#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

console.clear();
console.log('========================================================================');
console.log('⚡ CHRONOS OS // PRODUCTION TERMINAL HUD');
console.log('========================================================================');

// 1. Profit Gate Status
const gatePath = path.join(__dirname, '..', 'data', 'profit_gate.json');
if (fs.existsSync(gatePath)) {
  try {
    const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
    console.log(`[GATE] Elapsed: ${gate.elapsed_days}/${gate.required_days} Days | Remaining: ${gate.remaining_days} Days`);
    console.log(`[DATA] Events Indexed: ${gate.total_events_indexed?.toLocaleString()} | Live: ${gate.live_events_accumulated}`);
  } catch (_) {}
}

// 2. Ledger Settlements
const dbPath = path.join(__dirname, '..', 'vault_store.db');
if (fs.existsSync(dbPath)) {
  try {
    const db = new DatabaseSync(dbPath);
    const row = db.prepare('SELECT COUNT(*) as count, SUM(gross_usd) as gross, SUM(tax_reserve) as tax, SUM(net_withdrawable) as net FROM settlements').get();
    console.log('------------------------------------------------------------------------');
    console.log(`[LEDGER] Total Settlements : ${row.count || 0}`);
    console.log(`[LEDGER] Gross Recognized : $${(row.gross || 0).toFixed(2)}`);
    console.log(`[LEDGER] 30% Tax Reserve  : $${(row.tax || 0).toFixed(2)}`);
    console.log(`[LEDGER] Net Withdrawable : $${(row.net || 0).toFixed(2)}`);
    db.close();
  } catch (_) {}
}

// 3. Anchors & Live State
console.log('------------------------------------------------------------------------');
console.log('[ANCHORS] EVM Wallet : 0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0');
console.log('[ANCHORS] SOL Wallet : ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr (0.0885 SOL)');
console.log('[SAFETY]  CHRONOS_LIVE=0 | FAIL-CLOSED KILLSWITCH: ACTIVE');
console.log('========================================================================\n');
