'use strict';
// Which way prices are moving, measured. For every pair the scanner prices (the median across its pools, each block it
// scans), the model keeps a short series of log prices and computes, per pair:
//   r_t   = ln(p_t / p_{t-1})                                  one-scan log return
//   μ, σ² = exponentially weighted mean and variance of r      (half-life H scans; default 20)
//   n_eff = (Σw)² / Σw²                                         effective sample size of those weights
//   t     = μ / (σ / √n_eff)                                    drift t-statistic
//   direction = rising if t ≥ 2, falling if t ≤ −2, flat otherwise; confidence = 1 − 2·Φ(−|t|)
//   ê     = μ · k                                               expected move over the next k scans (bps), if the drift holds
// Plus, per pair with two or more pools, the cross-pool spread's z-score against its own history: a spread far above
// its normal (z ≥ 2) tends to close, which is when an arbitrage pays. This is statistics on measured prices, not a
// promise: a drift can stop at any block, and it is reported with its confidence so it is never read as certain.
const LN2 = Math.log(2);
const MAX_POINTS = 240;

/** standard normal CDF (Abramowitz–Stegun 26.2.17; error under 1e-6 with these coefficients) */
function phi(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** drift statistics of a series of positive prices, newest last */
function drift(prices, halfLife = 20, horizon = 10) {
  const r = []; for (let i = 1; i < prices.length; i++) if (prices[i] > 0 && prices[i - 1] > 0) r.push(Math.log(prices[i] / prices[i - 1]));
  if (r.length < 5) return null;
  const lam = Math.exp(-LN2 / halfLife); let sw = 0, sw2 = 0, m = 0;
  const w = r.map((_, i) => lam ** (r.length - 1 - i));
  for (let i = 0; i < r.length; i++) { sw += w[i]; sw2 += w[i] * w[i]; m += w[i] * r[i]; }
  m /= sw; let v = 0; for (let i = 0; i < r.length; i++) v += w[i] * (r[i] - m) ** 2; v /= sw;
  const nEff = (sw * sw) / sw2; const sd = Math.sqrt(v);
  if (!(sd > 0)) return { mu: m, sd: 0, nEff, t: 0, direction: 'flat', confidence: 0, expectedBps: 0, points: prices.length };
  const t = m / (sd / Math.sqrt(nEff));
  return { mu: m, sd, nEff, t, direction: t >= 2 ? 'rising' : t <= -2 ? 'falling' : 'flat', confidence: 1 - 2 * phi(-Math.abs(t)), expectedBps: m * horizon * 1e4, points: prices.length };
}

/** robust z-score of the newest value against the series before it (median and MAD) */
function robustZ(xs) {
  if (xs.length < 6) return null;
  const h = xs.slice(0, -1).slice().sort((a, b) => a - b); const med = h[Math.floor(h.length / 2)];
  const mad = h.map((x) => Math.abs(x - med)).sort((a, b) => a - b)[Math.floor(h.length / 2)];
  return mad > 0 ? (xs[xs.length - 1] - med) / (1.4826 * mad) : 0;
}

class Direction {
  constructor({ halfLife = 20, horizon = 10 } = {}) { this.halfLife = halfLife; this.horizon = horizon; this.series = new Map(); this.spreads = new Map(); this.lastBlock = null; }

  /** one scan's prices (res.indicators.prices) and spreads; ignored if the block did not advance */
  observe(res) {
    const I = res && res.indicators; if (!I || !Array.isArray(I.prices) || !Number.isFinite(res.blockNumber)) return false;
    if (this.lastBlock !== null && res.blockNumber <= this.lastBlock) return false;
    this.lastBlock = res.blockNumber;
    for (const x of I.prices) {
      if (!(x.p > 0)) continue;
      const s = this.series.get(x.key) || { pair: x.pair, ps: [] }; s.ps.push(x.p); if (s.ps.length > MAX_POINTS) s.ps.shift(); s.pair = x.pair; this.series.set(x.key, s);
    }
    for (const x of I.spreads || []) {
      const k = (x.pair || []).join('|'); const s = this.spreads.get(k) || []; s.push(x.bps); if (s.length > MAX_POINTS) s.shift(); this.spreads.set(k, s);
    }
    return true;
  }

  /** every pair's drift, strongest first; and the spreads unusually wide right now */
  summary(limit = 10) {
    const pairs = [];
    for (const [key, s] of this.series) { const d = drift(s.ps, this.halfLife, this.horizon); if (d) pairs.push({ key, pair: s.pair, ...d }); }
    pairs.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
    const wide = [];
    for (const [k, s] of this.spreads) { const z = robustZ(s); if (z !== null && z >= 2) wide.push({ pair: k.split('|'), bps: s[s.length - 1], z }); }
    wide.sort((a, b) => b.z - a.z);
    return { pairs: pairs.slice(0, limit), measured: pairs.length, confident: pairs.filter((p) => p.direction !== 'flat').length, wideSpreads: wide.slice(0, limit) };
  }
}

/** report lines */
function lines(s) {
  if (!s || !s.measured) return ['PRICE DIRECTION: not enough scans yet (it needs 6 per pair)'];
  const f = (p) => `${p.pair[0]} in ${p.pair[1]} ${p.direction} (t ${p.t.toFixed(1)}, ${Math.round(p.confidence * 100)}% confidence, ${p.expectedBps >= 0 ? '+' : ''}${p.expectedBps.toFixed(1)} bps over the next 10 scans if it holds)`;
  return [`PRICE DIRECTION (measured drift, ${s.measured} pairs, ${s.confident} with a confident direction):`,
    ...s.pairs.filter((p) => p.direction !== 'flat').slice(0, 5).map((p) => '  ' + f(p)),
    ...(s.confident ? [] : ['  no pair has a confident direction right now (|t| < 2 everywhere)']),
    ...s.wideSpreads.slice(0, 3).map((w) => `  spread ${w.pair.join('/')} ${w.bps} bps is ${w.z.toFixed(1)}σ above its normal: gaps like this tend to close (an arbitrage window)`)];
}

module.exports = { Direction, drift, robustZ, phi, lines };
