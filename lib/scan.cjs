'use strict';
// Orchestration: find every cycle the pools' own prices allow, flip the best ones (other direction, other borrow
// token), quote all of them for real at one block, optimise the best sizes, apply guardrails, and report the
// profitability indicators. Takes its data through `deps`, so tests can feed synthetic pools and production feeds the chain.
const E = require('./engine.cjs');
const CY = require('./cycles.cjs');
const { limiter } = require('./batch.cjs');

const jsonSafe = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== undefined && v !== '' ? Number(v) : d);

async function runScan(cfg, deps) {
  const t0 = Date.now();
  const byAddr = new Map(deps.assets.map((a) => [a.address.toLowerCase(), a]));
  const info = deps.tokenInfo || new Map();
  const sym = (a) => ((byAddr.get(a) || {}).symbol || (info.get(a) || {}).symbol || a.slice(0, 8));
  const gasGwei = Number(deps.gasPriceWei) / 1e9;
  // gas for n legs: your GAS_UNITS_ASSUMED covers the flash loan + 2 swaps; it is scaled per leg (conservative: the
  // flash-loan overhead is counted again per leg). The shadow test measures the real gas of the exact call before anything is sent.
  // the gas specialist's measured units (lib/gas.cjs): this route's type, else its leg count, else the assumption
  const G = deps.gasUnits || {};
  const gasUsdFor = (n, kinds = null, lender = null) => E.gasCostUsd({ gasPriceWei: deps.gasPriceWei, gasUnits: (kinds && G[`${lender || 'aave_v3'}|${kinds.join(',')}`]) || G[String(n)] || (cfg.GAS_UNITS_ASSUMED * n) / 2, ethUsd: deps.ethUsd });
  const gasUsd = gasUsdFor(2);
  // the longest route: your setting, never more than the deployed contract accepts (read from it; 4 when unknown)
  const contractLegs = (deps.contract && deps.contract.kind === 2 && deps.contract.maxLegs) || cfg.MAX_LEGS || 4;
  const maxLegs = Math.max(2, Math.min(contractLegs, num(cfg.SCAN_MAX_LEGS, 4)));
  const isStart = (a) => { const x = byAddr.get(a); return !!(x && x.flashEnabled && x.price8 && x.price8 > 0n && x.decimals !== null); };
  const alt = deps.altFlash || null; // { id, feeBps, available: Map(asset → raw amount) } read from the chain this scan
  const altFor = (a) => (alt && alt.available && alt.available.get(a) > 0n ? alt : null);
  const cheapestBps = (a) => Math.min(deps.premiumBps, altFor(a) ? alt.feeBps : Infinity);
  const thr = (a) => 1 + cheapestBps(a) / 1e4;

  // 1. every cycle the pools' marginal prices allow (no quotes spent; see cycles.cjs for why this never hides a profit)
  // 0. pools with an impossible price (drained, abandoned) are left out of routing, spreads and indicators: they only
  // produced fake gaps that used up the scan's quotes (cycles.cjs saneMarkets). Reported as brokenPools.
  const usdPerRaw = new Map(deps.assets.filter((a) => a.price8 && a.price8 > 0n && a.decimals !== null).map((a) => [a.address.toLowerCase(), Number(a.price8) / 1e8 / 10 ** a.decimals]));
  // depth floor per side for V2 pairs (DEPTH_MIN_USD; default the larger of $1,000 and 5× the smallest trade size)
  const minLadder = Math.min(...(cfg.SIZE_LADDER_USD || [200]).map(Number).filter((x) => x > 0));
  const depthMinUsd = num(cfg.DEPTH_MIN_USD ?? process.env.DEPTH_MIN_USD, Math.max(1000, 5 * (Number.isFinite(minLadder) ? minLadder : 200)));
  const sane = CY.saneMarkets(deps.markets, deps.states || null, deps.v2Fees || null, usdPerRaw, num(cfg.SCAN_MAX_POOL_DEVIATION_BPS ?? process.env.SCAN_MAX_POOL_DEVIATION_BPS, 2000), depthMinUsd);
  // pools benched by the depth check (below): a price that looks real but almost nothing behind it
  const bench = deps.deadPools instanceof Map ? deps.deadPools : new Map(); const nowMs = Date.now();
  for (const [id, b] of bench) if (b.until <= nowMs) bench.delete(id);
  deps = { ...deps, allMarkets: deps.markets, markets: sane.keep.filter((m) => !bench.has(m.id)) };
  const graph = CY.buildGraph(deps.markets, deps.states || null, deps.v2Fees || null);
  const starts = [...byAddr.keys()].filter(isStart);
  const found = CY.findCycles({ graph, starts, thr, maxLegs, perPair: num(cfg.SCAN_PER_PAIR, 2), limit: num(cfg.SCAN_MAX_CYCLES, 5000) });
  // fast lane: the cycles asked for, plus every cycle through a pool whose price moved since the previous read
  const moved = deps.onlyKeys ? new Set([...(deps.states && deps.prevStates ? CY.moves(deps.markets, deps.states, deps.prevStates).map((x) => x.market) : []), ...(deps.movedMarkets || [])]) : null;
  // chain signals (lib/chainsignals.cjs): within the quote budget, routes shaped like the trades that win on chain
  // (their venues, venue pairs, start token, length) are quoted first; routes shaped like reverting trades go last.
  // Order only: every route is still quoted and judged by the same rules.
  const pool0 = deps.onlyKeys ? found.cycles.filter((c) => deps.onlyKeys.has(CY.keyOf(c)) || (moved && c.edges.some((e) => moved.has(e.m.id)))) : found.cycles;
  const ordered = typeof deps.routePrior === 'function'
    ? pool0.map((c, i) => ({ c, i, s: deps.routePrior({ legs: c.edges.length, venues: c.edges.map((e) => e.m.venueId), asset: c.start }) || 0 })).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.c)
    : pool0;
  const base = ordered.slice(0, num(cfg.SCAN_QUOTE_CYCLES, 400));
  // 2. flips: the best cycles are also tried the other way round and borrowed in every other flash-loanable token on them
  const seen = new Set(base.map(CY.keyOf));
  const flips = [];
  for (const c of base.slice(0, num(cfg.SCAN_FLIP_TOP, 60))) {
    for (const f of [CY.reverse(c, graph), ...CY.rotations(c, isStart)]) { const k = CY.keyOf(f); if (!seen.has(k)) { seen.add(k); flips.push(f); } }
  }
  const routes = [...base, ...flips].map((c, idx) => {
    const asset = byAddr.get(c.start);
    const path = [c.start, ...c.edges.map((e) => e.tout)];
    return { idx, c, asset, borrow: c.start, path, markets: c.edges.map((e) => e.m), edges: c.edges, n: c.edges.length };
  });

  const mkEval = (r, premiumBps, lender = 'aave_v3') => {
    const gasAsset = E.usdToAsset(gasUsdFor(r.n, r.markets.map((m) => m.kind), lender), r.asset.price8, r.asset.decimals);
    return (amount) => E.evaluateCycle({ amount, premiumBps, gasCostAsset: gasAsset, legs: r.edges.map((e) => (a) => deps.quote(e.m, e.tin, e.tout, a)) });
  };

  // 3. real quotes at one size for every route (concurrent; the batcher packs them at the scan's block)
  const lim = limiter(Number(cfg.SCAN_PARALLEL || process.env.SCAN_PARALLEL || 64));
  const progress = (phase, done, total) => { if (deps.onProgress) { try { deps.onProgress({ phase, done, total }); } catch (_) { /* display only */ } } };
  let screenedDone = 0;
  progress('screen', 0, routes.length);
  const screenedRaw = await Promise.all(routes.map((r) => lim(async () => {
    try {
      const amount = E.usdToAsset(cfg.SCREEN_SIZE_USD, r.asset.price8, r.asset.decimals);
      if (r.asset.available !== null && amount > r.asset.available) return null;
      const res = await mkEval(r, deps.premiumBps)(amount);
      if (!res) return null;
      const out = { r, screenNetUsd: E.assetToUsd(res.net, r.asset.price8, r.asset.decimals), screenGrossUsd: E.assetToUsd(res.gross, r.asset.price8, r.asset.decimals) };
      // a route that loses more than DEAD_LOSS_PCT (5%) of its size at the screening size is no arbitrage: it runs
      // through a pool with a price and nothing behind it. The leg that falls furthest below its own price is benched
      // when it fills under DEPTH_MIN_FILL at this size, and the route never takes a shortlist slot (2.9.12).
      if (out.screenGrossUsd < -num(cfg.DEAD_LOSS_PCT, 5) / 100 * Number(cfg.SCREEN_SIZE_USD)) {
        let worst = null;
        for (let i = 0; i < r.n; i++) { const er = r.edges[i].r; if (!(Number.isFinite(er) && er > 0) || !(res.ins[i] > 0n)) continue; const fill = Number(res.outs[i]) / Number(res.ins[i]) / er; if (!worst || fill < worst.fill) worst = { i, fill }; }
        if (worst && worst.fill < num(cfg.DEPTH_MIN_FILL, 0.5)) { const e = r.edges[worst.i]; bench.set(e.m.id, { until: Date.now() + num(cfg.DEPTH_BENCH_HOURS, 6) * 3600000, fillPct: Math.round(worst.fill * 1000) / 10, pair: [sym(e.tin), sym(e.tout)], venue: e.m.venueId, at: 'screen' }); }
        out.dead = true;
      }
      return out;
    } finally { progress('screen', ++screenedDone, routes.length); }
  })));
  const deadRoutes = screenedRaw.filter((x) => x && x.dead).length;
  const screened = screenedRaw.filter((x) => x && !x.dead);
  screened.sort((a, b) => b.screenNetUsd - a.screenNetUsd || a.r.idx - b.r.idx);
  // the shortlist: the best routes, plus every flip of a shortlisted route (both directions are always decided by quotes)
  const top = screened.slice(0, cfg.SCAN_TOPK);
  const inTop = new Set(top.map((x) => CY.keyOf(x.r.c)));
  for (const x of screened) if (x.r.c.flipOf && inTop.has(x.r.c.flipOf) && !inTop.has(CY.keyOf(x.r.c))) { top.push(x); inTop.add(CY.keyOf(x.r.c)); }

  // 4. full optimisation + guardrails on the shortlist
  const optLim = limiter(Math.max(8, Number(cfg.SCAN_TOPK) || 8));
  let optDone = 0;
  progress('optimise', 0, top.length);
  const optimised = await Promise.all(top.map(({ r }) => optLim(async () => {
    try {
      // the lender: Balancer when the deployed contract can borrow from it (v2, same vault), it is cheaper and it holds
      // this asset; otherwise Aave. Sizes are capped by the chosen lender's liquidity.
      const sizes = cfg.SIZE_LADDER_USD.map((u) => E.usdToAsset(u, r.asset.price8, r.asset.decimals)).filter((a) => a > 0n);
      const fits = (cap) => sizes.filter((a) => cap === null || cap === undefined || a <= cap);
      // the lender: zero fee first. Uniswap V4, Morpho Blue or Balancer when the deployed contract borrows from that
      // exact one, it is cheaper than Aave and holds enough of this asset; the cheapest first, then the one holding more.
      // Aave (5 bps) only when none of them can lend the size.
      const usable = [altFor(r.borrow) && deps.contract && deps.contract.kind === 2 && deps.contract.vault && alt.vault === deps.contract.vault ? alt : null,
        deps.morphoFlash && deps.morphoFlash.available.get(r.borrow) > 0n && deps.contract && deps.contract.kind === 2 && deps.contract.morpho === deps.morphoFlash.vault ? deps.morphoFlash : null,
        deps.v4Flash && deps.v4Flash.available.get(r.borrow) > 0n && deps.contract && deps.contract.kind === 2 && deps.contract.v4 === deps.v4Flash.vault ? deps.v4Flash : null]
        .filter((l) => l && l.feeBps < deps.premiumBps && fits(l.available.get(r.borrow)).length)
        .sort((x, y) => x.feeBps - y.feeBps || (y.available.get(r.borrow) > x.available.get(r.borrow) ? 1 : -1));
      const bal = usable[0] || null;
      const useBal = !!bal; // a lender other than Aave (Balancer or Morpho); too dry for the smallest size → Aave
      const feeBps = useBal ? bal.feeBps : deps.premiumBps;
      const lendable = useBal ? bal.available.get(r.borrow) : r.asset.available;
      const ladder = fits(lendable);
      if (!ladder.length) return null;
      const lenderId = useBal ? bal.id : 'aave_v3'; const routeGasUsd = gasUsdFor(r.n, r.markets.map((m) => m.kind), lenderId); // this route's own gas
      const best = await E.optimizeSize(mkEval(r, feeBps, lenderId), ladder, cfg.OPT_REFINE_ITERS);
      if (!best) return null;
      // price impact per leg against a small probe pushed through the same legs
      const probe = E.usdToAsset(cfg.SLIPPAGE_PROBE_USD, r.asset.price8, r.asset.decimals);
      const impacts = [];
      let pin = probe;
      for (let i = 0; i < r.n; i++) {
        const pout = pin ? await deps.quote(r.edges[i].m, r.edges[i].tin, r.edges[i].tout, pin) : null;
        // depth check: a tiny probe should get about the pool's own price. Under half of it means the pool has a
        // price but almost nothing behind it (drained, abandoned): benched for DEPTH_BENCH_HOURS (default 6) so it
        // stops taking the scan's quotes. Unknown price (rate not finite) is never benched.
        const er = r.edges[i].r;
        if (pin && pout !== null && pout !== undefined && Number.isFinite(er) && er > 0) {
          const got = Number(pout) / Number(pin) / er; // 0n out counts as 0% filled (it used to skip the bench)
          if (got < num(cfg.DEPTH_MIN_FILL, 0.5)) bench.set(r.edges[i].m.id, { until: Date.now() + num(cfg.DEPTH_BENCH_HOURS, 6) * 3600000, fillPct: Math.round(got * 1000) / 10, pair: [sym(r.edges[i].tin), sym(r.edges[i].tout)], venue: r.edges[i].m.venueId });
        }
        impacts.push(pout ? E.impactBps({ amountIn: best.ins[i], amountOut: best.outs[i], probeIn: pin, probeOut: pout }) : null);
        pin = pout || null;
      }
      const netUsd = E.assetToUsd(best.net, r.asset.price8, r.asset.decimals);
      const premiumUsd = E.assetToUsd(best.premium, r.asset.price8, r.asset.decimals);
      const cand = { ...best, netUsd, gasUsd: routeGasUsd, impacts, impact1: impacts[0], impact2: impacts[r.n - 1] }; // gasUsd: the floor is 2× this route's gas
      // a Curve pool is tradeable only through a v2.3+ contract that allowlists it (there is no router path)
      const ex = (m) => (m.kind !== 'curve' ? m : { ...m, executable: !!(m.executable && deps.contract && deps.contract.kind === 2 && deps.contract.curvePools && deps.contract.curvePools[m.address]) });
      const rms = r.markets.map(ex);
      const route = { markets: rms, path: r.path, buy: rms[0], sell: rms[r.n - 1] };
      const decision = E.decide({ cand, cfg: { ...cfg, MAX_LEGS: contractLegs }, gasGwei, assetUsd: null, route, availableLiquidity: lendable, flashEnabled: useBal ? true : r.asset.flashEnabled });
      const a = useBal ? null : [deps.v4Flash, deps.morphoFlash, altFor(r.borrow)].find((l) => l && l.available.get(r.borrow) > 0n) || null; // what another lender would give (shown, not used): zero fee first
      const altOut = a && a.available.get(r.borrow) >= best.amount ? (() => {
        const fee = E.flashPremium(best.amount, a.feeBps);
        const feeUsd = E.assetToUsd(fee, r.asset.price8, r.asset.decimals);
        return { provider: a.id, feeBps: a.feeBps, feeUsd, netUsd: netUsd + premiumUsd - feeUsd, needsContractChange: !(deps.contract && deps.contract.kind === 2 && (a.id === 'morpho_blue' ? deps.contract.morpho : a.id === 'uniswap_v4' ? deps.contract.v4 : deps.contract.vault) === a.vault) };
      })() : null;
      const syms = r.path.map(sym);
      const lk = CY.loopKey(r.edges);
      const loopSyms = [...syms.slice(lk.at, -1), ...syms.slice(0, lk.at), syms[lk.at]];
      const out = {
        approved: decision.approved, reasons: decision.reasons,
        borrowSymbol: syms[0], otherSymbol: syms.slice(1, -1).join('→'),
        buyOn: r.markets[0].id, sellOn: r.markets[r.n - 1].id,
        legsCount: r.n, path: syms, pathAddr: r.path,
        legs: r.edges.map((e, i) => ({ market: e.m.id, venue: e.m.venueId, kind: e.m.kind, from: syms[i], to: syms[i + 1], fee: e.m.fee || 0, impactBps: impacts[i], executable: !!e.m.executable })),
        spotEdgeBps: Number.isFinite(r.c.spot) ? Math.round((r.c.spot / thr(r.borrow) - 1) * 1e5) / 10 : null,
        key: CY.keyOf(r.c), cycleKey: lk.key, loopPath: loopSyms, flip: r.c.flip || null, flipOf: r.c.flipOf || null,
        amountUsd: E.assetToUsd(best.amount, r.asset.price8, r.asset.decimals),
        grossUsd: E.assetToUsd(best.gross, r.asset.price8, r.asset.decimals),
        premiumUsd, gasUsdAssumed: routeGasUsd, netUsd, impact1: impacts[0], impact2: impacts[r.n - 1], impacts,
        flash: useBal ? { provider: bal.id, feeBps: bal.feeBps, vault: bal.vault, available: String(lendable) } : { provider: 'aave_v3', feeBps: deps.premiumBps }, alt: altOut,
        quote: { amount: best.amount, outs: best.outs, out1: best.out1, out2: best.out2, premium: best.premium, contractProfit: best.contractProfit, net: best.net },
      };
      if (decision.approved) out.runParams = E.buildRunParams({ asset: r.borrow, tokenB: r.path[1], amount: best.amount, cand, route, cfg, assetPrice8: r.asset.price8, decimals: r.asset.decimals, nowSec: deps.nowSec, contract: deps.contract || null, source: !useBal ? 0 : bal.id === 'uniswap_v4' ? 3 : bal.id === 'morpho_blue' ? 2 : 1 });
      return out;
    } finally { progress('optimise', ++optDone, top.length); }
  })));
  const candidates = optimised.filter(Boolean);
  candidates.sort((a, b) => b.netUsd - a.netUsd || (a.borrowSymbol + a.buyOn + a.sellOn + a.path.join() < b.borrowSymbol + b.buyOn + b.sellOn + b.path.join() ? -1 : 1));

  if (deps.done) deps.done();
  const gasGate = gasGwei > cfg.GAS_CEILING_GWEI;
  // profitability indicators: every one from this scan's block (or the previous scan for the price moves)
  const usdOf = (a, raw) => { const x = byAddr.get(a); return x && x.price8 ? E.assetToUsd(raw, x.price8, x.decimals) : null; };
  const indicators = {
    cycles: { checked: found.checked, pricesAllow: found.passed, nearMiss10bps: found.nearMiss, quoted: routes.length, flipsQuoted: flips.length, positiveAtScreenSize: screened.filter((x) => x.screenNetUsd > 0).length, optimised: candidates.length, approved: candidates.filter((c) => c.approved).length, byLegs: [2, 3, 4].map((n) => ({ legs: n, pricesAllow: found.cycles.filter((c) => c.edges.length === n).length })) },
    bestEdges: base.slice(0, 10).map((c) => ({ path: [c.start, ...c.edges.map((e) => e.tout)].map(sym), venues: c.edges.map((e) => e.m.id), edgeBps: Number.isFinite(c.spot) ? Math.round((c.spot / thr(c.start) - 1) * 1e5) / 10 : null })),
    brokenPools: sane.broken.slice(0, 5).map((x) => ({ ...x, pair: x.pair.map(sym) })),
    thinPools: (sane.thin || []).length, depthMinUsd, deadRoutes,
    benchedPools: [...bench].slice(0, 10).map(([market, b]) => ({ market, venue: b.venue, pair: b.pair, fillPct: b.fillPct, untilIso: new Date(b.until).toISOString() })),
    spreads: deps.states ? CY.spreads(deps.markets, deps.states).slice(0, 10).map((x) => ({ ...x, pair: x.pair.map(sym) })) : [],
    moves: deps.states && deps.prevStates ? CY.moves(deps.markets, deps.states, deps.prevStates).slice(0, 10) : [],
    // every pair's price this block (the direction model's input: lib/direction.cjs)
    prices: deps.states ? CY.pairPrices(deps.markets, deps.states).map((x) => ({ key: x.pair.join('|'), pair: x.pair.map(sym), p: x.p, pools: x.pools })) : [],
    movedPools: deps.states && deps.prevStates ? CY.moves(deps.markets, deps.states, deps.prevStates).length : null,
    breakEven: { gasUsdByLegs: [2, 3, 4].map((n) => ({ legs: n, gasUsd: gasUsdFor(n) })), flashFeeBps: { aave_v3: deps.premiumBps, ...(alt ? { [alt.id]: alt.feeBps } : {}) }, gasGwei, gasCeilingGwei: cfg.GAS_CEILING_GWEI, minNetUsd: cfg.MIN_NET_PROFIT_USD },
    flashLiquidity: starts.map((a) => ({ symbol: sym(a), aaveUsd: byAddr.get(a).available !== null ? usdOf(a, byAddr.get(a).available) : null, altUsd: altFor(a) ? usdOf(a, alt.available.get(a)) : null })).sort((x, y) => (y.aaveUsd || 0) - (x.aaveUsd || 0)),
    // before the filters: raw gaps at the screen size, and what each filter blocked (with the best it would have netted)
    raw: { screenSizeUsd: cfg.SCREEN_SIZE_USD, grossPositive: screened.filter((x) => x.screenGrossUsd > 0).length, beatsFlashFee: screened.filter((x) => x.screenGrossUsd > 0 && x.screenNetUsd + gasUsdFor(x.r.n) > 0).length, bestGrossUsd: screened.length ? Math.max(...screened.map((x) => x.screenGrossUsd)) : null },
    blockedBy: (() => {
      const cat = (why) => (/below floor/.test(why) ? 'profit floor' : /impact/.test(why) ? 'price impact cap' : /NOT_EXECUTABLE/.test(why) ? 'venue not executable' : /STANDBY_GAS/.test(why) ? 'gas ceiling' : /liquidity|flash-loanable/.test(why) ? 'flash liquidity' : /MAX_LEGS/.test(why) ? 'too many legs' : 'other');
      const t = {};
      for (const c of candidates) {
        if (c.approved) continue;
        const cs = [...new Set(c.reasons.map(cat))];
        for (const k of cs) { t[k] = t[k] || { routes: 0, onlyThis: 0, bestNetIfOnlyThis: null }; t[k].routes++; }
        if (cs.length === 1) { const k = cs[0]; t[k].onlyThis++; if (t[k].bestNetIfOnlyThis === null || c.netUsd > t[k].bestNetIfOnlyThis) t[k].bestNetIfOnlyThis = c.netUsd; }
      }
      return Object.entries(t).map(([filter, v]) => ({ filter, ...v })).sort((a, b) => b.routes - a.routes);
    })(),
    flips: candidates.filter((c) => c.flipOf).map((c) => ({ path: c.path, flip: c.flip, netUsd: c.netUsd, approved: c.approved })),
    best: candidates[0] ? { path: candidates[0].path, legs: candidates[0].legsCount, amountUsd: candidates[0].amountUsd, netUsd: candidates[0].netUsd, altNetUsd: candidates[0].alt ? candidates[0].alt.netUsd : null } : null,
  };
  if (typeof deps.saveBench === 'function') { try { deps.saveBench(bench); } catch (_) { /* best effort */ } }
  return jsonSafe({
    blockNumber: deps.blockNumber, quotesPinnedToBlock: deps.blockNumber, nowSec: deps.nowSec,
    rpc: deps.batchStats ? { requests: deps.batchStats.rpc, calls: deps.batchStats.calls, batches: deps.batchStats.batches, fallbacks: deps.batchStats.fallbacks } : null,
    quotes: deps.counter ? { unique: deps.counter.n, failed: deps.counter.fail, reused: deps.counter.cached || 0 } : null,
    status: gasGate ? 'STANDBY_GAS_WAIT' : 'SCANNED',
    gasGwei, gasCostUsdAssumed: gasUsd, premiumBps: deps.premiumBps,
    marketsFound: deps.allMarkets.length, marketsUsable: deps.markets.length, brokenPools: sane.broken.length, routesEnumerated: routes.length, routesScreened: screened.length, optimised: candidates.length,
    approved: candidates.filter((c) => c.approved).length,
    candidates, indicators, hot: base.slice(0, num(cfg.HOT_CYCLES, 40)).map(CY.keyOf), tookMs: Date.now() - t0,
  });
}

module.exports = { runScan, jsonSafe };
