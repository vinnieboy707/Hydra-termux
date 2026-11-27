'use strict';
// The gas specialist. On Arbitrum gas is paid in ETH only (no other token can pay it), and a flash loan needs no
// tokens up front: the contract borrows, trades and repays loan + fee inside one transaction from the trade itself.
// So the specialist's job is the ETH side of every opportunity, measured, not assumed:
//   · price each route's gas from what your shadow tests measured (eth_estimateGas of the exact transaction, which on
//     Arbitrum includes its L1 data cost), +15%. Gas differs by route, so it is learned per ROUTE TYPE — the lender
//     and each leg's pool kind, e.g. "balancer_v2|v3,v2" — then per leg count, and until 3 measurements exist your
//     GAS_UNITS_ASSUMED scaled per leg is used (the conservative default);
//   · gauge the executor's ETH: how many sends it can still pay for at the current gas price, and exactly how much
//     to top up to get back to 200 sends — told to you before it runs out (topping up is your YES, never automatic);
//   · watch the gas price: more than 5× its median over the last 100 scans is a spike → sending pauses (shadow
//     continues) until it settles.
const MARGIN = 1.15, MIN_SAMPLES = 3, TARGET_SENDS = 200, LOW_SENDS = 50, SPIKE = 5;

/** a route's type for gas: lender + each leg's pool kind */
function routeType(kinds, lender) { return `${lender || 'aave_v3'}|${kinds.join(',')}`; }

class GasDesk {
  constructor() { this.units = {}; this.prices = []; }
  /** a shadow test measured a route's gas: kinds = each leg's pool kind (['v3','v2']), lender = 'aave_v3' | 'balancer_v2' */
  learn(kinds, lender, gasUnits) {
    const g = Number(gasUnits); if (!Array.isArray(kinds) || kinds.length < 2 || !(g > 0)) return;
    for (const k of [routeType(kinds, lender), String(kinds.length)]) {
      const s = this.units[k] = this.units[k] || { n: 0, ewma: 0, max: 0 };
      s.n += 1; s.ewma = s.n === 1 ? g : s.ewma * 0.8 + g * 0.2; s.max = Math.max(s.max, g);
    }
  }
  _u(k) { const s = this.units[k]; return s && s.n >= MIN_SAMPLES ? Math.ceil(Math.max(s.ewma, s.max * 0.9) * MARGIN) : null; }
  /** gas units for a route: its own route type, else its leg count, else null (the caller uses its assumption) */
  unitsFor(kinds, lender) { return this._u(routeType(kinds, lender)) || this._u(String(kinds.length)); }
  /** every measured route type and leg count → units (what the scan prices routes with) */
  unitsMap() { const m = {}; for (const k of Object.keys(this.units)) { const u = this._u(k); if (u) m[k] = u; } return m; }
  /** the scan's gas price (gwei) */
  observePrice(gwei) { const g = Number(gwei); if (g > 0) { this.prices.push(g); if (this.prices.length > 100) this.prices.shift(); } }
  spike() {
    if (this.prices.length < 20) return null;
    const sorted = this.prices.slice(0, -1).sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)]; const now = this.prices[this.prices.length - 1];
    return now > SPIKE * med ? { now, median: med } : null;
  }
  /** the executor's gas position: executorEth (number|null), gasGwei, ethUsd, assumedUnits (2-leg default) */
  status({ executorEth = null, gasGwei, ethUsd, assumedUnits }) {
    const units = this._u('2') || assumedUnits; const perSendEth = (units * gasGwei) / 1e9;
    const out = { measured: Object.keys(this.unitsMap()), unitsPerSend: units, perSendEth, perSendUsd: perSendEth * ethUsd, spike: this.spike() };
    if (Number.isFinite(executorEth) && perSendEth > 0) {
      out.executorEth = executorEth; out.sendsLeft = Math.floor(executorEth / perSendEth);
      out.topUpEth = out.sendsLeft < LOW_SENDS ? Math.max(0, TARGET_SENDS * perSendEth - executorEth) : 0;
    }
    return out;
  }
}

module.exports = { GasDesk, routeType, MARGIN, MIN_SAMPLES, TARGET_SENDS, LOW_SENDS, SPIKE };
