'use strict';
// Path to profit: the closest routes of each scan are uploaded with their full cost breakdown and the one thing that
// stopped them; the insights answer is turned into plain lines for the daily report and the dashboard. Only measured
// numbers are sent (missing stays null). Real counterpart: route_stats, route_insights, profit_gap and
// mainnet_progress in your Supabase project (portal/real_check.sql query 5, test/server.test.cjs).
const test = require('node:test');
const assert = require('node:assert');
const I = require('../lib/insights.cjs');

const c = (o) => ({ legsCount: 2, path: ['USDC', 'WETH', 'USDC'], flash: { provider: 'balancer_v2' }, amountUsd: 1000, ...o });

test('the killer is the first cost that makes the route lose, then the rule that blocked it', () => {
  assert.strictEqual(I.killer(c({ grossUsd: -0.1, premiumUsd: 0, netUsd: -1 }), 1), 'no price gap');
  assert.strictEqual(I.killer(c({ grossUsd: 0.4, premiumUsd: 0.5, netUsd: -1 }), 1), 'flash-loan fee');
  assert.strictEqual(I.killer(c({ grossUsd: 0.8, premiumUsd: 0.1, netUsd: -0.2 }), 1), 'gas');
  assert.strictEqual(I.killer(c({ grossUsd: 2, premiumUsd: 0, netUsd: 0.5 }), 1), 'below your floor');
  assert.strictEqual(I.killer(c({ grossUsd: 9, premiumUsd: 0, netUsd: 5, reasons: ['leg 2 impact 80 bps > 30'] }), 1), 'price impact cap');
  assert.strictEqual(I.killer(c({ grossUsd: 9, premiumUsd: 0, netUsd: 5, reasons: ['NOT_EXECUTABLE camelot'] }), 1), 'venue not executable');
  assert.strictEqual(I.killer(c({ approved: true, grossUsd: 9, netUsd: 5 }), 1), 'none');
  for (const k of ['no price gap', 'gas', 'none']) assert.ok(I.KILLERS.includes(k));
});

test('near misses: the 10 closest routes of a real scan, measured numbers only, nothing before a real block', () => {
  assert.deepStrictEqual(I.nearMisses(null, 1), []); assert.deepStrictEqual(I.nearMisses({ candidates: [c({ netUsd: 1 })] }, 1), [], 'no block: nothing');
  const cands = Array.from({ length: 14 }, (_, i) => c({ netUsd: -i, grossUsd: 1, premiumUsd: 0.1, gasUsdAssumed: 1 + i }));
  cands.reverse(); // the scan's own order is not trusted: the closest are picked here
  cands.push(c({ netUsd: NaN })); cands.push(c({ netUsd: 3, legsCount: 1 }));
  const rows = I.nearMisses({ blockNumber: 527000000, candidates: cands }, 1, 10, Date.UTC(2026, 10, 24));
  assert.strictEqual(rows.length, 10); assert.deepStrictEqual(rows.map((r) => r.net_usd), [-0, -1, -2, -3, -4, -5, -6, -7, -8, -9]);
  assert.strictEqual(rows[0].block, 527000000); assert.strictEqual(rows[0].ts, '2026-11-24T00:00:00.000Z'); assert.strictEqual(rows[0].lender, 'balancer_v2');
  assert.strictEqual(rows[0].path, 'USDC>WETH>USDC'); assert.strictEqual(rows[0].killer, 'gas');
  const r2 = I.nearMisses({ blockNumber: 1, candidates: [c({ netUsd: -1 })] }, null)[0];
  assert.strictEqual(r2.gross_usd, null); assert.strictEqual(r2.gas_usd, null); assert.strictEqual(r2.floor_usd, null, 'unmeasured stays null, never 0');
});

test('the insights answer becomes plain lines: road to mainnet, closest route, what stops routes, silent engines', () => {
  assert.deepStrictEqual(I.summarize(null), []); assert.deepStrictEqual(I.summarize({ ok: false }), []);
  const L = I.summarize({ ok: true, mainnet: [{ step: 1, what: 'an engine is running', done: true, detail: 'x' }, { step: 2, what: 'contract v2 deployed', done: false, detail: 'v1: chronos mainnet', version: '3.0' }],
    routes: [{ path: 'USDC>WETH>USDC', best_net_usd: -0.42, best_gap_usd: -1.42, samples: 12, usual_killer: 'gas' }],
    killers: [{ killer: 'gas', samples: 9 }, { killer: 'flash-loan fee', samples: 3 }, { killer: 'none', samples: 4 }], watchdog: [{ service: 'chronos-engine@phone', since: '2026-11-24T10:00:00Z' }] });
  assert.match(L[0], /^ROAD TO MAINNET: 1\/2 done · next: contract v2 deployed \(version 3\.0\): v1: chronos mainnet$/);
  assert.match(L[1], /closest USDC>WETH>USDC best -\$0\.42 \(-\$1\.42 vs your floor\) over 12 samples · usually stopped by gas/);
  assert.strictEqual(L[2], '  stopped by: gas 75% · flash-loan fee 25%');
  assert.match(L[3], /ENGINE SILENT: chronos-engine@phone/);
  assert.match(I.summarize({ ok: true, routes: [], killers: [], mainnet: [] })[0], /no route data uploaded yet/);
});

test('the insights call is signed by this device and never throws into the engine', async () => {
  let asked = null;
  const ok = await I.fetchInsights({ enabled: true, call: async (n, b) => { asked = [n, b]; return { ok: true, routes: [] }; } });
  assert.deepStrictEqual(asked, ['insights', {}]); assert.ok(ok.fetchedAt);
  assert.strictEqual(await I.fetchInsights({ enabled: true, call: async () => { throw new Error('HTTP 403'); } }), null);
  assert.strictEqual(await I.fetchInsights({ enabled: false }), null);
});
