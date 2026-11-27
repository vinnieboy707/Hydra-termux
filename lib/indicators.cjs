'use strict';
// The VP's indicators: 40 success and 32 failure (from 50 + 50, with every duplicate removed: see DUPLICATES), every one
// read from a measured source (the scan, the chain, the
// executor, receipts, shadow runs, your real checks, the feeds, the portal sync, the VP's own records). Each has a
// trigger: the condition under which it fires (a success happening, a failure happening). The algorithm:
//
//   1. Each cycle every indicator i is measured (vᵢ), or is null when its source has no value (never 0 in its place).
//   2. Normalised against its own history: zᵢ = (vᵢ − median) / (1.4826 · MAD), clamped to ±3 (robust to outliers).
//   3. Signed: cᵢ = +zᵢ for a success indicator, −zᵢ for a failure indicator (more failure is worse).
//   4. Momentum index  M = mean(cᵢ) over the active indicators          (−3 … +3; above 0 = things improving)
//   5. Learned weights: ρᵢ = exponentially weighted correlation of zᵢ with the change in best net that followed
//      it (the next scan's Δ best net, in $). An indicator is PROVEN once it has 200 measurements and |ρᵢ| ≥ 0.1.
//   6. Forecast (the equation):  Δ̂ = σ_Δ · Σ ρᵢ zᵢ / Σ |ρᵢ|   over proven indicators,
//      the expected change of the best route's net at the next scan, in $; with the drivers (largest |ρᵢ zᵢ|).
//   7. Retirement: an indicator measured for CHRONOS_INDICATOR_RETIRE_DAYS (default 7) days, at least 500 times,
//      that never fired is retired (it proved nothing): it leaves the index and the forecast. It is still read, and
//      the first time it would fire it comes back, because then it has proven it can.
//   8. No duplicates, by design and by measurement: the ones that were the same number in another form are removed
//      (DUPLICATES says which kept indicator carries each); and once a day, two indicators whose z-scores moved
//      together (|r| ≥ 0.95 over 200 or more shared cycles) are a measured duplicate: the higher id leaves the index,
//      named with the one it duplicates, and returns if they stop moving together.
// Everything here feeds the VP (daily report, decisions) and your portal. Statistics on measured data, not certainty.
const fs = require('fs');
const path = require('path');
const DAY = 86400000;
const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const len = (a) => (Array.isArray(a) ? a.length : null);
const I_ = (x) => (x.res && x.res.indicators) || null;
const cands = (x) => (x.res && x.res.candidates) || null;
const share = (x, re) => { const c = cands(x); if (!c || !c.length) return null; const f = c.filter((y) => !y.approved); return f.length ? f.filter((y) => re.test((y.reasons || []).join(' '))).length / f.length : null; };
const killerShare = (x, k) => { const c = cands(x); if (!c || !c.length) return null; const K = require('./insights.cjs').killer; const f = c.filter((y) => !y.approved && Number.isFinite(y.netUsd)); return f.length ? f.filter((y) => K(y, n(x.cfg && x.cfg.MIN_NET_PROFIT_USD)) === k).length / f.length : null; };
const rcCount = (x, st) => ((x.realcheck && x.realcheck.results) || null) && x.realcheck.results.filter((r) => r.status === st).length;
const ageH = (iso, now) => (iso ? (now - Date.parse(iso)) / 3600000 : null);

// [id, name, get(x, D), trigger(v)] — D = derived values (best-net trend, direction summary, VP state)
const SUCCESS = [
  ['S03', 'pools priced this scan', (x) => n(x.res && x.res.marketsFound), (v) => v >= 100],
  ['S04', 'cycles checked', (x) => n(I_(x) && I_(x).cycles.checked), (v) => v > 0],
  ['S05', 'cycles the pool prices allow', (x) => n(I_(x) && I_(x).cycles.pricesAllow), (v) => v > 0],
  ['S06', 'routes approved', (x) => n(x.res && x.res.approved), (v) => v > 0],
  ['S08', 'best net minus your floor ($)', (x) => { const b = n(I_(x) && I_(x).best && I_(x).best.netUsd), f = n(x.cfg && x.cfg.MIN_NET_PROFIT_USD); return b !== null && f !== null ? b - f : null; }, (v) => v >= 0],
  ['S09', 'routes within $1 of your floor', (x) => { const c = cands(x), f = n(x.cfg && x.cfg.MIN_NET_PROFIT_USD); return c && f !== null ? c.filter((y) => Number.isFinite(y.netUsd) && y.netUsd >= f - 1).length : null; }, (v) => v > 0],
  ['S11', 'widest cross-pool spread (bps)', (x) => n(I_(x) && I_(x).spreads[0] && I_(x).spreads[0].bps), (v) => v >= 30],
  ['S13', 'pools that moved since last scan', (x) => n(I_(x) && I_(x).movedPools), (v) => v > 0],
  ['S14', 'largest pool move (bps)', (x) => n(I_(x) && I_(x).moves[0] && I_(x).moves[0].bps), (v) => v >= 10],
  ['S17', 'all feeds up (share)', (x) => (x.feed && x.feed.feeds ? x.feed.up / x.feed.feeds : null), (v) => v >= 1],
  ['S18', 'shadow wins', (x) => n(x.shadowWins), (v) => v > 0],
  ['S19', 'positive raw gaps at screen size', (x) => n(I_(x) && I_(x).raw && I_(x).raw.grossPositive), (v) => v > 0],
  ['S20', 'profit from receipts, all time ($)', (x, D, R) => n(R.treasury.kpis.realizedNetUsdAllTime), (v) => v > 0],
  ['S21', 'profit from receipts, 24 h ($)', (x, D, R) => n(R.treasury.kpis.netUsdLast24h), (v) => v > 0],
  ['S22', 'trades in 24 h', (x, D, R) => n(R.treasury.kpis.tradesLast24h), (v) => v > 0],
  ['S24', 'executor ready (1/0)', (x) => (x.execInfo ? (x.execInfo.ready ? 1 : 0) : null), (v) => v === 1],
  ['S25', 'executor gas (ETH)', (x) => n(x.execInfo && x.execInfo.gasEth), (v) => v >= 0.002],
  ['S26', 'contract v2 deployed (1/0)', (x) => (x.contractInfo ? (x.contractInfo.kind === 2 ? 1 : 0) : null), (v) => v === 1],
  ['S27', 'venue factories your contract allows', (x) => n(x.contractInfo && x.contractInfo.factoriesAllowed), (v) => v >= 3],
  ['S28', 'routes that beat the flash fee at screen size', (x) => n(I_(x) && I_(x).raw && I_(x).raw.beatsFlashFee), (v) => v > 0],
  ['S29', 'assets with flash liquidity over $10k', (x) => (I_(x) && I_(x).flashLiquidity ? I_(x).flashLiquidity.filter((f) => (f.aaveUsd || 0) + (f.altUsd || 0) > 1e4).length : null), (v) => v > 0],
  ['S30', 'mirrors that paid (last scan)', (x) => n(x.mirror && x.mirror.last && x.mirror.last.successes), (v) => v > 0],
  ['S31', 'profitable mirrors below your floor', (x) => n(x.mirror && x.mirror.last && x.mirror.last.leads), (v) => v > 0],
  ['S32', 'route patterns in the playbook', (x, D) => n(D.playbook), (v) => v > 0],
  ['S33', 'playbook best net ($)', (x, D) => n(D.playbookBest), (v) => v > 0],
  ['S34', 'road-to-cash steps verified', (x, D) => n(D.roadDone), (v) => v >= 2],
  ['S35', 'real checks passing', (x) => rcCount(x, 'pass'), (v) => v >= 10],
  ['S36', 'real checks fresh (hours old)', (x) => ageH(x.realcheck && x.realcheck.at, x.now), (v) => v <= 26],
  ['S37', 'successes today (ledger)', (x, D) => n(D.ledger && D.ledger.daySuccesses), (v) => v > 0],
  ['S39', 'portal sync ok (minutes since)', (x) => (x.sync && x.sync.lastOk ? (x.now - x.sync.lastOk) / 60000 : null), (v) => v <= 5],
  ['S40', 'portal rows waiting', (x) => n(x.sync && x.sync.pending), (v) => v <= 10],
  ['S41', 'portal reachable (1/0)', (x, D, R) => (R.data ? (R.data.kpis.databaseDown ? 0 : 1) : null), (v) => v === 1],
  ['S42', 'code seal intact (1/0)', (x) => (x.integrity ? (x.integrity.ok ? 1 : 0) : null), (v) => v === 1],
  ['S43', 'policies holding', (x) => (Array.isArray(x.policies) && x.policies.length ? x.policies.filter((p) => /ENFORCED|READY|OK|ON/.test(p.status)).length : null), (v) => v >= 8],
  ['S44', 'profitable flash-loan txs by others (research)', (x) => n(x.research && x.research.profitableAfterGas), (v) => v > 0],
  ['S45', 'closest route ever ($)', (x, D) => n(D.bestEver), (v) => v > 0],
  ['S46', 'best net improving (slope, $ per scan)', (x, D) => n(D.bestSlope), (v) => v > 0],
  ['S48', 'pairs with a confident price direction', (x, D) => n(D.direction && D.direction.confident), (v) => v > 0],
  ['S49', 'spreads unusually wide (closing soon)', (x, D) => len(D.direction && D.direction.wideSpreads), (v) => v > 0],
  ['S50', 'flips quoted (both directions checked)', (x) => n(I_(x) && I_(x).cycles.flipsQuoted), (v) => v > 0],
];

const FAILURE = [
  ['F01', 'scan error present (1/0)', (x) => (x.res || x.scanError ? (x.scanError ? 1 : 0) : null), (v) => v === 1],
  ['F02', 'scan stale (seconds since last)', (x) => (x.lastScanAt ? (x.now - x.lastScanAt) / 1000 : null), (v) => v > 120],
  ['F03', 'scan slower than 15 s (ms)', (x) => n(x.res && x.res.tookMs), (v) => v >= 15000],
  ['F07', 'routes stopped by gas (share)', (x) => killerShare(x, 'gas'), (v) => v >= 0.5],
  ['F08', 'routes stopped by the flash-loan fee (share)', (x) => killerShare(x, 'flash-loan fee'), (v) => v >= 0.5],
  ['F09', 'routes with no price gap (share)', (x) => killerShare(x, 'no price gap'), (v) => v >= 0.5],
  ['F10', 'routes below your floor (share)', (x) => killerShare(x, 'below your floor'), (v) => v >= 0.5],
  ['F11', 'routes blocked by the price-impact cap (share)', (x) => share(x, /impact/), (v) => v >= 0.3],
  ['F12', 'routes through venues not executable (share)', (x) => share(x, /NOT_EXECUTABLE/), (v) => v >= 0.3],
  ['F13', 'routes short of flash liquidity (share)', (x) => share(x, /liquidity|flash-loanable/), (v) => v >= 0.3],
  ['F14', 'sends reverted today', (x) => n(x.today && x.today.reverted), (v) => v > 0],
  ['F16', 'consecutive reverts', (x) => n(x.today && x.today.consecutiveReverts), (v) => v >= 2],
  ['F21', 'real checks failing', (x) => rcCount(x, 'fail'), (v) => v > 0],
  ['F22', 'real checks not run', (x) => rcCount(x, 'not run'), (v) => v > 0],
  ['F24', 'incidents open', (x) => len(x.incidents && x.incidents.open), (v) => v > 0],
  ['F25', 'incidents escalated to you', (x) => (x.incidents && x.incidents.open ? x.incidents.open.filter((i) => i.status === 'escalated').length : null), (v) => v > 0],
  ['F26', 'failures today (ledger)', (x, D) => n(D.ledger && D.ledger.dayFailures), (v) => v > 0],
  ['F29', 'current road step waiting (hours)', (x, D) => n(D.roadWaitingH), (v) => v >= 24],
  ['F30', 'portal sync failures in a row', (x) => n(x.sync && x.sync.failures), (v) => v >= 3],
  ['F33', 'rows the portal rejected', (x) => n(x.sync && x.sync.rejected), (v) => v > 0],
  ['F36', 'policies failing', (x) => len(x.policyFails), (v) => v > 0],
  ['F37', 'safe mode on (1/0)', (x) => (x.safe === undefined ? null : x.safe ? 1 : 0), (v) => v === 1],
  ['F38', 'kill switch on (1/0)', (x) => (x.killed === undefined ? null : x.killed ? 1 : 0), (v) => v === 1],
  ['F39', 'engine state tampered (1/0)', (x) => (x.stateTampered === undefined ? null : x.stateTampered ? 1 : 0), (v) => v === 1],
  ['F41', 'not LIVE (1/0)', (x) => (x.mode ? (x.mode === 'LIVE' ? 0 : 1) : null), (v) => v === 1],
  ['F43', 'gas for a 2-leg route ($)', (x) => n(I_(x) && I_(x).breakEven.gasUsdByLegs[0] && I_(x).breakEven.gasUsdByLegs[0].gasUsd), (v) => v >= 0.25],
  ['F44', 'gas as a share of the best gross', (x) => { const c = cands(x); if (!c || !c.length) return null; const b = c.slice().sort((p, q) => q.grossUsd - p.grossUsd)[0]; return b && b.grossUsd > 0 && Number.isFinite(b.gasUsdAssumed) ? b.gasUsdAssumed / b.grossUsd : null; }, (v) => v >= 1],
  ['F45', 'Aave flash fee (bps)', (x) => n(I_(x) && I_(x).breakEven.flashFeeBps.aave_v3), (v) => v >= 5],
  ['F46', 'mirrors where both directions lose', (x) => (x.mirror && x.mirror.last ? x.mirror.last.failures - x.mirror.last.successes - x.mirror.last.leads : null), (v) => v > 0],
  ['F47', 'fee wall of the closest mirror ($)', (x) => n(x.mirror && x.mirror.last && x.mirror.last.best && x.mirror.last.best.wallUsd), (v) => v >= 1],
  ['F49', 'hours since the last success', (x, D) => (D.lastSuccessAt ? (x.now - D.lastSuccessAt) / 3600000 : null), (v) => v >= 24],
  ['F50', 'days without a verified profit', (x, D, R) => (D.since ? ((R.treasury.kpis.realizedNetUsdAllTime || 0) > 0 ? 0 : (x.now - D.since) / DAY) : null), (v) => v >= 1],
];

// removed as duplicates of a kept indicator (the same quantity, its inverse, a threshold or a fixed multiple of it)
const DUPLICATES = Object.freeze({
  S01: 'F02 (seconds since the last scan)', S02: 'F03 (scan time)', S07: 'S08 (best net, against your floor)', S10: 'S19 (positive gross)',
  S12: 'S11 (widest spread)', S15: 'S13 (pools that moved)', S16: 'S17 (feeds up)', S23: 'S20 (tax reserve is 30% of profit)', S38: 'S37 and F26 (the ledger)',
  S47: 'F43 (gas in dollars)', F04: 'S06 (routes approved)', F05: 'S08 (best net)', F06: 'S08 (best net)', F15: 'F14 (reverts)', F17: 'S21 (net 24 h)',
  F18: 'S24 (executor ready)', F19: 'S25 (executor gas)', F20: 'S26 (contract v2)', F23: 'S36 (real-check age)', F27: 'S37 and F26 (the ledger)',
  F28: 'S34 (road steps verified)', F31: 'S40 (rows waiting)', F32: 'S41 (portal reachable)', F34: 'S17 (feeds up)', F35: 'S17 (feeds up)',
  F40: 'S42 (code seal)', F42: 'F43 (gas in dollars)', F48: 'S46 (best-net slope)',
});

const ALL = [...SUCCESS.map((d) => ({ side: 'success', id: d[0], name: d[1], get: d[2], fires: d[3] })), ...FAILURE.map((d) => ({ side: 'failure', id: d[0], name: d[1], get: d[2], fires: d[3] }))];
const HIST = 120, LAMBDA = 0.995, ZRING = 300, DUP_R = 0.95, DUP_MIN = 200;

class Indicators {
  constructor({ dataDir = null, retireDays = 7, minRetireN = 500, provenN = 200, provenRho = 0.1 } = {}) {
    Object.assign(this, { retireDays, minRetireN, provenN, provenRho });
    this.file = dataDir ? path.join(dataDir, 'company', 'indicators.json') : null;
    this.st = { since: null, ind: {}, y: { prevBest: null, prevZ: null, sy: 0, syy: 0, w: 0 }, bestHist: [], dupAt: 0 };
    this.zring = []; // the last cycles' z-scores, for the measured-duplicate check (memory only)
    if (this.file) try { this.st = { ...this.st, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; } catch (_) { /* first run */ }
  }

  save() { if (!this.file) return; try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.st), { mode: 0o600 }); } catch (_) { /* next cycle */ } }

  /** one cycle: measure all 100, learn, retire or reinstate, and return the summary the VP uses */
  observe(x, R, extra = {}) {
    const now = x.now; const st = this.st; if (!st.since) st.since = now;
    const best = n(I_(x) && I_(x).best && I_(x).best.netUsd);
    if (best !== null && (!st.bestHist.length || st.bestHist[st.bestHist.length - 1][0] !== (x.res && x.res.blockNumber))) { st.bestHist.push([x.res.blockNumber, best]); if (st.bestHist.length > 60) st.bestHist.shift(); }
    const D = { ...extra, since: st.since, bestSlope: slope(st.bestHist.map((b) => b[1])), bestEver: st.bestHist.length ? Math.max(...st.bestHist.map((b) => b[1])) : null };
    // the learning target: the change in best net since the previous cycle, explained by the previous cycle's z's
    const y = st.y; const dy = best !== null && y.prevBest !== null ? best - y.prevBest : null;
    if (dy !== null) { y.w = LAMBDA * y.w + 1; y.sy = LAMBDA * y.sy + dy; y.syy = LAMBDA * y.syy + dy * dy; }
    const zNow = {}; const rows = [];
    for (const d of ALL) {
      const s = st.ind[d.id] = st.ind[d.id] || { n: 0, fired: 0, firstAt: now, lastFiredAt: null, hist: [], retired: false, sx: 0, sxx: 0, sxy: 0, w: 0, sy: 0, syy: 0 };
      let v = null; try { v = d.get(x, D, R); } catch (_) { v = null; }
      if (v === null || !Number.isFinite(v)) { rows.push({ ...pub(d, s, now), value: null, firing: false }); continue; }
      const firing = !!d.fires(v);
      s.n += 1; if (firing) { s.fired += 1; s.lastFiredAt = now; if (s.retired) { s.retired = false; s.reinstatedAt = now; } }
      s.hist.push(v); if (s.hist.length > HIST) s.hist.shift();
      const z = zScore(s.hist); zNow[d.id] = z;
      // correlation of last cycle's z with what happened to best net since
      const pz = y.prevZ && Number.isFinite(y.prevZ[d.id]) ? y.prevZ[d.id] : null;
      if (pz !== null && dy !== null) { s.w = LAMBDA * s.w + 1; s.sx = LAMBDA * s.sx + pz; s.sxx = LAMBDA * s.sxx + pz * pz; s.sxy = LAMBDA * s.sxy + pz * dy; s.sy = LAMBDA * s.sy + dy; s.syy = LAMBDA * s.syy + dy * dy; }
      if (!s.retired && s.fired === 0 && s.n >= this.minRetireN && now - s.firstAt >= this.retireDays * DAY) { s.retired = true; s.retiredAt = now; }
      rows.push({ ...pub(d, s, now), value: v, z, firing });
    }
    y.prevBest = best; y.prevZ = zNow;
    this.zring.push(zNow); if (this.zring.length > ZRING) this.zring.shift();
    if (now - (st.dupAt || 0) >= DAY && this.zring.length >= DUP_MIN) { st.dupAt = now; this.dedupe(); }
    for (const r of rows) { const s = st.ind[r.id]; r.duplicateOf = s.duplicateOf || null; }
    const active = rows.filter((r) => r.value !== null && !r.retired && !r.duplicateOf);
    const c = active.map((r) => (r.side === 'success' ? 1 : -1) * clamp(r.z));
    const momentum = c.length ? c.reduce((a, b) => a + b, 0) / c.length : null;
    const proven = active.map((r) => ({ r, rho: rhoOf(st.ind[r.id]) })).filter((p) => p.rho !== null && st.ind[p.r.id].n >= this.provenN && Math.abs(p.rho) >= this.provenRho);
    const sd = y.w > 1 ? Math.sqrt(Math.max(0, y.syy / y.w - (y.sy / y.w) ** 2)) : null;
    const den = proven.reduce((a, p) => a + Math.abs(p.rho), 0);
    const forecast = proven.length && sd !== null && den > 0 ? (sd * proven.reduce((a, p) => a + p.rho * clamp(p.r.z), 0)) / den : null;
    const drivers = proven.map((p) => ({ id: p.r.id, name: p.r.name, side: p.r.side, rho: p.rho, z: clamp(p.r.z), effect: p.rho * clamp(p.r.z) })).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, 5);
    this.save();
    const pick = (side) => active.filter((r) => r.side === side && r.firing).map((r) => ({ id: r.id, name: r.name, value: r.value }));
    return {
      at: now, momentum, forecastUsd: forecast, drivers, measured: active.length, provenCount: proven.length,
      firingSuccess: pick('success'), firingFailure: pick('failure'),
      retired: rows.filter((r) => r.retired).map((r) => ({ id: r.id, name: r.name, measured: r.n, days: r.days })),
      duplicates: rows.filter((r) => r.duplicateOf).map((r) => ({ id: r.id, of: r.duplicateOf })),
      rows,
    };
  }
}

/** measured duplicates: pairs whose z-scores moved together over the shared recent cycles */
Indicators.prototype.dedupe = function dedupe() {
  const ids = ALL.map((d) => d.id); const st = this.st;
  for (const id of ids) if (st.ind[id]) st.ind[id].duplicateOf = null;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j]; if (st.ind[b] && st.ind[b].duplicateOf) continue;
      const xs = [], ys = []; for (const z of this.zring) if (Number.isFinite(z[a]) && Number.isFinite(z[b])) { xs.push(z[a]); ys.push(z[b]); }
      if (xs.length < DUP_MIN) continue;
      const r = corr(xs, ys); if (r !== null && Math.abs(r) >= DUP_R && st.ind[b]) st.ind[b].duplicateOf = `${a} (r ${r.toFixed(2)})`;
    }
  }
};
function corr(xs, ys) {
  const k = xs.length; const mx = xs.reduce((p, q) => p + q, 0) / k, my = ys.reduce((p, q) => p + q, 0) / k;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < k; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx > 1e-12 && syy > 1e-12 ? sxy / Math.sqrt(sxx * syy) : null;
}

function pub(d, s, now) { return { id: d.id, side: d.side, name: d.name, n: s.n, fired: s.fired, retired: s.retired, days: Math.round(((now - s.firstAt) / DAY) * 10) / 10 }; }
function clamp(z) { return Number.isFinite(z) ? Math.max(-3, Math.min(3, z)) : 0; }
function zScore(h) {
  if (h.length < 6) return 0;
  const s = h.slice(0, -1).slice().sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)];
  const mad = s.map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(s.length / 2)];
  const v = h[h.length - 1];
  return mad > 0 ? (v - med) / (1.4826 * mad) : v === med ? 0 : Math.sign(v - med) * 3;
}
function rhoOf(s) {
  if (!s || s.w < 30) return null;
  const mx = s.sx / s.w, my = s.sy / s.w; const vx = s.sxx / s.w - mx * mx, vy = s.syy / s.w - my * my;
  if (!(vx > 1e-12 && vy > 1e-12)) return null;
  return (s.sxy / s.w - mx * my) / Math.sqrt(vx * vy);
}
/** least-squares slope of the series per step; null under 5 points */
function slope(ys) {
  if (ys.length < 5) return null;
  const k = ys.length; const mx = (k - 1) / 2; const my = ys.reduce((a, b) => a + b, 0) / k;
  let sxy = 0, sxx = 0; ys.forEach((y, i) => { sxy += (i - mx) * (y - my); sxx += (i - mx) ** 2; });
  return sxy / sxx;
}

/** report lines for the VP's daily report and the dashboard */
function lines(s) {
  if (!s) return ['INDICATORS: not measured yet'];
  const usd = (v) => (v < 0 ? '-$' : '+$') + Math.abs(v).toFixed(2);
  return [
    `INDICATORS (${SUCCESS.length} success, ${FAILURE.length} failure, ${s.measured} measured now, ${s.retired.length} retired, ${(s.duplicates || []).length} measured duplicates, ${s.provenCount} proven): momentum ${s.momentum === null ? '—' : (s.momentum >= 0 ? '+' : '') + s.momentum.toFixed(2)} (−3…+3)`,
    `  firing: ${s.firingSuccess.length} success · ${s.firingFailure.length} failure${s.firingSuccess.length ? ' — ' + s.firingSuccess.slice(0, 4).map((r) => r.name).join('; ') : ''}`,
    ...(s.firingFailure.length ? ['  failures firing: ' + s.firingFailure.slice(0, 4).map((r) => r.name).join('; ')] : []),
    s.forecastUsd === null ? '  forecast: no indicator proven yet (each needs 200 measurements and a correlation of 0.1 or more with what followed)'
      : `  forecast (Δ̂ = σ·Σρz/Σ|ρ|): best net ${usd(s.forecastUsd)} at the next scan · drivers: ${s.drivers.map((d) => `${d.id} ${d.name} (ρ ${d.rho.toFixed(2)})`).join('; ')}`,
    ...((s.duplicates || []).length ? [`  measured duplicates (left out while they move together): ${s.duplicates.map((d) => `${d.id} of ${d.of}`).join(', ')}`] : []),
    ...(s.retired.length ? [`  retired (measured ${'≥'}7 days without firing once): ${s.retired.map((r) => r.id).join(', ')}`] : []),
  ];
}

module.exports = { Indicators, SUCCESS, FAILURE, ALL, DUPLICATES, lines, zScore, slope, rhoOf, corr };
