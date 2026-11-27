'use strict';
// The gas specialist: per route type (lender + pool kinds) from measured shadow gas, the executor's sends left and
// top-up, spikes. Real counterpart: the gas it learns is eth_estimateGas of the exact transaction on Arbitrum One
// (lib/shadow.cjs, chronos verify-real contract-v2-probe), and the executor's ETH is read on chain (executor readiness).
const test = require('node:test');
const assert = require('node:assert');
const { GasDesk } = require('../lib/gas.cjs');
const { runScan } = require('../lib/scan.cjs');

test('gas is learned per route type, then per leg count; nothing is priced from too few measurements', () => {
  const g = new GasDesk();
  g.learn(['v3', 'v2'], 'balancer_v2', 300000); g.learn(['v3', 'v2'], 'balancer_v2', 310000);
  assert.strictEqual(g.unitsFor(['v3', 'v2'], 'balancer_v2'), null, 'two samples are not enough');
  g.learn(['v3', 'v2'], 'balancer_v2', 305000);
  const bal = g.unitsFor(['v3', 'v2'], 'balancer_v2'); assert.ok(bal >= 305000 * 1.15 * 0.9 && bal <= 310000 * 1.15 + 1);
  for (let i = 0; i < 3; i++) g.learn(['v3', 'v3'], 'aave_v3', 420000);
  assert.ok(g.unitsFor(['v3', 'v3'], 'aave_v3') > bal, 'a different lender and pools cost different gas');
  assert.ok(g.unitsFor(['v2', 'v2'], 'aave_v3') > 0, 'an unmeasured type falls back to its leg count');
  assert.strictEqual(g.unitsFor(['v2', 'v2', 'v3'], 'aave_v3'), null, 'nothing measured for 3 legs: the caller uses your assumption');
});

test('the executor\'s sends left and the exact top-up; a gas spike is caught', () => {
  const g = new GasDesk();
  const s = g.status({ executorEth: 0.0005, gasGwei: 0.02, ethUsd: 3000, assumedUnits: 900000 });
  assert.strictEqual(s.sendsLeft, Math.floor(0.0005 / (900000 * 0.02 / 1e9)));
  assert.ok(s.topUpEth > 0 && Math.abs(s.topUpEth - (200 * 900000 * 0.02 / 1e9 - 0.0005)) < 1e-12);
  assert.strictEqual(g.status({ executorEth: 1, gasGwei: 0.02, ethUsd: 3000, assumedUnits: 900000 }).topUpEth, 0, 'plenty: nothing to top up');
  for (let i = 0; i < 30; i++) g.observePrice(0.02); assert.strictEqual(g.spike(), null);
  g.observePrice(0.2); assert.deepStrictEqual(g.spike(), { now: 0.2, median: 0.02 });
});

test('the scan prices each route with its own measured gas', async () => {
  // a 2-pool round trip priced first by the assumption, then by a measured (much higher) gas for that route type
  const A = '0x' + 'aa'.repeat(20), B = '0x' + 'bb'.repeat(20); const pair = [A, B].sort();
  const m = (id, r0, r1) => ({ m: { id, venueId: 'uni', kind: 'v2', fee: 0, pair, address: id, executable: true, router: '0x' + '11'.repeat(20) }, s: { r0, r1 } });
  const P = [m('p1', 1000000n * 10n ** 6n, 1000n * 10n ** 18n), m('p2', 1000000n * 10n ** 6n, 1010n * 10n ** 18n)];
  const states = new Map(P.map((p) => [p.m.id, p.s]));
  const cp = (x, ri, ro) => (x * 997n * ro) / (ri * 1000n + x * 997n);
  const deps = (gasUnits) => ({ assets: [{ address: pair[0], symbol: 'A', decimals: pair[0] === A ? 6 : 18, flashEnabled: true, price8: pair[0] === A ? 100000000n : 100000000000n, available: null }, { address: pair[1], symbol: 'B', decimals: pair[1] === A ? 6 : 18, flashEnabled: true, price8: pair[1] === A ? 100000000n : 100000000000n, available: null }],
    ethUsd: 3000, gasPriceWei: 20000000n, premiumBps: 5, markets: P.map((p) => p.m), states, v2Fees: { uni: 30 }, blockNumber: 1, nowSec: 1, gasUnits,
    quote: async (mk, tin, tout, amt) => { const st = states.get(mk.id); const [ri, ro] = tin === mk.pair[0] ? [st.r0, st.r1] : [st.r1, st.r0]; const o = cp(amt, ri, ro); return o > 0n ? o : null; } });
  const CFG = { MIN_NET_PROFIT_USD: -1e9, MAX_SLIPPAGE_BPS: 10000, GAS_CEILING_GWEI: 1, GAS_UNITS_ASSUMED: 900000, SCREEN_SIZE_USD: 1000, SCAN_TOPK: 4, OPT_REFINE_ITERS: 4, SLIPPAGE_PROBE_USD: 10, SIZE_LADDER_USD: [1000, 5000], DEADLINE_SECONDS: 60, MIN_PROFIT_CAPTURE_BPS: 5000 };
  const a = await runScan(CFG, deps({})); const b = await runScan(CFG, deps({ 'aave_v3|v2,v2': 9000000 }));
  assert.ok(a.candidates.length && b.candidates.length);
  assert.ok(b.candidates[0].gasUsdAssumed > a.candidates[0].gasUsdAssumed * 5, 'the measured gas of this route type is what the route is charged');
});
