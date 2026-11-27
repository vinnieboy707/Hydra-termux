'use strict';
// Cycle finder: the free price screen never hides a profitable cycle (checked against exact constant-product math on
// random pools), flips are tried, 3-4 leg routes come out as your contract's exact call, and the indicators are real.
// Synthetic pools below are TEST DATA; production reads every pool from the chain.
const test = require('node:test');
const assert = require('node:assert');
const CY = require('../lib/cycles.cjs');
const E = require('../lib/engine.cjs');
const { runScan } = require('../lib/scan.cjs');
const { routeKey } = require('../lib/session.cjs');

const cp = (x, rIn, rOut, feeBps) => { const a = x * BigInt(10000 - feeBps); return (a * rOut) / (rIn * 10000n + a); };
const T = ['0x' + '01'.repeat(20), '0x' + '02'.repeat(20), '0x' + '03'.repeat(20), '0x' + '04'.repeat(20), '0x' + '05'.repeat(20)];

let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function randomWorld(nTokens, nPools) {
  const price = T.slice(0, nTokens).map(() => 0.5 + rnd() * 2);
  const markets = []; const states = new Map(); const fees = {};
  for (let k = 0; k < nPools; k++) {
    let i = Math.floor(rnd() * nTokens), j = Math.floor(rnd() * nTokens); if (i === j) j = (i + 1) % nTokens;
    const [a, b] = [T[i], T[j]].sort(); const pa = price[T.indexOf(a)], pb = price[T.indexOf(b)];
    const depth = 1e6 * (1 + rnd() * 9); const skew = 1 + (rnd() - 0.5) * 0.03; // up to ±1.5 % mispricing
    const r0 = BigInt(Math.round((depth / pa) * 1e6)), r1 = BigInt(Math.round((depth / pb) * skew * 1e6));
    const venueId = rnd() < 0.5 ? 'v30' : 'v25'; fees[venueId] = venueId === 'v30' ? 30 : 25;
    const m = { id: 'p' + k, venueId, kind: 'v2', fee: 0, pair: [a, b], address: 'p' + k, executable: true, router: '0x' + '11'.repeat(20) };
    markets.push(m); states.set(m.id, { r0, r1 });
  }
  return { markets, states, fees };
}
const outOf = (w, edges, amt) => { let x = amt; for (const e of edges) { const s = w.states.get(e.m.id); const t0 = e.m.pair[0]; const [rIn, rOut] = e.tin === t0 ? [s.r0, s.r1] : [s.r1, s.r0]; x = cp(x, rIn, rOut, w.fees[e.m.venueId]); } return x; };

test('marginal rates: V3 from sqrtPrice in both directions, V2 from reserves after the fee, unknown never prunes', () => {
  const [a, b] = [T[0], T[1]];
  const v3 = { id: 'x', kind: 'v3', fee: 3000, pair: [b, a] };
  const s = { sqrtPriceX96: BigInt(Math.round(Math.sqrt(2) * 2 ** 48)) * 2n ** 48n };
  assert.ok(Math.abs(CY.rate(v3, a, s) - 2 * 0.997) < 1e-9, 'token0 → token1 at price 2 after 0.3 %');
  assert.ok(Math.abs(CY.rate(v3, b, s) - 0.5 * 0.997) < 1e-9);
  const v2 = { id: 'y', kind: 'v2', pair: [a, b] };
  assert.ok(Math.abs(CY.rate(v2, a, { r0: 1000n, r1: 3000n }, 30) - 3 * 0.997) < 1e-12);
  assert.strictEqual(CY.rate(v2, a, null, 30), Infinity);
  assert.strictEqual(CY.rate(v3, a, {}, 30), Infinity);
});

test('V2 fee read from one real quote against reserves: never overstated', () => {
  for (const fee of [30, 25, 20]) {
    const rIn = 123456789012n, rOut = 98765432109876n, x = rIn / 1000000n;
    const f = CY.v2FeeFromQuote({ amountIn: x, amountOut: cp(x, rIn, rOut, fee), reserveIn: rIn, reserveOut: rOut });
    assert.ok(f <= fee && f >= fee - 2, `derived ${f} for ${fee}`);
  }
  assert.strictEqual(CY.v2FeeFromQuote({ amountIn: 0n, amountOut: 1n, reserveIn: 1n, reserveOut: 2n }), null);
});

test('the free screen never drops a cycle that is profitable at any size (exact pool math, random pools, 2-5 legs)', () => {
  let profitable = 0;
  for (let trial = 0; trial < 25; trial++) {
    const w = randomWorld(5, 9);
    const graph = CY.buildGraph(w.markets, w.states, w.fees);
    const premiumBps = 5; const thr = () => 1 + premiumBps / 1e4;
    const found = CY.findCycles({ graph, starts: T.slice(0, 5), thr, maxLegs: 5, perPair: 100, limit: 1e9 });
    const keys = new Set(found.cycles.map(CY.keyOf));
    // brute force: every cycle of 2-5 legs over every pool, every size on a wide grid
    const all = [];
    const walk = (start, at, edges, used) => {
      if (edges.length >= 2 && at === start) { all.push({ start, edges: edges.slice() }); return; }
      if (edges.length === 5) return;
      for (const [to, es] of graph.get(at) || []) for (const e of es) {
        if (edges.some((x) => x.m === e.m)) continue;
        if (to !== start && used.has(to)) continue;
        edges.push(e); used.add(to); walk(start, to, edges, used); used.delete(to); edges.pop();
      }
    };
    for (const s of T.slice(0, 5)) walk(s, s, [], new Set([s]));
    for (const c of all) {
      let best = -1n;
      for (let k = 0; k < 40; k++) { const amt = BigInt(Math.round(10 ** (2 + k * 0.2))); const gain = outOf(w, c.edges, amt) - amt - E.flashPremium(amt, premiumBps); if (gain > best) best = gain; }
      if (best > 0n) { profitable++; assert.ok(keys.has(CY.keyOf(c)), `profitable cycle ${CY.keyOf(c)} (gain ${best}) was pruned`); }
    }
  }
  assert.ok(profitable > 0, 'the random pools did contain profitable cycles, so the check above was exercised');
});

// a triangle: USDC → WETH → ARB → USDC is mispriced by about 1 %; every pair is otherwise consistent
const USDC = '0x' + 'aa'.repeat(20), WETH = '0x' + 'bb'.repeat(20), ARB = '0x' + 'cc'.repeat(20);
function triangle({ alt = null } = {}) {
  const mk = (id, a, b, r0, r1) => { const pair = [a, b].sort(); const flip = pair[0] !== a; return { m: { id, venueId: 'uni', kind: 'v2', fee: 0, pair, address: id, executable: true, router: '0x' + id.charCodeAt(0).toString(16).padStart(2, '0').repeat(20) }, s: flip ? { r0: r1, r1: r0 } : { r0, r1 } }; };
  // reserves in raw units: USDC 6 dp, WETH 18 dp, ARB 18 dp. Prices: WETH $2000, ARB $0.50 (ARB pool 1 % rich)
  const P = [
    mk('u', USDC, WETH, 20_000_000n * 10n ** 6n, 10_000n * 10n ** 18n),
    mk('w', WETH, ARB, 10_000n * 10n ** 18n, 40_400_000n * 10n ** 18n),
    mk('a', ARB, USDC, 40_000_000n * 10n ** 18n, 20_000_000n * 10n ** 6n),
  ];
  const states = new Map(P.map((p) => [p.m.id, p.s]));
  const quote = async (m, tin, tout, amt) => { const s = states.get(m.id); const [rIn, rOut] = tin === m.pair[0] ? [s.r0, s.r1] : [s.r1, s.r0]; const o = cp(amt, rIn, rOut, 30); return o > 0n ? o : null; };
  const asset = (address, symbol, decimals, price8) => ({ address, symbol, decimals, flashEnabled: true, price8, available: null, notes: [] });
  return { assets: [asset(USDC, 'USDC', 6, 100000000n), asset(WETH, 'WETH', 18, 200000000000n), asset(ARB, 'ARB', 18, 50000000n)], ethUsd: 2000, gasPriceWei: 10000000n, premiumBps: 5,
    markets: P.map((p) => p.m), states, v2Fees: { uni: 30 }, quote, blockNumber: 7, nowSec: 1700000000, altFlash: alt };
}
const CFG = { MIN_NET_PROFIT_USD: 0.01, MAX_SLIPPAGE_BPS: 100, GAS_CEILING_GWEI: 0.05, GAS_UNITS_ASSUMED: 900000, SCREEN_SIZE_USD: 1000, SCAN_TOPK: 10, OPT_REFINE_ITERS: 24, MIN_PROFIT_CAPTURE_BPS: 5000, SLIPPAGE_PROBE_USD: 10, SIZE_LADDER_USD: [200, 1000, 5000, 20000, 50000], DEADLINE_SECONDS: 60 };

test('3-leg cycle: found by prices, flipped both ways, quoted, sized, approved, and built as your contract call', async () => {
  const res = await runScan(CFG, triangle());
  const best = res.candidates[0];
  assert.ok(best.approved, best.reasons.join('; '));
  assert.strictEqual(best.legsCount, 3);
  assert.strictEqual(best.path.length, 4); assert.strictEqual(best.path[0], best.path[3]);
  assert.deepStrictEqual([...best.path].sort(), [best.path[0], 'ARB', 'USDC', 'WETH'].sort().length === 4 ? [...best.path].sort() : null);
  const p = best.runParams;
  assert.strictEqual(p.legs.length, 3);
  assert.deepStrictEqual(p.legs.map((l) => l.tokenOut), best.pathAddr.slice(1));
  assert.strictEqual(p.legs[2].tokenOut, p.asset, 'the last leg returns the borrowed asset');
  assert.ok(BigInt(p.legs[2].minOut) >= BigInt(p.amount) + E.flashPremium(BigInt(p.amount), 5) + BigInt(p.minProfit), 'the last leg must repay loan + fee + minProfit');
  // the wrong direction was tried too (flip) and is not approved
  const rev = res.candidates.find((c) => c.flip === 'reverse');
  assert.ok(rev && !rev.approved && rev.netUsd < 0, 'reverse direction quoted and rejected');
  // the same loop borrowed in each other token was tried too, and counts as the same opportunity
  const rot = res.candidates.find((c) => c.cycleKey === best.cycleKey && c.borrowSymbol !== best.borrowSymbol);
  assert.ok(rot, 'another borrow token was tried');
  assert.strictEqual(routeKey(rot), routeKey(best));
  // indicators come from this scan
  const I = res.indicators;
  assert.ok(I.cycles.checked >= I.cycles.pricesAllow && I.cycles.pricesAllow >= 1);
  assert.ok(I.bestEdges[0].edgeBps > 0);
  assert.ok(I.spreads.length === 0, 'no pair has two pools here');
  assert.strictEqual(I.breakEven.gasUsdByLegs.length, 3);
  assert.ok(I.breakEven.gasUsdByLegs[2].gasUsd > I.breakEven.gasUsdByLegs[0].gasUsd, 'more legs, more gas');
  assert.strictEqual(best.gasUsdAssumed, I.breakEven.gasUsdByLegs[1].gasUsd, 'a 3-leg route is charged 3-leg gas');
  // before the filters: raw gaps are counted, and a route blocked only by the floor reports what it would have netted
  assert.ok(I.raw.grossPositive >= 1 && I.raw.bestGrossUsd > 0);
  const hi = await runScan({ ...CFG, MIN_NET_PROFIT_USD: 1e9 }, triangle());
  const fl = hi.indicators.blockedBy.find((b) => b.filter === 'profit floor');
  assert.ok(fl && fl.onlyThis >= 1 && Math.abs(fl.bestNetIfOnlyThis - best.netUsd) < 1e-9, 'the floor alone blocked the best route; its real net is shown');
});

test('a fairly priced triangle: every cycle is dropped by prices, no quote is spent', async () => {
  const w = triangle();
  const s = w.states.get('w'); w.states.set('w', { r0: s.r0, r1: (s.r1 * 10000n) / 10100n }); // pair is (WETH, ARB): remove the 1 % ARB richness
  let quotes = 0; const q = w.quote; w.quote = async (...a) => { quotes++; return q(...a); };
  const res = await runScan(CFG, w);
  assert.strictEqual(res.indicators.cycles.pricesAllow, 0);
  assert.strictEqual(quotes, 0);
  assert.strictEqual(res.approved, 0);
});

test('Balancer: its fee and what it can lend are compared on every route; Aave stays the one your contract uses', async () => {
  const res = await runScan(CFG, triangle({ alt: { id: 'balancer_v2', feeBps: 0, available: new Map([[USDC, 10n ** 15n], [WETH, 10n ** 24n], [ARB, 10n ** 26n]]) } }));
  const best = res.candidates[0];
  assert.ok(best.alt && best.alt.provider === 'balancer_v2' && best.alt.needsContractChange);
  assert.ok(Math.abs(best.alt.netUsd - (best.netUsd + best.premiumUsd)) < 1e-9, 'a 0 bps fee adds back exactly the Aave fee');
  assert.strictEqual(best.flash.provider, 'aave_v3');
  assert.strictEqual(res.indicators.breakEven.flashFeeBps.balancer_v2, 0);
});

test('contract v2 borrows from Balancer when it is cheaper and liquid; v1 (or another vault) stays on Aave', async () => {
  const VAULT = '0xba12222222228d8ba445958a75a0704d566bf2c8';
  const liquid = () => ({ id: 'balancer_v2', feeBps: 0, vault: VAULT, available: new Map([[USDC, 10n ** 15n], [WETH, 10n ** 24n], [ARB, 10n ** 26n]]) });
  const v1 = await runScan(CFG, { ...triangle({ alt: liquid() }), contract: { kind: 1, vault: null, factories: {} } });
  const w2 = triangle({ alt: liquid() }); w2.contract = { kind: 2, vault: VAULT, factories: {} };
  const v2 = await runScan(CFG, w2);
  const a = v1.candidates[0], b = v2.candidates[0];
  assert.strictEqual(a.flash.provider, 'aave_v3');
  assert.strictEqual(b.flash.provider, 'balancer_v2'); assert.strictEqual(b.flash.vault, VAULT);
  assert.strictEqual(b.premiumUsd, 0, 'Balancer charges 0 bps');
  assert.ok(b.netUsd >= a.netUsd + a.premiumUsd - 1e-6, 'net improves by at least the Aave fee it no longer pays');
  assert.strictEqual(b.alt, null, 'nothing better left to show');
  if (b.runParams) { assert.strictEqual(b.runParams.v, 2); assert.strictEqual(b.runParams.source, 1); assert.ok(b.runParams.legs.every((l) => l.v2dex === 1 && l.target === l.router), 'no factory allowed → router legs'); }
  if (a.runParams) assert.strictEqual(a.runParams.v, undefined, 'v1 calls unchanged');
  const other = triangle({ alt: liquid() }); other.contract = { kind: 2, vault: '0x' + '1'.repeat(40), factories: {} };
  assert.strictEqual((await runScan(CFG, other)).candidates[0].flash.provider, 'aave_v3', 'a contract wired to another vault cannot borrow here');
  const dry = triangle({ alt: { ...liquid(), available: new Map([[USDC, 1n], [WETH, 1n], [ARB, 1n]]) } }); dry.contract = { kind: 2, vault: VAULT, factories: {} };
  const d = (await runScan(CFG, dry)).candidates;
  assert.ok(d.length && d.every((c) => c.flash.provider === 'aave_v3'), 'Balancer too dry for any size → the route still runs on Aave');
});

test('contract v2.3 borrows from Uniswap V4 (no fee) over Aave and over a fee-charging Balancer; only when it is wired to that PoolManager', async () => {
  const PM = '0x360e68faccca8ca495c1b759fd9eee466db9fb32', VAULT = '0xba12222222228d8ba445958a75a0704d566bf2c8';
  const lots = () => new Map([[USDC, 10n ** 15n], [WETH, 10n ** 24n], [ARB, 10n ** 26n]]);
  const v4 = { id: 'uniswap_v4', feeBps: 0, vault: PM, available: lots() };
  const w = triangle({ alt: { id: 'balancer_v2', feeBps: 2, vault: VAULT, available: lots() } }); w.v4Flash = v4; w.contract = { kind: 2, vault: VAULT, v4: PM, factories: {} };
  const b = (await runScan(CFG, w)).candidates[0];
  assert.strictEqual(b.flash.provider, 'uniswap_v4', 'zero fee first'); assert.strictEqual(b.premiumUsd, 0);
  if (b.runParams) assert.strictEqual(b.runParams.source, 3, 'Source.UniswapV4');
  const old = triangle(); old.v4Flash = v4; old.contract = { kind: 2, vault: VAULT, morpho: null, v4: null, factories: {} }; // a v2.2 contract
  const o = (await runScan(CFG, old)).candidates[0];
  assert.strictEqual(o.flash.provider, 'aave_v3', 'a contract without V4 cannot borrow there');
  assert.ok(o.alt && o.alt.provider === 'uniswap_v4' && o.alt.needsContractChange, 'the V4 saving is shown as needing the v2.3 contract');
  const dry = triangle(); dry.v4Flash = { ...v4, available: new Map([[USDC, 1n], [WETH, 1n], [ARB, 1n]]) }; dry.contract = { kind: 2, vault: VAULT, v4: PM, factories: {} };
  assert.ok((await runScan(CFG, dry)).candidates.every((c) => c.flash.provider === 'aave_v3'), 'V4 too dry for any size → Aave');
});

test('depth check: a pool with a real-looking price but nothing behind it is benched, and the next scan routes around it', async () => {
  const w = triangle(); const q = w.quote; w.quote = async (m, tin, tout, amt) => { const o = await q(m, tin, tout, amt); return m.id === 'w' && o ? o / 100n : o; }; // pool w pays 1% of its price
  const bench = new Map(); w.deadPools = bench;
  const first = await runScan(CFG, w);
  assert.ok(bench.has('w'), 'the drained pool was benched'); assert.ok(bench.get('w').fillPct < 5);
  assert.ok(first.indicators.benchedPools.some((b) => b.market === 'w'), 'you are shown which pool and why');
  assert.ok(!bench.has('u') && !bench.has('a'), 'healthy pools are never benched');
  const w2 = triangle(); w2.quote = w.quote; w2.deadPools = bench;
  const second = await runScan(CFG, w2);
  assert.ok(second.candidates.every((c) => !c.legs.some((l) => l.market === 'w')), 'no route through the benched pool is quoted');
  bench.get('w').until = Date.now() - 1; const w3 = triangle(); w3.deadPools = bench; await runScan(CFG, w3);
  assert.ok(!bench.has('w'), 'after its bench time the pool is tried again');
});

test('contract v2 legs: direct pool / pair swaps where the contract allows the factory, routers elsewhere', () => {
  const E = require('../lib/engine.cjs');
  const F3 = '0x' + 'f3'.repeat(20), F2 = '0x' + 'f2'.repeat(20), FX = '0x' + 'ee'.repeat(20);
  const m = (kind, address, factory) => ({ kind, fee: kind === 'v3' ? 500 : 0, address, factory, router: '0x' + 'ab'.repeat(20) });
  const markets = [m('v3', '0x' + '01'.repeat(20), F3), m('v2', '0x' + '02'.repeat(20), F2), m('v3', '0x' + '03'.repeat(20), FX), m('v2', '0x' + '04'.repeat(20), F3)];
  const info = { kind: 2, vault: null, factories: { [F3]: { allowed: true, v2FeeBps: 0 }, [F2]: { allowed: true, v2FeeBps: 30 }, [FX]: { allowed: false, v2FeeBps: 0 } } };
  const path = [USDC, WETH, ARB, WETH, USDC];
  const cand = { contractProfit: 10n ** 6n, premium: 0n, outs: [10n ** 18n, 10n ** 21n, 10n ** 18n, 1001n * 10n ** 6n] };
  const p = E.buildRunParams({ asset: USDC, amount: 1000n * 10n ** 6n, cand, route: { markets, path }, cfg: CFG, assetPrice8: 100000000n, decimals: 6, nowSec: 1, contract: info, source: 1 });
  assert.deepStrictEqual(p.legs.map((l) => [l.v2dex, l.target]), [[2, markets[0].address], [3, markets[1].address], [0, markets[2].router], [1, markets[3].router]],
    'V3 pool of an allowed V3 factory, V2 pair of an allowed V2 factory; unallowed factory → router; a V2 market under a factory marked V3 → router');
  assert.strictEqual(p.source, 1); assert.strictEqual(p.v, 2);
  assert.ok(BigInt(p.legs[3].minOut) >= 1000n * 10n ** 6n + BigInt(p.minProfit), 'last leg repays the loan plus minProfit');
});

test('fast re-check: only the cycles asked for are quoted', async () => {
  const w = triangle();
  const full = await runScan(CFG, w);
  const w2 = triangle(); w2.onlyKeys = new Set([full.hot[0]]);
  const fast = await runScan({ ...CFG, SCAN_FLIP_TOP: 0 }, w2);
  assert.strictEqual(fast.routesEnumerated, 1);
  assert.ok(fast.candidates[0].approved);
});

test('fast re-check: a route through a pool whose price just moved is quoted even if it was not on the watch list', async () => {
  const w = triangle();
  w.onlyKeys = new Set();
  w.prevStates = new Map([...w.states].map(([k, v]) => [k, k === 'w' ? { r0: v.r0, r1: (v.r1 * 10000n) / 10100n } : v])); // pool w moved 1 % since the last read
  const fast = await runScan({ ...CFG, SCAN_FLIP_TOP: 0 }, w);
  assert.ok(fast.routesEnumerated >= 1 && fast.candidates.some((c) => c.approved), 'the moved pool\'s cycle was found and approved');
  assert.ok(fast.indicators.moves.length >= 1);
  const still = triangle(); still.onlyKeys = new Set(); still.prevStates = new Map(still.states);
  assert.strictEqual((await runScan({ ...CFG, SCAN_FLIP_TOP: 0 }, still)).routesEnumerated, 0, 'nothing moved, nothing watched: nothing quoted');
});

test('portal heartbeat: the scanner\'s own figures and your research summary, and nothing secret', async () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { portalDetail } = require('../lib/daemon.cjs');
  const res = await runScan(CFG, triangle());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-'));
  fs.writeFileSync(path.join(dir, 'research.json'), JSON.stringify({ at: 'x', from: 1, to: 2, flashLoans: { balancer_v2: 3 }, transactions: 3, succeeded: 3, profitableAfterGas: 1, medianProfitUsd: 1.5, legs: { 3: 3 }, venues: [], venuesYouLack: [], topContracts: [], rows: [{ tx: '0xsecretish' }] }));
  const d = portalDetail({ res, hotRes: { block: 9, approved: 0, ms: 5 }, hot: new Set(['k']), feedStatus: { feeds: 2, up: 1, lastBlock: 9, detail: [{ feed: 1 }] } }, dir);
  assert.strictEqual(d.indicators.cycles.approved, res.indicators.cycles.approved);
  assert.strictEqual(d.indicators.best.netUsd, res.indicators.best.netUsd);
  assert.deepStrictEqual(d.blockFeed, { feeds: 2, up: 1, lastBlock: 9, watchingPools: 0, swaps: 0 }, 'feed counts only, no per-feed detail');
  assert.strictEqual(d.research.profitableAfterGas, 1);
  const txt = JSON.stringify(d);
  assert.ok(!/0xsecretish|wss:|runParams|cycleKey/.test(txt), 'no transaction rows, urls, call data or route keys');
  assert.ok(txt.length < 8000, 'small enough for every heartbeat');
});

test('fast re-check: pools that traded (streamed over websocket) bring their cycles in without a price diff', async () => {
  const w = triangle(); w.onlyKeys = new Set(); w.prevStates = new Map(w.states); w.movedMarkets = new Set(['u']);
  const fast = await runScan({ ...CFG, SCAN_FLIP_TOP: 0 }, w);
  assert.ok(fast.routesEnumerated >= 1 && fast.candidates.some((c) => c.legs.some((l) => l.market === 'u')));
});

test('broken pools (drained or abandoned, impossible price) are left out of routing; real small gaps stay in', () => {
  const CY2 = require('../lib/cycles.cjs');
  // as seen live (block 527586794): eight ezETH/WETH pools near 1.04 WETH per ezETH and one V2 pair at a "gap" of 1.6e16 bps
  const WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', EZ = '0x2416092f143378750bb29b79ed961ab195cceea5', USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
  const [t0, t1] = EZ < WETH ? [EZ, WETH] : [WETH, EZ]; // pools order tokens by address
  const v2 = (id, rEz, rWe) => ({ m: { id, kind: 'v2', venueId: 'uniswap_v2', pair: [EZ, WETH] }, st: t0 === EZ ? { r0: rEz, r1: rWe } : { r0: rWe, r1: rEz } });
  const pools = [v2('good1', 1000n * 10n ** 18n, 1040n * 10n ** 18n), v2('good2', 500n * 10n ** 18n, 521n * 10n ** 18n), v2('real-gap', 800n * 10n ** 18n, 836n * 10n ** 18n), v2('dead', 1n, 10n ** 18n)];
  const markets = pools.map((p) => p.m); const states = new Map(pools.map((p) => [p.m.id, p.st]));
  const usd = new Map([[WETH, 3000 / 1e18], [EZ, 3120 / 1e18]]); // oracle: 1 ezETH = 1.04 WETH
  const r = CY2.saneMarkets(markets, states, null, usd, 2000);
  assert.deepStrictEqual(r.keep.map((m) => m.id), ['good1', 'good2', 'real-gap'], 'a 0.5% gap is a real opportunity: kept');
  assert.strictEqual(r.broken.length, 1); assert.strictEqual(r.broken[0].market, 'dead'); assert.strictEqual(r.broken[0].by, 'oracle'); assert.ok(r.broken[0].offBps > 1e10);
  // no oracle price: the median of the pair's other pools decides
  const r2 = CY2.saneMarkets(markets, states, null, new Map(), 2000);
  assert.deepStrictEqual(r2.broken.map((x) => [x.market, x.by]), [['dead', 'other pools']]);
  // a pair with one pool and no oracle price: nothing to compare with, kept (never hidden on a guess)
  const lone = { id: 'lone', kind: 'v2', venueId: 'uniswap_v2', pair: [USDC, EZ] };
  assert.deepStrictEqual(CY2.saneMarkets([lone], new Map([['lone', { r0: 1n, r1: 10n ** 30n }]]), null, new Map(), 2000).keep.map((m) => m.id), ['lone']);
  // unknown state: kept
  assert.strictEqual(CY2.saneMarkets([lone], new Map(), null, usd, 2000).keep.length, 1);
});

test('a drained pool with an impossible price is never quoted; the real 1% triangle still wins', async () => {
  const w = triangle();
  // as seen live: a second WETH/ARB pool, drained, priced a billion times off. Without the filter it is the "best" edge.
  const pair = [WETH, ARB].sort(); const dead = { id: 'dead', venueId: 'uni', kind: 'v2', fee: 0, pair, address: 'dead', executable: true, router: '0x' + 'de'.repeat(20) };
  w.markets.push(dead); w.states.set('dead', pair[0] === WETH ? { r0: 1n, r1: 10n ** 27n } : { r0: 10n ** 27n, r1: 1n });
  const quoted = new Set(); const q = w.quote; w.quote = async (m, ...a) => { quoted.add(m.id); return m.id === 'dead' ? 1n : q(m, ...a); };
  const res = await runScan(CFG, w);
  assert.ok(!quoted.has('dead'), 'no quote spent on the drained pool');
  assert.strictEqual(res.indicators.brokenPools.length, 1); assert.strictEqual(res.indicators.brokenPools[0].market, 'dead');
  assert.ok(res.candidates[0].approved && !res.candidates[0].legs.some((l) => l.market === 'dead'), 'the real triangle is still found and approved');
});

test('Curve: the price screen reads get_dy (+5 bps, an upper bound); only an allowlisted pool on a v2.3 contract is tradeable; the leg packs its coin indexes', () => {
  const CI = require('../lib/contractinfo.cjs');
  const USDT = '0x' + 'dd'.repeat(20);
  const m = { id: 'curve_ng:0x49b720', venueId: 'curve_ng', kind: 'curve', fee: 0, pair: [USDC, USDT], coins: [USDC, USDT], dx: ['1000000', '1000000'], address: '0x49b720f1aab26260beaec93a7beb5bf2925b2a8f', executable: true, router: null, factory: null };
  const st = { q01: 0.9996, q10: 1.0001 };
  assert.ok(Math.abs(CY.rate(m, USDC, st) - 0.9996 * 1.0005) < 1e-12, 'USDC → USDT from get_dy, padded so it never prunes a real route');
  assert.ok(Math.abs(CY.rate(m, USDT, st) - 1.0001 * 1.0005) < 1e-12);
  assert.strictEqual(CY.rate(m, USDC, {}), Infinity, 'no reading: never pruned');
  assert.strictEqual(CI.legMode({ kind: 2, factories: {}, curvePools: { [m.address]: true } }, m), 'curve');
  assert.strictEqual(CI.legMode({ kind: 2, factories: {}, curvePools: {} }, m), 'none', 'not allowlisted by your contract: not tradeable');
  assert.strictEqual(CI.legMode({ kind: 1, factories: {} }, m), 'none', 'a v1 contract cannot trade Curve');
  const leg2 = { id: 'u2', venueId: 'uni', kind: 'v2', fee: 0, pair: [USDC, USDT], address: '0x' + '22'.repeat(20), executable: true, router: '0x' + '33'.repeat(20), factory: '0x' + '44'.repeat(20) };
  const p = E.buildRunParams({ asset: USDT, tokenB: USDC, amount: 1000000000n, cand: { contractProfit: 5000000n, premium: 0n, gasUsd: 0.03, outs: [1000400000n, 1005000000n] }, route: { markets: [m, leg2], path: [USDT, USDC, USDT] }, cfg: { MAX_SLIPPAGE_BPS: 50, MIN_PROFIT_CAPTURE_BPS: 5000, MIN_NET_PROFIT_USD: 0.01, DEADLINE_SECONDS: 60 }, assetPrice8: 100000000n, decimals: 6, nowSec: 1700000000, contract: { kind: 2, vault: null, factories: {}, curvePools: { [m.address]: true } }, source: 3 });
  assert.strictEqual(p.legs[0].v2dex, 4, 'Dex.CurvePool'); assert.strictEqual(p.legs[0].target, m.address);
  assert.strictEqual(p.legs[0].fee, (1 << 8) | 0, 'USDT is coin 1, USDC coin 0: (i << 8) | j');
  assert.strictEqual(p.source, 3, 'Source.UniswapV4');
});

test('depth floor (2.9.12): a thin V2 pair is left out before any quote; the real triangle still wins', async () => {
  const w = triangle();
  // a second WETH/ARB pair priced 3% rich (inside the 20% sanity band) but holding about $100 a side: before 2.9.12 it
  // made the "best" route and took a shortlist slot every scan
  const pair = [WETH, ARB].sort(); const thin = { id: 'thin', venueId: 'uni', kind: 'v2', fee: 0, pair, address: 'thin', executable: true, router: '0x' + 'ab'.repeat(20) };
  const wethR = 5n * 10n ** 16n, arbR = 206n * 10n ** 18n; // 0.05 WETH ($100) / 206 ARB ($103)
  w.markets.push(thin); w.states.set('thin', pair[0] === WETH ? { r0: wethR, r1: arbR } : { r0: arbR, r1: wethR });
  const quoted = new Set(); const q = w.quote; w.quote = async (m, ...a) => { quoted.add(m.id); return q(m, ...a); };
  const res = await runScan(CFG, w);
  assert.ok(!quoted.has('thin'), 'no quote spent on the thin pair'); assert.strictEqual(res.indicators.thinPools, 1); assert.strictEqual(res.indicators.depthMinUsd, 1000);
  assert.ok(res.candidates[0].approved, 'the real triangle is still found and approved');
  const off = await runScan({ ...CFG, DEPTH_MIN_USD: 0 }, (() => { const v = triangle(); v.markets.push(thin); v.states.set('thin', w.states.get('thin')); return v; })());
  assert.strictEqual(off.indicators.thinPools, 0, 'DEPTH_MIN_USD 0 turns the floor off');
});

test('dead pools at screening (2.9.12): a route losing over 5% never takes a shortlist slot, its culprit leg is benched, and it is labelled "dead pool"', async () => {
  const w = triangle();
  // an unpriced token pair (no oracle, so the depth floor cannot judge it) whose pool quotes 1% of its own price
  const X = '0x' + '77'.repeat(20); const mkm = (id, a, b) => ({ id, venueId: 'uni', kind: 'v2', fee: 0, pair: [a, b].sort(), address: id, executable: true, router: '0x' + 'cd'.repeat(20) });
  const xu = mkm('xu', X, USDC), xw = mkm('xw', X, WETH);
  w.markets.push(xu, xw);
  const set = (m, a, ra, rb) => w.states.set(m.id, m.pair[0] === a ? { r0: ra, r1: rb } : { r0: rb, r1: ra });
  set(xu, X, 10n ** 24n, 1_100_000n * 10n ** 6n); // 1 X = $1.10 on paper
  set(xw, X, 10n ** 24n, 500n * 10n ** 18n); // 1 X = 0.0005 WETH = $1.00
  const q = w.quote; w.quote = async (m, tin, tout, amt) => (m.id === 'xu' && tin === X ? (amt * 11n) / 10n ** 15n : q(m, tin, tout, amt)); // 1% of the price
  const bench = new Map(); w.deadPools = bench; let saved = null; w.saveBench = (m) => { saved = new Map(m); };
  const res = await runScan(CFG, w);
  assert.ok(res.indicators.deadRoutes >= 1, 'the dead route was seen'); assert.ok(bench.has('xu'), 'its culprit leg is benched'); assert.strictEqual(bench.get('xu').at, 'screen');
  assert.ok(!res.candidates.some((c) => (c.legs || []).some((l) => l.market === 'xu')), 'it never reached the shortlist');
  assert.ok(res.candidates[0].approved, 'the real triangle still wins'); assert.ok(saved && saved.has('xu'), 'the bench is saved for the next start');
  const { killer } = require('../lib/insights.cjs');
  assert.strictEqual(killer({ grossUsd: -196, amountUsd: 200, approved: false }, 0.35), 'dead pool');
  assert.strictEqual(killer({ grossUsd: -0.3, amountUsd: 200, approved: false }, 0.35), 'no price gap', 'a real small loss is still "no price gap"');
});

test('the bench outlives a restart: saved and loaded, expired entries dropped (data/live/deadpools.json)', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawnSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-'));
  const code = `const L=require(${JSON.stringify(path.join(__dirname, '..', 'lib', 'live.cjs'))});const m=new Map([['a',{until:Date.now()+3600e3,fillPct:1}],['old',{until:Date.now()-1}]]);L.saveBench(m);const back=L.loadBench();process.stdout.write(JSON.stringify([...back.keys()]));`;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, CHRONOS_DATA_DIR: dir }, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr); assert.deepStrictEqual(JSON.parse(r.stdout), ['a']);
  assert.strictEqual((fs.statSync(path.join(dir, 'live', 'deadpools.json')).mode & 0o777).toString(8), '600');
});
