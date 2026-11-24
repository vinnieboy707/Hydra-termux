'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const Logger = require('./logger');

const DB_PATH = path.join(__dirname, '..', 'vault_store.db');

const WATERFALL_SPLIT = {
  TAX_RESERVE_PCT: 0.30,      // Mandatory IRS/FTB Policy C1
  PRIMARY_LIQUIDITY_PCT: 0.45, // DEX operational pools
  SAVINGS_VAULT_PCT: 0.15,    // Secure cold reserve
  GAS_RESERVE_PCT: 0.05,      // Mainnet gas maintenance
  REINVESTMENT_PCT: 0.05      // Compute & telemetry
};

function processInboundSettlement(source, grossAmountUSD, txHash) {
  if (!grossAmountUSD || grossAmountUSD <= 0) {
    Logger.failLoud(`Invalid settlement amount: $${grossAmountUSD}`, new Error('INVALID_SETTLEMENT_AMOUNT'), false);
    return;
  }

  const taxReserve = +(grossAmountUSD * WATERFALL_SPLIT.TAX_RESERVE_PCT).toFixed(4);
  const liquidity = +(grossAmountUSD * WATERFALL_SPLIT.PRIMARY_LIQUIDITY_PCT).toFixed(4);
  const savings = +(grossAmountUSD * WATERFALL_SPLIT.SAVINGS_VAULT_PCT).toFixed(4);
  const gas = +(grossAmountUSD * WATERFALL_SPLIT.GAS_RESERVE_PCT).toFixed(4);
  const reinvest = +(grossAmountUSD * WATERFALL_SPLIT.REINVESTMENT_PCT).toFixed(4);
  const netWithdrawable = +(grossAmountUSD - taxReserve).toFixed(4);

  Logger.info(`[WATERFALL] Allocating $${grossAmountUSD.toFixed(2)} from ${source} (Tx: ${txHash || 'OFF_CHAIN'})`);
  console.log(`  ├── 30% Tax Reserve:      $${taxReserve}`);
  console.log(`  ├── 45% Primary Liquidity: $${liquidity}`);
  console.log(`  ├── 15% Savings Vault:    $${savings}`);
  console.log(`  ├──  5% Gas Maintenance:  $${gas}`);
  console.log(`  └──  5% Reinvestment:     $${reinvest}`);
  console.log(`  ==> Net Withdrawable:     $${netWithdrawable}`);

  try {
    const db = new DatabaseSync(DB_PATH);
    db.exec(`CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      tx_hash TEXT UNIQUE,
      gross_usd REAL NOT NULL,
      tax_reserve REAL NOT NULL,
      net_withdrawable REAL NOT NULL,
      status TEXT NOT NULL
    );`);

    const stmt = db.prepare(`INSERT OR IGNORE INTO settlements 
      (timestamp, source, tx_hash, gross_usd, tax_reserve, net_withdrawable, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    stmt.run(
      new Date().toISOString(),
      source,
      txHash || `INTERNAL_${Date.now()}`,
      grossAmountUSD,
      taxReserve,
      netWithdrawable,
      'FINALIZED'
    );
    db.close();
    Logger.info('[LEDGER] Settlement committed cleanly to vault_store.db via node:sqlite');
  } catch (err) {
    Logger.failLoud('Database write failure in settlement waterfall', err, false);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const amount = parseFloat(args[0]) || 0;
  const source = args[1] || 'MANUAL_TEST';
  const tx = args[2] || null;
  if (amount > 0) {
    processInboundSettlement(source, amount, tx);
  } else {
    console.log('Usage: node src/settlement-waterfall.js <AMOUNT_USD> <SOURCE> [TX_HASH]');
  }
}

module.exports = { processInboundSettlement, WATERFALL_SPLIT };
