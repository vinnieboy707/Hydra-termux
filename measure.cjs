#!/usr/bin/env node
'use strict';
// Measurement run: scan for a fixed window, count distinct opportunity episodes (one per cycle), print GO / NO-GO.
// Same session logic as the dashboard and the background engine. Read-only. The verdict is about whether a SHADOW
// TEST is worth doing, never a profit forecast.
const fs = require('fs');
const path = require('path');
const live = require('./lib/live.cjs');
const { loadConfig, parseEnvFile } = require('./lib/config.cjs');
const { runScan } = require('./lib/scan.cjs');
const { Session } = require('./lib/session.cjs');
const { redact } = require('./lib/safety.cjs');

const need = ['MEASURE_MINUTES', 'MEASURE_INTERVAL_SEC', 'GO_MIN_EPISODES', 'GO_MIN_DISTINCT_BLOCKS', 'GO_MIN_USD_PER_DAY'];

(async () => {
  const envFile = live.findEnvFile();
  const cfg = loadConfig(envFile);
  const file = envFile ? parseEnvFile(envFile) : {};
  for (const k of need) {
    const v = Number(process.env[k] !== undefined ? process.env[k] : file[k]);
    if (!Number.isFinite(v)) cfg.problems.push(`${k} missing or not a number`);
    cfg[k] = v;
  }
  if (cfg.problems.length) { console.error('FAIL-CLOSED:\n - ' + cfg.problems.join('\n - ')); process.exit(2); }

  const st = await live.init(cfg, (k, s, d) => { if (s !== 'run') console.log(`  ${s === 'ok' ? '✓' : '✗'} ${k} ${d || ''}`); });
  fs.mkdirSync(live.DATA, { recursive: true });
  const logFile = path.join(live.DATA, 'observations.jsonl');
  const t = { GO_MIN_EPISODES: cfg.GO_MIN_EPISODES, GO_MIN_DISTINCT_BLOCKS: cfg.GO_MIN_DISTINCT_BLOCKS, GO_MIN_USD_PER_DAY: cfg.GO_MIN_USD_PER_DAY };
  const session = new Session();
  const endAt = Date.now() + cfg.MEASURE_MINUTES * 60000;
  console.log(`measuring for ${cfg.MEASURE_MINUTES} min, every ${cfg.MEASURE_INTERVAL_SEC}s. Ctrl-C stops early (summary still printed).`);
  let stop = false; process.on('SIGINT', () => { stop = true; });
  while (Date.now() < endAt && !stop) {
    const started = Date.now();
    try {
      const deps = await live.snapshot(cfg, st);
      const res = await runScan(cfg, deps);
      session.add(res);
      const best = res.candidates[0];
      fs.appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), block: res.blockNumber, status: res.status, gasGwei: res.gasGwei, approved: res.approved, bestNetUsd: best ? best.netUsd : null }) + '\n');
      const sm = session.summary(t);
      process.stdout.write(`\r scan ${sm.scans} block ${res.blockNumber} gas ${res.gasGwei.toFixed(3)} gwei approved-now ${res.approved} episodes ${sm.episodes} best net $${best ? best.netUsd.toFixed(2) : 'n/a'}      `);
    } catch (e) { session.error(); process.stdout.write(`\r scan error: ${redact(e.shortMessage || e.message).slice(0, 70)}      `); }
    const wait = cfg.MEASURE_INTERVAL_SEC * 1000 - (Date.now() - started);
    if (wait > 0 && !stop) await new Promise((r) => setTimeout(r, wait));
  }
  const sm = session.summary(t);
  const summary = { source: 'chronos measure', at: new Date().toISOString(), ...sm, edge: session.edge(), topEpisodes: session.episodes.slice().sort((a, b) => b.netUsd - a.netUsd).slice(0, 10) };
  fs.writeFileSync(path.join(live.DATA, 'measure_summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n\n' + JSON.stringify(summary, null, 2));
  if (sm.errors) console.error(`\n✗ ${sm.errors} scan(s) failed during this run; the result is incomplete.`);
  console.log('\nHow to read this: an "episode" is one cycle turning net-positive (both borrow directions of the same cycle count once). Quotes are visible to every searcher and Arbitrum orders by priority-fee auction, so the per-day figure is an UPPER BOUND with zero competition. GO only means a shadow test is worth running.');
})().catch((e) => { console.error('FAIL-CLOSED:', redact(e.shortMessage || e.message)); process.exit(1); });
