#!/usr/bin/env node
'use strict';
// Checks every pool in your src/registry.ts against the chain: is it really the exchange, pair and fee tier it claims?
// The checks themselves live in lib/audit.cjs (one implementation for this command, autopilot and the System tab).
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./lib/config.cjs');
const C = require('./lib/chain.cjs');
const { auditRegistry, corrected } = require('./lib/audit.cjs');

(async () => {
  const live = require('./lib/live.cjs');
  const args = process.argv.slice(2); const fix = args.includes('--fix');
  const file = args.find((a) => !a.startsWith('--')) || path.join(live.workspaceDir(live.findEnvFile()), 'src', 'registry.ts');
  const cfg = loadConfig(live.findEnvFile());
  if (!cfg.rpcUrl) { console.error('no RPC url in .env'); process.exit(2); }
  const venues = JSON.parse(fs.readFileSync(path.join(__dirname, 'venues.json'), 'utf8')).venues;
  const provider = await C.connect(cfg);
  const rs = await auditRegistry(provider, file, venues);
  let bad = 0, skipped = 0;
  for (const r of rs) {
    console.log(`\n${r.claim.exchange || '(no exchange label)'} ${r.claim.pair || ''} ${r.claim.address || ''}`);
    if (r.skipped) { skipped++; console.log('  skipped: ' + r.skipped); continue; }
    if (r.onchain) console.log(`  on-chain: factory ${r.onchain.factory} => ${r.onchain.venue || 'UNKNOWN venue'} | ${r.onchain.pair} | fee ${r.onchain.fee} | liquidity ${r.onchain.liquidity}`);
    for (const n of r.notes || []) console.log('  note: ' + n);
    if (r.problems.length) { bad++; r.problems.forEach((x) => console.log('  MISMATCH: ' + x)); if (r.suggest) console.log('  → ' + r.suggest.why); } else console.log('  ok: label matches the chain');
  }
  console.log(`\n${rs.length - skipped} pool(s) checked, ${bad} with problems${skipped ? `, ${skipped} entr${skipped === 1 ? 'y' : 'ies'} without a literal address skipped` : ''}.`);
  const c = corrected(fs.readFileSync(file, 'utf8'), rs);
  if (fix && c.changed) { const out = file.replace(/\.ts$/, '') + '.corrected.ts'; fs.writeFileSync(out, c.text); console.log(`\nWrote ${out} with ${c.changed} address(es) corrected from the factories. Your original is unchanged: compare, then replace it yourself.`); }
  else if (c.changed) console.log(`\n${c.changed} address(es) can be corrected from the factories: chronos audit --fix writes registry.corrected.ts next to yours (your file is never changed).`);
})().catch((e) => { console.error('FAIL-CLOSED:', require('./lib/safety.cjs').redact(e.shortMessage || e.message)); process.exit(1); });
