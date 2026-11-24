'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

process.chdir(__dirname);

// Load .env
const dotenv = {};
try {
  for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      dotenv[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = dotenv[m[1]];
    }
  }
} catch (_) {}

const results = [];
const add = (level, name, detail) => results.push({ level, name, detail });
const run = (args, ms) => cp.spawnSync(process.execPath, args, { encoding: 'utf8', timeout: ms || 60000 });

function freshJson(file, hours) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join('data', file), 'utf8'));
    return { g, fresh: Date.now() - Date.parse(g.generatedAt) < hours * 3600000 };
  } catch (_) { return null; }
}

(async () => {
  console.log('PRODUCTION READINESS AUDIT // ' + new Date().toISOString());

  // Check core modules load
  const mod = run(['-e', "require('./src/send-guard');require('./src/solana-verifier')"]);
  if (mod.status === 0) {
    add('PASS', 'module system', 'core CommonJS modules load cleanly');
  } else {
    add('FAIL', 'module system', 'load error: ' + String(mod.stderr || '').split('\n')[0]);
  }

  // EVM Settlement Wallet
  const ev = (process.env.CHRONOS_SETTLEMENT_WALLETS || process.env.PRIMARY_SETTLEMENT_ADDRESS || process.env.COLD_VAULT_ADDRESS || '').split(',').map(s => s.trim()).filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a));
  if (ev.length) {
    add('PASS', 'EVM settlement wallet', ev[0]);
  } else {
    add('FAIL', 'EVM settlement wallet', 'missing PRIMARY_SETTLEMENT_ADDRESS');
  }

  // Solana Settlement Wallet
  const solW = (process.env.CHRONOS_SOL_SETTLEMENT_WALLETS || process.env.SOLANA_WALLET_PUBKEY || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!solW.length) {
    add('FAIL', 'Solana settlement wallet', 'missing SOLANA_WALLET_PUBKEY');
  } else {
    try {
      const sv = require('./src/solana-verifier');
      const g = await sv.rpc('getGenesisHash', []);
      if (g === sv.MAINNET_GENESIS) {
        add('PASS', 'Solana RPC', 'mainnet-beta verified (genesis ' + g.slice(0, 8) + '...)');
      } else {
        add('FAIL', 'Solana RPC', 'not mainnet-beta (genesis ' + g + ')');
      }
      const bal = await sv.rpc('getBalance', [solW[0]]);
      const solBal = ((bal && bal.value !== undefined ? bal.value : bal) / 1e9).toFixed(4);
      add('PASS', 'Solana wallet balance', solBal + ' SOL at ' + solW[0]);
    } catch (e) {
      add('FAIL', 'Solana RPC', e.message);
    }
  }

  // Paper trade gate
  const gate = freshJson('profit_gate.json', 36);
  if (gate && gate.g.passed && gate.fresh) {
    add('PASS', 'profit gate (trading)', 'passed ' + gate.g.generatedAt);
  } else {
    add('WARN', 'profit gate (trading)', 'paper-trade gate not passed yet (paper-trader active)');
  }

  // Payout approval
  const ap = freshJson('payout_approval.json', 24);
  if (ap && ap.g.approved && ap.fresh) {
    add('PASS', 'payout approval', 'approved up to $' + ap.g.approvedUsd.toFixed(2));
  } else {
    add('WARN', 'payout approval', 'none generated yet (run chronos_payout_check.js)');
  }

  const live = process.env.CHRONOS_LIVE === '1';
  const kill = fs.existsSync(process.env.KILL_SWITCH_FILE || 'KILL_SWITCH') || process.env.KILL_SWITCH === '1';
  add(live ? 'WARN' : 'PASS', 'CHRONOS_LIVE', live ? '1: money-moving allowed' : '0: dry-run safe default');
  add(kill ? 'WARN' : 'PASS', 'kill switch', kill ? 'ACTIVE: all execution blocked' : 'inactive');

  console.log('\n--- READINESS CHECK RESULTS ---');
  let hasFail = false;
  for (const r of results) {
    console.log(r.level.padEnd(5) + ' ' + r.name.padEnd(26) + ': ' + r.detail);
    if (r.level === 'FAIL') hasFail = true;
  }
  console.log('--------------------------------');
  console.log('OVERALL VERDICT: ' + (hasFail ? 'NOT READY (FAIL items must be resolved)' : 'READY FOR GOVERNED OPERATIONS'));
})().catch((e) => {
  console.error('readiness error: ' + e.message);
  process.exit(1);
});
