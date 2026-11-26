'use strict';
// Counts opportunity EPISODES across scans: a route that stays approved for several scans is one opportunity, not many.
// One opportunity = one cycle. Borrowing USDC to buy WETH on A and sell on B is the same cycle as borrowing WETH to
// sell on B and buy back on A, so both directions share one key and are never counted twice.
// Cycles of 3-4 legs: the same loop of pools in the same direction is one opportunity whichever token is borrowed.
const routeKey = (c) => (c.legsCount > 2 && c.cycleKey ? `${(c.loopPath || c.path || []).join('>')}|${c.cycleKey}`
  : c.borrowSymbol < c.otherSymbol
    ? `${c.borrowSymbol}>${c.otherSymbol}|${c.buyOn}|${c.sellOn}`
    : `${c.otherSymbol}>${c.borrowSymbol}|${c.sellOn}|${c.buyOn}`);

class Session {
  constructor() { this.startedAt = Date.now(); this.scans = 0; this.errors = 0; this.standby = 0; this.episodes = []; this.blocks = new Set(); this.prev = new Set(); this.open = new Map(); this.closed = []; this.scanMs = []; }
  add(res) {
    this.scans++;
    if (Number.isFinite(res.tookMs)) { this.scanMs.push(res.tookMs); if (this.scanMs.length > 200) this.scanMs.shift(); }
    if (res.status === 'STANDBY_GAS_WAIT') this.standby++;
    const approved = res.candidates.filter((c) => c.approved);
    const now = new Set(approved.map(routeKey));
    const fresh = [];
    const seenNow = new Set();
    for (const c of approved) {
      const k = routeKey(c);
      if (seenNow.has(k)) continue; // the same cycle from the other direction
      seenNow.add(k);
      if (!this.prev.has(k)) { const e = { block: res.blockNumber, at: new Date().toISOString(), route: k, netUsd: c.netUsd, amountUsd: c.amountUsd }; this.episodes.push(e); this.blocks.add(res.blockNumber); fresh.push(e); }
    }
    for (const k of now) if (!this.open.has(k)) this.open.set(k, { scans: 0, firstBlock: res.blockNumber });
    for (const [k, o] of this.open) {
      if (now.has(k)) { o.scans++; o.lastBlock = res.blockNumber; }
      else { this.closed.push({ scans: o.scans, blocks: (o.lastBlock || o.firstBlock) - o.firstBlock }); this.open.delete(k); }
    }
    if (this.closed.length > 500) this.closed.splice(0, this.closed.length - 500);
    this.prev = now;
    return fresh;
  }
  error() { this.errors++; }
  /** Speed and competition, measured: how slow is a scan in blocks, and how fast do opportunities disappear. */
  edge(blockMs = 250) {
    const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const ms = med(this.scanMs);
    const oneScan = this.closed.filter((c) => c.scans <= 1).length;
    return { medianScanMs: ms, scanBlocks: ms === null ? null : ms / blockMs, closedEpisodes: this.closed.length, vanishedWithinOneScan: this.closed.length ? oneScan / this.closed.length : null, medianLifetimeScans: med(this.closed.map((c) => c.scans)) };
  }
  summary(t) {
    const hours = Math.max((Date.now() - this.startedAt) / 3600000, 1e-9);
    const sum = this.episodes.reduce((s, e) => s + e.netUsd, 0);
    const MIN_MINUTES = 10; // projecting a day from a few seconds of data would be meaningless
    const minutes = (Date.now() - this.startedAt) / 60000;
    const perDay = minutes >= MIN_MINUTES ? (sum / hours) * 24 : null;
    const has = t && [t.GO_MIN_EPISODES, t.GO_MIN_DISTINCT_BLOCKS, t.GO_MIN_USD_PER_DAY].every(Number.isFinite);
    const checks = has ? { episodes: this.episodes.length >= t.GO_MIN_EPISODES, blocks: this.blocks.size >= t.GO_MIN_DISTINCT_BLOCKS, usd: perDay !== null && perDay >= t.GO_MIN_USD_PER_DAY } : null;
    let verdict;
    if (!this.scans) verdict = 'WAITING';
    else if (minutes < MIN_MINUTES) verdict = 'MEASURING'; // too little data to conclude either way
    else if (!this.episodes.length) verdict = 'NO-GO';
    else if (!checks) verdict = 'NO THRESHOLDS';
    else verdict = checks.episodes && checks.blocks && checks.usd ? 'GO TO SHADOW TEST' : 'NO-GO';
    return { minutesToProjection: Math.max(0, MIN_MINUTES - minutes), windowHours: hours, scans: this.scans, errors: this.errors, standby: this.standby, episodes: this.episodes.length, distinctBlocks: this.blocks.size, sumNetUsd: sum, perDayUpperBound: perDay, checks, verdict };
  }
}
module.exports = { Session, routeKey };
