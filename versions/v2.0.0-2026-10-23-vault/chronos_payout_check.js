'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

process.chdir(__dirname);

// Load .env
try {
  for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
} catch (_) {}

const year = new Date().getUTCFullYear();
const rate = Number(process.env.CHRONOS_TAX_RESERVE_RATE) > 0 ? Number(process.env.CHRONOS_TAX_RESERVE_RATE) : 0.30;
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync('config.json', 'utf8')); } catch (_) {}
const ledger = process.env.CHRONOS_LEDGER_PATH || cfg.unified_ledger || 'unified_financial_ledger.wal';

(async () => {
  const blockers = [];
  let income = 0, withdrawn = 0;
  const bookedSol = new Set();

  if (fs.existsSync(ledger)) {
    for (const l of fs.readFileSync(ledger, 'utf8').split('\n')) {
      try {
        const e = JSON.parse(l);
        if (e.type === 'WITHDRAWAL' && new Date(e.timestamp).getUTCFullYear() === year) {
          withdrawn += Number(e.amountUSD) || 0;
        }
        if (e.status !== 'SETTLED_TO_OWN_WALLET_VERIFIED') continue;
        if (!/^0x/.test(String(e.txHash))) bookedSol.add(e.txHash);
        if (new Date(e.timestamp).getUTCFullYear() === year) {
          income += Number(e.recognizedRevenueUSD) || 0;
        }
      } catch (_) {}
    }
  }

  const reserve = income * rate;
  const available = income - reserve - withdrawn;

  if (fs.existsSync(process.env.KILL_SWITCH_FILE || 'KILL_SWITCH') || process.env.KILL_SWITCH === '1') {
    blockers.push('kill switch is active');
  }

  const solWallet = process.env.CHRONOS_SOL_SETTLEMENT_WALLETS || process.env.SOLANA_WALLET_PUBKEY;
  if (solWallet) {
    try {
      const sv = require('./src/solana-verifier');
      const recent = await sv.recentInbound(50);
      const missing = [...recent.keys()].filter((s) => !bookedSol.has(s));
      if (missing.length) {
        blockers.push(missing.length + ' recent Solana inbound transfer(s) are not in the ledger; review them first');
      }
    } catch (e) {
      blockers.push('Solana completeness check: ' + e.message);
    }
  }

  if (available < 1) {
    blockers.push('zero available funds after 30% reserve and prior withdrawals ($' + Math.max(0, available).toFixed(2) + ' available)');
  }

  const approved = blockers.length === 0;
  const approvedUsd = approved ? Math.floor(available * 100) / 100 : 0;

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(
    path.join('data', 'payout_approval.json'),
    JSON.stringify({ approved, approvedUsd, generatedAt: new Date().toISOString(), year, income, reserve, withdrawn, blockers }, null, 2)
  );

  console.log('PAYOUT CHECK // ' + new Date().toISOString());
  console.log('verified income ' + year + ': $' + income.toFixed(2) + ' | reserve (' + (rate * 100).toFixed(0) + '%): $' + reserve.toFixed(2) + ' \vert{} withdrawn:$' + withdrawn.toFixed(2));
  console.log('available withdrawable cash: $' + Math.max(available, 0).toFixed(2));
  blockers.forEach((b) => console.log('BLOCKER: ' + b));
  console.log('RESULT: ' + (approved ? 'APPROVED up to $' + approvedUsd.toFixed(2) : 'NOT APPROVED'));
})().catch((e) => {
  console.error('payout check fatal error: ' + e.message);
  process.exit(1);
});
