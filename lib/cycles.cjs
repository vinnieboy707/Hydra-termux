'use strict';
// Cycle finder. Pure math on pool state read from the chain at the scan's block: no network, no clock, no randomness.
//
// Every pool's marginal rate (spot price after its fee) is an UPPER BOUND on what any trade through it can return per
// unit: a swap only ever moves the price against the trader, so out/in falls as size grows. A cycle borrow A → … → A
// therefore cannot return more than the product of its marginal rates, at any size. If that product does not beat
// 1 + flash fee, no size of that cycle can be profitable, and it is dropped without spending a quote. Everything that
// survives is quoted for real by the venues' own quoters; only those quotes decide.
//
// A rate that cannot be read is treated as unbounded (kept, never pruned): a missing number never hides a route.

const Q96 = 2 ** 96;
const EPS = 1e-9; // float tolerance: prune only when clearly below break-even

/** marginal rate (raw units out per raw unit in) for one direction of one market, or Infinity when unknown */
function rate(m, tokenIn, state, v2FeeBps) {
  const [a, b] = m.pair;
  const t0 = a < b ? a : b; // pools order tokens by address
  if (!state) return Infinity;
  if (m.kind === 'curve') {
    // the pool's own get_dy for a tiny trade (0.01% of its balance), fee included, + 5 bps: a stable pool's out/in
    // barely moves at that size, so this stays an upper bound and never prunes a real route
    const q = tokenIn === m.coins[0] ? state.q01 : tokenIn === m.coins[1] ? state.q10 : undefined;
    return q === undefined || q === null ? Infinity : q * 1.0005;
  }
  if (m.kind === 'v3') {
    if (state.sqrtPriceX96 === undefined || state.sqrtPriceX96 === null) return Infinity;
    const s = Number(state.sqrtPriceX96) / Q96; const p = s * s; // token1 per token0
    if (!(p > 0) || !Number.isFinite(p)) return p === 0 ? 0 : Infinity;
    const g = 1 - (m.fee || 0) / 1e6;
    return (tokenIn === t0 ? p : 1 / p) * g;
  }
  if (state.r0 === undefined || state.r0 === null) return Infinity;
  const r0 = Number(state.r0), r1 = Number(state.r1);
  if (r0 <= 0 || r1 <= 0) return 0;
  const fb = v2FeeBps !== undefined && v2FeeBps !== null ? v2FeeBps : 0; // unknown fee: 0 keeps the bound an upper bound
  const g = 1 - fb / 1e4;
  return (tokenIn === t0 ? r1 / r0 : r0 / r1) * g;
}

/**
 * Pools whose price cannot be real. A drained or abandoned pool can show any price at all (seen live: an ezETH/WETH V2
 * pair at a "gap" of 1.6e16 bps); its spot rate is an upper bound no trade can come near, so it took every quote of
 * the scan and the real routes were never quoted. A pool is broken when its price is more than maxDevBps away from
 *   · the Aave oracle's price for the pair, when both tokens have one (usdPerRaw: Map token → USD per raw unit), else
 *   · the median of the pair's other pools (three or more pools).
 * Real arbitrage gaps are a fraction of a percent; 20% (default) leaves every real one in. → { keep, broken }
 */
function saneMarkets(markets, states, v2Fees, usdPerRaw = new Map(), maxDevBps = 2000, minSideUsd = 0) {
  if (!states) return { keep: markets, broken: [], thin: [] };
  const lim = Math.log(1 + maxDevBps / 1e4);
  const info = markets.map((m) => {
    const [a, b] = m.pair; const st = states.get(m.id);
    const r = rate(m, a, st, v2Fees ? v2Fees[m.venueId] : undefined); // raw b per raw a, after fee
    return { m, a, b, r: Number.isFinite(r) && r > 0 ? r / (1 - ((m.kind === 'v3' ? (m.fee || 0) / 1e6 : (v2Fees && v2Fees[m.venueId] ? v2Fees[m.venueId] / 1e4 : 0)))) : null };
  });
  const byPair = new Map();
  for (const x of info) if (x.r) { const k = [x.a, x.b].sort().join('|'); if (!byPair.has(k)) byPair.set(k, []); byPair.get(k).push(x); }
  const keep = [], broken = [], thin = [];
  // depth floor (2.9.12): a V2 pair holding less than DEPTH_MIN_USD on a side it has a price for cannot carry the
  // smallest trade: its "gap" is a price nobody bothers to correct, and it took every shortlist slot (865 of 865
  // samples on 2026-11-25 lost 98-100%). Only sides with a known USD price are judged; unknown never hides a route.
  const thinSide = (m) => {
    if (!(minSideUsd > 0) || m.kind === 'v3' || m.kind === 'curve') return null;
    const st = states.get(m.id); if (!st || st.r0 === undefined || st.r0 === null) return null;
    const t0 = m.pair[0] < m.pair[1] ? m.pair[0] : m.pair[1]; const t1 = t0 === m.pair[0] ? m.pair[1] : m.pair[0];
    const u0 = usdPerRaw.get(t0), u1 = usdPerRaw.get(t1);
    const side = [u0 > 0 ? Number(st.r0) * u0 : null, u1 > 0 ? Number(st.r1) * u1 : null].filter((v) => v !== null);
    return side.length && Math.min(...side) < minSideUsd ? Math.round(Math.min(...side)) : null;
  };
  for (const x of info) {
    if (!x.r) { keep.push(x.m); continue; } // unknown state: kept (a missing number never hides a route)
    const pa = usdPerRaw.get(x.a), pb = usdPerRaw.get(x.b);
    let ref = null, by = null;
    if (pa > 0 && pb > 0) { ref = pa / pb; by = 'oracle'; }
    else {
      const same = byPair.get([x.a, x.b].sort().join('|')).filter((y) => y !== x).map((y) => (y.a === x.a ? y.r : 1 / y.r)).sort((p, q) => p - q);
      if (same.length >= 2) { ref = same[Math.floor(same.length / 2)]; by = 'other pools'; }
    }
    const dev = ref ? Math.log(x.r / ref) : 0;
    if (ref && Math.abs(dev) > lim) broken.push({ market: x.m.id, venue: x.m.venueId, pair: x.m.pair, offBps: Math.round((Math.exp(Math.abs(dev)) - 1) * 1e4), by });
    else { const t = thinSide(x.m); if (t !== null) thin.push({ market: x.m.id, venue: x.m.venueId, pair: x.m.pair, sideUsd: t }); else keep.push(x.m); }
  }
  broken.sort((p, q) => q.offBps - p.offBps);
  return { keep, broken, thin };
}

/** directed edges: out.get(tokenIn).get(tokenOut) = [{ m, tin, tout, r }] best rate first */
function buildGraph(markets, states, v2Fees) {
  const out = new Map();
  for (const m of markets) {
    const st = states ? states.get(m.id) : null;
    for (const [tin, tout] of [[m.pair[0], m.pair[1]], [m.pair[1], m.pair[0]]]) {
      const r = rate(m, tin, st, v2Fees ? v2Fees[m.venueId] : undefined);
      if (!(r > 0)) continue; // 0 or NaN: nothing comes out of this direction
      if (!out.has(tin)) out.set(tin, new Map());
      const row = out.get(tin);
      if (!row.has(tout)) row.set(tout, []);
      row.get(tout).push({ m, tin, tout, r });
    }
  }
  for (const row of out.values()) for (const es of row.values()) es.sort((x, y) => y.r - x.r || (x.m.id < y.m.id ? -1 : 1));
  return out;
}

const top = (out, a, b) => { const r = out.get(a); const es = r && r.get(b); return es && es.length ? es[0].r : 0; };

/**
 * Every cycle start → … → start of 2 to maxLegs legs over distinct intermediate tokens, for every flash-loanable start.
 * thr(asset) is 1 + the cheapest flash fee for that asset (as a fraction). perPair limits how many pools per directed
 * token pair are combined on 3+ leg cycles (2-leg cycles try every pool pair). Returns { cycles, checked } where
 * cycles = [{ start, edges, spot, edgeBps }] sorted by spot product, best first.
 */
function findCycles({ graph, starts, thr, maxLegs = 4, perPair = 2, limit = 5000 }) {
  const cycles = []; let checked = 0, nearMiss = 0;
  const edgesOf = (a, b, k) => { const r = graph.get(a); const es = r && r.get(b); return es ? (k ? es.slice(0, k) : es) : []; };
  const push = (start, edges, t) => {
    checked++;
    const spot = edges.reduce((p, e) => p * e.r, 1);
    if (!(spot > t * (1 - EPS))) { if (spot >= t * 0.999) nearMiss++; return; }
    if (new Set(edges.map((e) => e.m.id)).size !== edges.length) return; // the same pool twice cannot be an arbitrage
    cycles.push({ start, edges, spot, edgeBps: Number.isFinite(spot) ? Math.round((spot / t - 1) * 1e4 * 10) / 10 : null });
  };
  for (const A of starts) {
    const t = thr(A); const outA = graph.get(A); if (!outA) continue;
    // 2 legs: every pool pair
    for (const X of outA.keys()) for (const e1 of edgesOf(A, X)) for (const e2 of edgesOf(X, A)) push(A, [e1, e2], t);
    if (maxLegs < 3) continue;
    // best two-step return to A from each Y (for the 4-leg bound)
    const back2 = new Map();
    if (maxLegs >= 4) for (const [Y, rowY] of graph) {
      if (Y === A) continue; let b = 0;
      for (const Z of rowY.keys()) if (Z !== A && Z !== Y) { const v = top(graph, Y, Z) * top(graph, Z, A); if (v > b) b = v; }
      back2.set(Y, b);
    }
    // best three-step return to A from each Y (for the 5-leg bound): an upper bound, as every rate is the best one
    const back3 = new Map();
    if (maxLegs >= 5) for (const [Y, rowY] of graph) {
      if (Y === A) continue; let b = 0;
      for (const Z of rowY.keys()) if (Z !== A && Z !== Y) { const v = top(graph, Y, Z) * (back2.get(Z) || 0); if (v > b) b = v; }
      back3.set(Y, b);
    }
    for (const X of outA.keys()) {
      const rAX = top(graph, A, X); const rowX = graph.get(X); if (!rowX) continue;
      for (const Y of rowX.keys()) {
        if (Y === A || Y === X) continue;
        const rXY = top(graph, X, Y);
        // 3 legs
        const rYA = top(graph, Y, A);
        if (rYA && rAX * rXY * rYA > t * (1 - EPS)) for (const e1 of edgesOf(A, X, perPair)) for (const e2 of edgesOf(X, Y, perPair)) for (const e3 of edgesOf(Y, A, perPair)) push(A, [e1, e2, e3], t);
        // 4 and 5 legs, only where the best possible continuation of that length could still beat break-even
        const go4 = maxLegs >= 4 && rAX * rXY * (back2.get(Y) || 0) > t * (1 - EPS);
        const go5 = maxLegs >= 5 && rAX * rXY * (back3.get(Y) || 0) > t * (1 - EPS);
        if (go4 || go5) {
          const rowY = graph.get(Y); if (!rowY) continue;
          for (const Z of rowY.keys()) {
            if (Z === A || Z === X || Z === Y) continue;
            const rYZ = top(graph, Y, Z);
            if (go4 && rAX * rXY * rYZ * top(graph, Z, A) > t * (1 - EPS)) for (const e1 of edgesOf(A, X, perPair)) for (const e2 of edgesOf(X, Y, perPair)) for (const e3 of edgesOf(Y, Z, perPair)) for (const e4 of edgesOf(Z, A, perPair)) push(A, [e1, e2, e3, e4], t);
            // 5 legs (contracts that accept 5): only where the best two-step return from Z could still beat break-even
            if (go5 && rAX * rXY * rYZ * (back2.get(Z) || 0) > t * (1 - EPS)) {
              const rowZ = graph.get(Z); if (!rowZ) continue;
              for (const W of rowZ.keys()) {
                if (W === A || W === X || W === Y || W === Z) continue;
                if (!(rAX * rXY * rYZ * top(graph, Z, W) * top(graph, W, A) > t * (1 - EPS))) continue;
                for (const e1 of edgesOf(A, X, perPair)) for (const e2 of edgesOf(X, Y, perPair)) for (const e3 of edgesOf(Y, Z, perPair)) for (const e4 of edgesOf(Z, W, perPair)) for (const e5 of edgesOf(W, A, perPair)) push(A, [e1, e2, e3, e4, e5], t);
              }
            }
          }
        }
      }
    }
  }
  cycles.sort((x, y) => (y.spot === x.spot ? keyOf(x) < keyOf(y) ? -1 : 1 : y.spot > x.spot ? 1 : -1));
  return { cycles: cycles.slice(0, limit), checked, passed: cycles.length, nearMiss };
}

/** stable key of one directed cycle with a given start */
function keyOf(c) { return c.start + '|' + c.edges.map((e) => `${e.m.id}:${e.tin.slice(2, 8)}`).join('>'); }

/** the same pools in the opposite direction (borrow the same asset) */
function reverse(c, graph) {
  const edges = c.edges.slice().reverse().map((e) => { const es = (graph.get(e.tout) || new Map()).get(e.tin) || []; return es.find((x) => x.m === e.m) || { m: e.m, tin: e.tout, tout: e.tin, r: Infinity }; });
  return { start: c.start, edges, spot: edges.reduce((p, e) => p * e.r, 1), flipOf: keyOf(c), flip: 'reverse' };
}

/** the same cycle borrowing another flash-loanable token on it */
function rotations(c, isStart) {
  const out = [];
  for (let i = 1; i < c.edges.length; i++) {
    const s = c.edges[i].tin; if (!isStart(s)) continue;
    out.push({ start: s, edges: [...c.edges.slice(i), ...c.edges.slice(0, i)], spot: c.spot, flipOf: keyOf(c), flip: 'borrow ' + s });
  }
  return out;
}

/** rotation-invariant identity: the same loop borrowed in a different token is the same opportunity. Returns the key and
 * the leg index the canonical rotation starts at. */
function loopKey(edges) {
  const steps = edges.map((e) => `${e.m.id}:${e.tin}`);
  let best = null, at = 0;
  for (let i = 0; i < steps.length; i++) { const s = [...steps.slice(i), ...steps.slice(0, i)].join('>'); if (best === null || s < best) { best = s; at = i; } }
  return { key: best, at };
}

/** derives a Uniswap-V2-style venue's swap fee from one real quote against the pair's reserves (rounded down: keeps the bound an upper bound) */
function v2FeeFromQuote({ amountIn, amountOut, reserveIn, reserveOut }) {
  if (amountIn <= 0n || amountOut <= 0n || reserveOut <= amountOut || reserveIn <= 0n) return null;
  // out = in·g·rOut / (rIn + in·g)  ⇒  g = out·rIn / (in·(rOut − out))
  const gBps = (amountOut * reserveIn * 10000n) / (amountIn * (reserveOut - amountOut));
  const fee = 10000n - gBps - 1n; // −1: never overstate the fee
  return fee < 0n ? 0 : Number(fee);
}

/** spread between the best and worst marginal price of the same pair across pools, before fees, in bps */
function spreads(markets, states) {
  const by = new Map();
  for (const m of markets) {
    const st = states && states.get(m.id); if (!st) continue;
    const [a, b] = m.pair; const t0 = a < b ? a : b;
    const raw = m.kind === 'v3' ? rate({ ...m, fee: 0 }, t0, st) : rate(m, t0, st, 0);
    if (!(raw > 0) || !Number.isFinite(raw)) continue;
    const k = a < b ? a + '|' + b : b + '|' + a;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push({ m, p: raw });
  }
  const out = [];
  for (const [k, xs] of by) {
    if (xs.length < 2) continue;
    xs.sort((x, y) => x.p - y.p);
    const lo = xs[0], hi = xs[xs.length - 1];
    out.push({ pair: k.split('|'), bps: Math.round((hi.p / lo.p - 1) * 1e5) / 10, cheap: lo.m.id, dear: hi.m.id, pools: xs.length });
  }
  return out.sort((x, y) => y.bps - x.bps);
}

/** each pair's price this block: the median marginal price (fee-free) across its pools, token0 (lower address) in token1 raw units */
function pairPrices(markets, states) {
  const by = new Map();
  for (const m of markets) {
    const st = states && states.get(m.id); if (!st) continue;
    const [a, b] = m.pair; const t0 = a < b ? a : b; const t1 = a < b ? b : a;
    const p = m.kind === 'v3' ? rate({ ...m, fee: 0 }, t0, st) : rate(m, t0, st, 0);
    if (!(p > 0) || !Number.isFinite(p)) continue;
    const k = t0 + '|' + t1; if (!by.has(k)) by.set(k, { pair: [t0, t1], ps: [] });
    by.get(k).ps.push(p);
  }
  return [...by.values()].map(({ pair, ps }) => { ps.sort((x, y) => x - y); return { pair, p: ps[Math.floor(ps.length / 2)], pools: ps.length }; });
}

/** how far each pool's price moved since the previous scan, in bps (absolute) */
function moves(markets, states, prev) {
  if (!prev) return [];
  const out = [];
  for (const m of markets) {
    const a = states && states.get(m.id), b = prev.get(m.id); if (!a || !b) continue;
    const t0 = m.pair[0] < m.pair[1] ? m.pair[0] : m.pair[1];
    const pa = rate({ ...m, fee: 0 }, t0, a, 0), pb = rate({ ...m, fee: 0 }, t0, b, 0);
    if (!(pa > 0 && pb > 0) || !Number.isFinite(pa) || !Number.isFinite(pb)) continue;
    const bps = Math.round(Math.abs(pa / pb - 1) * 1e5) / 10;
    if (bps > 0) out.push({ market: m.id, bps });
  }
  return out.sort((x, y) => y.bps - x.bps);
}

module.exports = { rate, saneMarkets, buildGraph, findCycles, keyOf, reverse, rotations, loopKey, v2FeeFromQuote, spreads, moves, pairPrices };
