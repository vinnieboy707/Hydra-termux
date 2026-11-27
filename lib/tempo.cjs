'use strict';
// Tempo: the engine works harder exactly when there is something to win, and eases off when there is not.
// Each scan moves the tempo from what that scan really measured:
//   · up one level when a route was approved, or the best route netted above zero (a real gap, short of the floor);
//     up two at once when two or more routes were approved;
//   · down one level after 3 scans in a row with neither (steady markets cost little).
// Levels 0–3 (CHRONOS_TEMPO_MAX caps it, default 3):
//   level   scan interval   routes quoted per scan
//     0        × 1             × 1
//     1        × 0.75          × 1.5
//     2        × 0.5           × 2
//     3        × 0.33          × 2.5
// Every limit still holds above it: the node pool paces each metered node inside its plan (a faster tempo uses your
// unmetered nodes and waits for the others), the interval never goes below 3 s, and quotes never above 2,000 a scan.
const LEVELS = Object.freeze([{ interval: 1, quotes: 1 }, { interval: 0.75, quotes: 1.5 }, { interval: 0.5, quotes: 2 }, { interval: 0.33, quotes: 2.5 }]);
const MIN_INTERVAL_S = 3, MAX_QUOTES = 2000;

class Tempo {
  constructor({ max = 3 } = {}) { this.max = Math.max(0, Math.min(3, Number.isFinite(Number(max)) ? Number(max) : 3)); this.level = 0; this.quiet = 0; this.changes = []; }
  /** one scan's result → the new level (and why, when it changed) */
  observe(res, now = Date.now()) {
    const approved = (res && res.approved) || 0; const best = res && res.indicators && res.indicators.best ? Number(res.indicators.best.netUsd) : null;
    const hot = approved > 0 || (Number.isFinite(best) && best > 0);
    const was = this.level;
    if (hot) { this.quiet = 0; this.level = Math.min(this.max, this.level + (approved >= 2 ? 2 : 1)); }
    else if (++this.quiet >= 3) { this.quiet = 0; this.level = Math.max(0, this.level - 1); }
    if (this.level !== was) { const why = hot ? (approved ? `${approved} route(s) approved` : `best route nets $${best.toFixed(4)} (a real gap)`) : '3 quiet scans'; this.changes = [...this.changes.slice(-19), { at: now, from: was, to: this.level, why }]; return { changed: true, level: this.level, why }; }
    return { changed: false, level: this.level };
  }
  /** the scan interval (seconds) for a base interval */
  interval(baseS) { return Math.max(MIN_INTERVAL_S, Math.round(baseS * LEVELS[this.level].interval * 10) / 10); }
  /** routes quoted per scan for a base number */
  quotes(base) { return Math.min(MAX_QUOTES, Math.round((Number(base) || 400) * LEVELS[this.level].quotes)); }
  status() { return { level: this.level, max: this.max, intervalFactor: LEVELS[this.level].interval, quoteFactor: LEVELS[this.level].quotes, recent: this.changes.slice(-5) }; }
}

module.exports = { Tempo, LEVELS, MIN_INTERVAL_S, MAX_QUOTES };
