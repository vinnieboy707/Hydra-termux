'use strict';
// The 100 indicators: exactly 50 success and 50 failure, each measured from a real source or null (never a stand-in
// 0); robust z-scores; the learned correlation that makes an indicator proven; the forecast equation; retirement of
// an indicator that ran its window without firing once, and its return the first time it fires. The direction model:
// drift t-statistic, confidence, and spreads far above normal. Real counterpart: the scans, chain reads and receipts of
// the running engine that feed x (contract-v2-probe, real-quote, wss-feed, realized in chronos verify-real).
const test = require('node:test');
const assert = require('node:assert');
const IND = require('../lib/indicators.cjs');
const DIR = require('../lib/direction.cjs');
const DAY = 86400000;
const R = () => ({ treasury: { kpis: { realizedNetUsdAllTime: 0, netUsdLast24h: 0, tradesLast24h: 0, taxReserveUsd: 0 } }, data: { kpis: { databaseDown: false } } });
const x = (o = {}) => ({ now: 1e12, lastScanAt: 1e12 - 5000, cfg: { MIN_NET_PROFIT_USD: 1 }, res: { blockNumber: 1, tookMs: 9000, marketsFound: 414, approved: 0, candidates: [{ approved: false, netUsd: -2, grossUsd: 0.5, premiumUsd: 0.1, gasUsdAssumed: 2, reasons: ['net below floor'] }], indicators: { best: { netUsd: -2 }, cycles: { checked: 100, pricesAllow: 3, flipsQuoted: 4 }, spreads: [{ pair: ['WETH', 'USDC'], bps: 12 }], moves: [], movedPools: 5, raw: { grossPositive: 1, beatsFlashFee: 0 }, breakEven: { gasGwei: 0.01, gasCeilingGwei: 1, gasUsdByLegs: [{ legs: 2, gasUsd: 0.4 }], flashFeeBps: { aave_v3: 5 } }, flashLiquidity: [] } }, ...o });

test('40 success and 32 failure indicators after removing every duplicate; each removed one names the indicator that carries it', () => {
  assert.strictEqual(IND.SUCCESS.length, 40); assert.strictEqual(IND.FAILURE.length, 32);
  assert.strictEqual(new Set(IND.ALL.map((d) => d.id)).size, 72);
  const kept = new Set(IND.ALL.map((d) => d.id));
  assert.strictEqual(Object.keys(IND.DUPLICATES).length, 28);
  for (const [gone, by] of Object.entries(IND.DUPLICATES)) { assert.ok(!kept.has(gone), gone + ' was removed'); for (const k of by.match(/[SF]\d\d/g)) assert.ok(kept.has(k), `${gone} is carried by ${k}, which is kept`); }
  const names = IND.ALL.map((d) => d.name.toLowerCase()); assert.strictEqual(new Set(names).size, names.length, 'no two indicators share a name');
  for (const d of IND.ALL) { assert.strictEqual(typeof d.get, 'function', d.id); assert.strictEqual(typeof d.fires, 'function', d.id); }
});

test('unmeasured is null, never a stand-in zero; measured values fire by their triggers', () => {
  const ind = new IND.Indicators();
  const empty = ind.observe({ now: 1e12 }, R(), {});
  const row = (s, id) => s.rows.find((r) => r.id === id);
  assert.strictEqual(row(empty, 'S06').value, null, 'no scan: approved routes is unknown, not 0');
  assert.strictEqual(row(empty, 'F21').value, null);
  const s = ind.observe(x(), R(), { ledger: { daySuccesses: 1, dayFailures: 2 } });
  assert.strictEqual(row(s, 'S03').value, 414); assert.ok(row(s, 'S03').firing);
assert.ok(!row(s, 'S06').firing, 'no route approved: S06 does not fire');
  assert.strictEqual(row(s, 'S08').value, -3, 'best -$2 vs floor $1 → -$3');
  assert.strictEqual(row(s, 'F07').value, 1, 'the one failed route was stopped by gas (gross $0.50 − fee $0.10 > 0, net < 0)');
  assert.strictEqual(row(s, 'F26').value, 2);
  assert.ok(s.firingFailure.some((r) => r.id === 'F07')); assert.ok(s.momentum !== null);
});

test('an indicator that never fires for its window is retired, and comes back the first time it fires', () => {
  const ind = new IND.Indicators({ retireDays: 7, minRetireN: 10 });
  let s;
  for (let i = 0; i < 12; i++) s = ind.observe(x({ now: 1e12 + i * DAY, res: { ...x().res, blockNumber: i + 2 } }), R(), {});
  const r = s.retired.find((q) => q.id === 'S06'); assert.ok(r, 'routes approved never fired in 11 days: retired');
  assert.ok(!s.retired.some((q) => q.id === 'F07'), 'a failure that fires every cycle is not retired');
  assert.ok(!s.rows.filter((q) => q.retired).some((q) => s.firingSuccess.some((f) => f.id === q.id)), 'retired indicators leave the index');
  const ok = x({ now: 1e12 + 13 * DAY, res: { ...x().res, blockNumber: 99, approved: 2 } });
  s = ind.observe(ok, R(), {});
  assert.ok(!s.retired.some((q) => q.id === 'S06'), 'it fired: reinstated'); assert.ok(s.firingSuccess.some((f) => f.id === 'S06'));
});

test('robust z, slope and the learned correlation behind "proven" and the forecast', () => {
  assert.strictEqual(IND.zScore([1, 1, 1]), 0, 'too short: 0');
  assert.ok(Math.abs(IND.zScore([10, 11, 9, 10, 11, 9, 10, 25]) - 15 / 1.4826) < 1e-9);
  assert.strictEqual(IND.slope([1, 2, 3]), null); assert.strictEqual(IND.slope([1, 2, 3, 4, 5]), 1);
  // an indicator whose z leads the next change of best net: proven with a positive weight, and it drives the forecast
  const ind = new IND.Indicators({ provenN: 50, provenRho: 0.1 }); let s, best = -5;
  for (let i = 0; i < 300; i++) {
    const spread = 10 + 8 * Math.sin(i / 3); // wide spread now → best net rises next scan
    best += 0.1 * (8 * Math.sin((i - 1) / 3)); // the change in best net follows last scan's spread
    const xi = x({ now: 1e12 + i * 15000, lastScanAt: 1e12 + i * 15000, res: { ...x().res, blockNumber: i + 2, indicators: { ...x().res.indicators, best: { netUsd: best }, spreads: [{ pair: ['WETH', 'USDC'], bps: spread }] } } });
    s = ind.observe(xi, R(), {});
  }
  const rho = IND.rhoOf(ind.st.ind.S11); assert.ok(rho > 0.5, `widest spread predicts best net (ρ ${rho})`);
  assert.ok(s.provenCount >= 1); assert.ok(s.drivers.some((d) => d.id === 'S11'));
  assert.ok(Number.isFinite(s.forecastUsd));
  assert.match(IND.lines(s)[3], /forecast \(Δ̂ = σ·Σρz\/Σ\|ρ\|\): best net [+-]\$\d+\.\d\d at the next scan · drivers: .*S11/);
});

test('direction model: drift t-statistic, confidence and unusually wide spreads', () => {
  assert.strictEqual(DIR.drift([1, 1.01]), null, 'under 5 returns: no claim');
  const up = Array.from({ length: 60 }, (_, i) => 100 * Math.exp(0.001 * i + (i % 2 ? 0.0003 : -0.0003)));
  const d = DIR.drift(up); assert.strictEqual(d.direction, 'rising'); assert.ok(d.t > 2 && d.confidence > 0.95); assert.ok(d.expectedBps > 0);
  const noise = Array.from({ length: 60 }, (_, i) => 100 * (1 + (i % 2 ? 0.001 : -0.001)));
  assert.strictEqual(DIR.drift(noise).direction, 'flat', 'a price going back and forth has no direction');
  assert.ok(Math.abs(DIR.phi(0) - 0.5) < 1e-6 && Math.abs(DIR.phi(1.96) - 0.975) < 1e-3);
  const m = new DIR.Direction();
  for (let i = 0; i < 30; i++) m.observe({ blockNumber: i + 1, indicators: { prices: [{ key: 'a|b', pair: ['WETH', 'USDC'], p: 3000 * Math.exp(-0.0005 * i + (i % 2 ? 0.0001 : -0.0001)) }], spreads: [{ pair: ['WETH', 'USDC'], bps: i === 29 ? 60 : 10 + (i % 3) }] } });
  assert.strictEqual(m.observe({ blockNumber: 30, indicators: { prices: [] } }), false, 'the same block is not counted twice');
  const s = m.summary(); assert.strictEqual(s.pairs[0].direction, 'falling'); assert.strictEqual(s.wideSpreads[0].bps, 60);
  const L = DIR.lines(s); assert.match(L[1], /WETH in USDC falling \(t -\d+\.\d, \d+% confidence/); assert.match(L.at(-1), /spread WETH\/USDC 60 bps is \d+\.\dσ above its normal/);
  assert.match(DIR.lines(null)[0], /not enough scans yet/);
});

test('two indicators that move together are a measured duplicate: the higher id leaves the index until they part', () => {
  const ind = new IND.Indicators(); let s;
  for (let i = 0; i < 260; i++) {
    const m = 5 + 4 * Math.sin(i / 2) + (i % 7) * 0.3; // pools that moved and positive raw gaps rising and falling together
    s = ind.observe(x({ now: 1e12 + i * 400000, lastScanAt: 1e12 + i * 400000, res: { ...x().res, blockNumber: i + 2, indicators: { ...x().res.indicators, movedPools: m, raw: { grossPositive: 2 * m, beatsFlashFee: 0 } } } }), R(), {});
  }
  const d = s.duplicates.find((q) => q.id === 'S19'); assert.ok(d, 'S19 moved exactly with S13'); assert.match(d.of, /^S13 \(r 1\.00\)/);
  assert.ok(!s.rows.filter((r) => r.duplicateOf).some((r) => s.firingSuccess.some((f) => f.id === r.id)), 'left out of the index');
  assert.match(IND.lines(s).join('\n'), /measured duplicates \(left out while they move together\): .*S19 of S13/);
  assert.ok(Math.abs(IND.corr([1, 2, 3], [2, 4, 6]) - 1) < 1e-12); assert.strictEqual(IND.corr([1, 1, 1], [1, 2, 3]), null);
});
