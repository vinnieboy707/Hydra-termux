'use strict';
// chronos tune small-trades | undo (2.9.19): research change #1 (2026-11-26), as one decision you approve.
// The winners on Arbitrum trade $5–$200 and keep cents; Chronos started at $200, screened at $1,000 and wanted $0.35,
// so it could not take any of the 47 winning trades traced. This sets, after showing before → after and on YES:
//   SIZE_LADDER_USD 25,50,100,200,500,1000,2500,5000 · SCREEN_SIZE_USD 100 · MIN_NET_PROFIT_USD 0.05 · FLOOR_GAS_MULT 1.5
// What still protects you: every trade must keep at least 1.5× its own gas and $0.05; your contract enforces the
// minimum profit on chain (a trade that would earn less reverts, costing only its gas); the daily spend cap
// (CHRONOS_DAILY_SPEND_CAP_USD) and the revert limits stop a bad run. `chronos tune undo` puts your old values back.
const fs = require('fs');
const path = require('path');

const SMALL = { SIZE_LADDER_USD: '25,50,100,200,500,1000,2500,5000', SCREEN_SIZE_USD: '100', MIN_NET_PROFIT_USD: '0.05', FLOOR_GAS_MULT: '1.5' };
const backupOf = (dataDir) => path.join(dataDir, 'tune-backup.json');

/** d: { sub, get, setEnv(k, v), dataDir, P: { input }, log } → exit code */
async function run(d) {
  const { sub, get, setEnv, dataDir, log } = d;
  if (sub === 'undo') {
    let b; try { b = JSON.parse(fs.readFileSync(backupOf(dataDir), 'utf8')); } catch (_) { log('Nothing to undo: no earlier tune here.'); return 1; }
    for (const [k, v] of Object.entries(b.before)) { if (v === null) setEnv(k, ''); else setEnv(k, v); log(`  ${k} → ${v === null ? '(default)' : v}`); }
    fs.renameSync(backupOf(dataDir), backupOf(dataDir) + '.undone-' + Date.now()); // kept, never deleted
    log('Your earlier values are back. The engine picks them up within a minute.'); return 0;
  }
  if (sub !== 'small-trades') { log('chronos tune small-trades   smaller trade sizes and a gas-based floor (asks YES)\nchronos tune undo           your earlier values back'); return 2; }
  log('Small trades (research, 2026-11-26): the trades that win on Arbitrum are $5–$200 and keep cents.');
  for (const [k, v] of Object.entries(SMALL)) log(`  ${k.padEnd(20)} ${String(get(k) ?? '(default)').padEnd(36)} → ${v}`);
  log('Still protecting you: every trade must keep ≥ 1.5× its own gas and ≥ $0.05; your contract enforces the minimum on chain;');
  log(`your daily spend cap (${get('CHRONOS_DAILY_SPEND_CAP_USD') || 5} USD) and the revert limits stop a bad run. Undo any time: chronos tune undo`);
  const a = d.P && d.P.input ? await d.P.input('Type YES (capitals) to apply') : null;
  if (a !== 'YES') { log(a && a.toLowerCase() === 'yes' ? 'Not applied: type YES in capitals.' : 'Not applied.'); return 1; }
  const before = Object.fromEntries(Object.keys(SMALL).map((k) => [k, get(k) ?? null]));
  fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(backupOf(dataDir), JSON.stringify({ at: new Date().toISOString(), before }, null, 2), { mode: 0o600 });
  for (const [k, v] of Object.entries(SMALL)) setEnv(k, v);
  log('✓ Applied. The engine picks it up within a minute; the money panel shows the new floor.'); return 0;
}
module.exports = { run, SMALL };
