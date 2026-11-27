#!/usr/bin/env node
'use strict';
// One read-only scan: real on-chain quotes, real Aave premium, real oracle prices. Sends nothing.
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./lib/config.cjs');
const { init, snapshot } = require('./lib/live.cjs');
const { runScan } = require('./lib/scan.cjs');

const fmt = (n, d = 2) => (n === null || n === undefined ? 'n/a' : Number(n).toFixed(d));

(async () => {
  const cfg = loadConfig(require('./lib/live.cjs').findEnvFile());
  if (cfg.problems.length) {
    console.error('FAIL-CLOSED: fix these in .env (see .env.scanner.example):\n - ' + cfg.problems.join('\n - '));
    process.exit(2);
  }
  console.log(`RPC from ${cfg.rpcEnvKey} (url not printed)`);
  const st = await init(cfg, (m) => console.log('  ' + m));
  console.log('\nVENUES');
  for (const v of st.venueReport) console.log('  ' + (v.ok ? 'ok  ' : 'OFF ') + v.id.padEnd(12) + (v.ok ? (v.executable ? 'executable by the contract' : 'quote-only (contract has no adapter)') : v.why));
  console.log(`\nAave reserves: ${st.assets.length}, flash-loanable now: ${st.assets.filter((a) => a.flashEnabled).map((a) => a.symbol).join(', ') || 'none'}`);
  console.log(`pools with liquidity found: ${st.markets.length}`);

  const deps = await snapshot(cfg, st);
  const res = await runScan(cfg, deps);
  console.log(`\nBLOCK ${res.blockNumber} | gas ${res.gasGwei.toFixed(4)} gwei (ceiling ${cfg.GAS_CEILING_GWEI}) | Aave premium ${res.premiumBps} bps | ${res.status}`);
  console.log(`assumed gas per run: ${cfg.GAS_UNITS_ASSUMED} units = $${res.gasCostUsdAssumed.toFixed(4)}   (an assumption: calibrate it)`);
  console.log(`routes: ${res.routesEnumerated} enumerated, ${res.routesScreened} quoted, ${res.optimised} optimised | rpc quotes: ${deps.counter.n} (${deps.counter.fail} failed) | ${res.tookMs} ms\n`);
  console.log('RANK  ROUTE                                         SIZE$     GROSS$   FLASH$    GAS$      NET$   IMPACT  VERDICT');
  res.candidates.slice(0, 15).forEach((c, i) => {
    const route = `${c.borrowSymbol}->${c.otherSymbol} ${c.buyOn.split(':').slice(0, 2).join(':')} -> ${c.sellOn.split(':').slice(0, 2).join(':')}`;
    console.log(String(i + 1).padStart(3) + '   ' + route.padEnd(44).slice(0, 44) + fmt(c.amountUsd, 0).padStart(9) + fmt(c.grossUsd).padStart(10) + fmt(c.premiumUsd).padStart(9) + fmt(c.gasUsdAssumed, 3).padStart(8) + fmt(c.netUsd).padStart(10) + `  ${c.impact1}/${c.impact2}`.padEnd(9) + (c.approved ? ' APPROVED' : ' rejected: ' + c.reasons[0]));
  });
  console.log(`\napproved: ${res.approved}. These are quotes at one block, not trades. Nothing was sent.`);
  const DATA = require('./lib/live.cjs').DATA;
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'last_scan.json'), JSON.stringify(res, null, 2));
  console.log('full detail (incl. contract run params for approved routes): data/last_scan.json');
})().catch((e) => { console.error('FAIL-CLOSED:', require('./lib/safety.cjs').redact(e.shortMessage || e.message)); process.exit(1); });
