'use strict';
// Pure math + decision logic. No network, no clock, no randomness: everything here is unit-tested.
// All token amounts are BigInt in token units. USD figures are Numbers for display and gating only.

const BPS = 10000n;
const ceilDiv = (a, b) => (a + b - 1n) / b;

/** Aave V3 flash-loan premium, rounded up like the pool does. */
function flashPremium(amount, premiumBps) { return ceilDiv(amount * BigInt(premiumBps), BPS); }

/** USD (Number) -> token units, using an Aave-oracle price with 8 decimals (USD per 1 token * 1e8). */
function usdToAsset(usd, price8, decimals) {
  const usd8 = BigInt(Math.round(usd * 1e8));
  return (usd8 * 10n ** BigInt(decimals)) / price8;
}
function assetToUsd(amount, price8, decimals) {
  return Number((amount * price8) / 10n ** BigInt(decimals)) / 1e8;
}

/** USD cost of one transaction at the current gas price. gasUnits is an assumption supplied by the caller. */
function gasCostUsd({ gasPriceWei, gasUnits, ethUsd }) {
  return (Number(gasPriceWei) * gasUnits / 1e18) * ethUsd;
}

/**
 * One cycle: borrow `amount`, swap through every leg in order, end in the borrowed asset. legs = [quoteFn(amountIn)].
 * Returns null if any quote fails. ins/outs are per leg; out1 = first leg's output, out2 = what comes back.
 */
async function evaluateCycle({ amount, legs, premiumBps, gasCostAsset }) {
  const ins = [], outs = [];
  let x = amount;
  for (const q of legs) {
    const o = await q(x);
    if (o === null || o === undefined || o <= 0n) return null;
    ins.push(x); outs.push(o); x = o;
  }
  const premium = flashPremium(amount, premiumBps);
  const gross = x - amount;                    // before flash premium and gas
  const contractProfit = gross - premium;      // what the contract's own profit check sees (gas is paid in ETH)
  const net = contractProfit - gasCostAsset;   // real economics
  return { amount, ins, outs, out1: outs[0], out2: x, premium, gross, contractProfit, net };
}

/** One round trip: borrow `amount`, buy on market 1, sell on market 2 (a 2-leg cycle). */
async function evaluateRoundTrip({ amount, quoteBuy, quoteSell, premiumBps, gasCostAsset }) {
  return evaluateCycle({ amount, legs: [quoteBuy, quoteSell], premiumBps, gasCostAsset });
}

/**
 * Try every ladder size at once, then refine around the best: each round quotes 8 sizes in parallel (one network
 * round trip) and keeps the bracket around the best one, so the search needs few round trips. It stops once the
 * bracket is within 0.5% of the size (profit is flat near the best size). Never searches outside the ladder's smallest/largest size; never trusts a failed quote.
 */
async function optimizeSize(evalFn, ladderIn, iters, { points = 8 } = {}) {
  // sizes ascending and unique, whatever order they were written in
  const ladder = [...new Set(ladderIn.map((x) => x.toString()))].map((x) => BigInt(x)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (!ladder.length) return null;
  const pts = (await Promise.all(ladder.map((a) => evalFn(a)))).filter(Boolean);
  if (!pts.length) return null;
  let bi = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].net > pts[bi].net) bi = i;
  let best = pts[bi];
  // The ladder's smallest and largest sizes are the operator's size limits (from .env). Never search outside them.
  const minAmt = ladder[0];
  const maxAmt = ladder[ladder.length - 1];
  let lo = bi > 0 ? pts[bi - 1].amount : minAmt;
  let hi = bi < pts.length - 1 ? pts[bi + 1].amount : maxAmt;
  for (let i = 0; i < iters && hi - lo > 2n; i++) {
    if ((hi - lo) * 200n <= best.amount) break; // bracket within 0.5% of the size: profit is flat there, close enough
    const step = (hi - lo) / BigInt(points + 1);
    if (step === 0n) break;
    const xs = Array.from({ length: points }, (_, k) => lo + step * BigInt(k + 1));
    const rs = await Promise.all(xs.map((x) => evalFn(x)));
    let bk = -1;
    rs.forEach((r, k) => {
      if (!r) return;
      if (bk < 0 || r.net > rs[bk].net) bk = k;
      if (r.net > best.net) best = r;
    });
    if (bk < 0) break;
    lo = bk === 0 ? lo : xs[bk - 1];
    hi = bk === points - 1 ? hi : xs[bk + 1];
  }
  return best;
}

/** Price impact of a leg versus a small probe, in bps (positive = worse than the probe price). */
function impactBps({ amountIn, amountOut, probeIn, probeOut }) {
  if (probeOut <= 0n || amountIn <= 0n || probeIn <= 0n) return null;
  // effective price = out/in. impact = 1 - (out/in) / (probeOut/probeIn)
  const num = amountOut * probeIn * BPS;
  const den = probeOut * amountIn;
  const ratioBps = num / den; // 10000 = same price as probe
  return Number(BPS - ratioBps);
}

/**
 * The profit floor for one route: the larger of MIN_NET_PROFIT_USD (your absolute minimum) and FLOOR_GAS_MULT × the
 * route's own gas cost (default 2: a trade must keep at least twice what it pays in gas). FLOOR_GAS_MULT=0 keeps the
 * fixed floor. Competitors on Arbitrum keep $0.06–$1.50 a trade at ~$0.02 gas, so a fixed $0.35 skips most real wins.
 */
function floorUsd(cfg, gasUsd) {
  const min = Number(cfg.MIN_NET_PROFIT_USD); const mult = cfg.FLOOR_GAS_MULT === undefined || cfg.FLOOR_GAS_MULT === null ? 2 : Number(cfg.FLOOR_GAS_MULT);
  const byGas = Number.isFinite(gasUsd) && gasUsd > 0 && mult > 0 ? mult * gasUsd : 0;
  return Math.max(Number.isFinite(min) ? min : 0, byGas);
}

/**
 * Guardrails. This function only ever says yes or no; it never loosens a limit.
 * Every limit comes from cfg (which comes from .env).
 */
function decide({ cand, cfg, gasGwei, assetUsd, route, availableLiquidity, flashEnabled }) {
  const reasons = [];
  if (!flashEnabled) reasons.push('asset not flash-loanable on Aave right now');
  if (gasGwei > cfg.GAS_CEILING_GWEI) reasons.push(`STANDBY_GAS_WAIT: gas ${gasGwei.toFixed(4)} gwei > ceiling ${cfg.GAS_CEILING_GWEI}`);
  const ms = route.markets || [route.buy, route.sell];
  if (ms.some((m) => !m.executable)) reasons.push('NOT_EXECUTABLE: contract has no adapter for ' + [...new Set(ms.filter((m) => !m.executable).map((m) => m.venueId))].join(', '));
  if (ms.length > (cfg.MAX_LEGS || 4)) reasons.push(`${ms.length} legs > contract MAX_LEGS ${cfg.MAX_LEGS || 4}`);
  const floor = floorUsd(cfg, cand.gasUsd);
  if (cand.netUsd < floor) reasons.push(`net $${cand.netUsd.toFixed(4)} below floor $${floor.toFixed(4)}`);
  const imps = cand.impacts || [cand.impact1, cand.impact2];
  if (imps.some((x) => x === null || x === undefined)) reasons.push('price impact could not be measured');
  else imps.forEach((x, i) => { if (x > cfg.MAX_SLIPPAGE_BPS) reasons.push(`leg ${i + 1} impact ${x} bps > cap ${cfg.MAX_SLIPPAGE_BPS}`); });
  if (availableLiquidity !== null && availableLiquidity !== undefined && cand.amount > availableLiquidity) reasons.push('amount exceeds Aave available liquidity');
  return { approved: reasons.length === 0, reasons };
}

/** Parameters for ChronosFlashArb.execute(asset, amount, minProfit, deadline, legs). Nothing here is sent. */
/**
 * The exact call for the deployed contract. v1 (contract.kind 1 or unknown): Aave loan, router legs, as before.
 * v2: `source` 0 = Aave, 1 = Balancer, 2 = Morpho Blue, 3 = Uniswap V4 (cand.premium is that source's fee); a Curve leg is
 * Dex.CurvePool (4) on an allowlisted pool, its coin indexes packed in `fee` as (i << 8) | j; each other leg is a direct pool/pair swap when the
 * contract allows that market's factory as that kind, otherwise the venue's router (contractinfo.legMode).
 */
function buildRunParams({ asset, tokenB, amount, cand, route, cfg, assetPrice8, decimals, nowSec, contract = null, source = 0 }) {
  const slip = BigInt(Math.floor(cfg.MAX_SLIPPAGE_BPS));
  const floorAsset = usdToAsset(floorUsd(cfg, cand.gasUsd), assetPrice8, decimals);
  let minProfit = (cand.contractProfit * BigInt(Math.floor(cfg.MIN_PROFIT_CAPTURE_BPS))) / BPS;
  if (minProfit < floorAsset) minProfit = floorAsset;
  if (minProfit > cand.contractProfit) minProfit = cand.contractProfit; // never ask for more than the quote shows
  if (minProfit <= 0n) minProfit = 1n; // the contract rejects 0
  // every leg's own floor; the last leg must at least repay the loan, the flash fee and minProfit
  const markets = route.markets || [route.buy, route.sell];
  const path = route.path || [asset, tokenB, asset];
  const outs = cand.outs || [cand.out1, cand.out2];
  const mustReturn = amount + cand.premium + minProfit;
  const v2 = !!(contract && contract.kind === 2);
  const { legMode } = require('./contractinfo.cjs');
  const legs = markets.map((m, i) => {
    let minOut = (outs[i] * (BPS - slip)) / BPS;
    if (i === markets.length - 1 && minOut < mustReturn) minOut = mustReturn;
    const leg = { dex: m.kind === 'v3' ? 0 : 1, router: m.router, tokenOut: path[i + 1], fee: m.fee || 0, minOut: minOut.toString() }; // enum Dex { UniV3, UniV2 } in v1
    if (v2) {
      const mode = legMode(contract, m); // v2 enum Dex { UniV3Router, UniV2Router, V3Pool, V2Pair }
      if (mode === 'curve') { const ci = m.coins.indexOf(path[i]), cj = m.coins.indexOf(path[i + 1]); Object.assign(leg, { v2dex: 4, target: m.address, fee: (ci << 8) | cj }); }
      else if (mode === 'none') throw new Error(`no way for your contract to trade on ${m.id}`); // never sent: decide() refuses such routes first
      else Object.assign(leg, mode === 'pool' ? { v2dex: 2, target: m.address, factory: m.factory } : mode === 'pair' ? { v2dex: 3, target: m.address, factory: m.factory } : { v2dex: leg.dex, target: m.router });
    }
    return leg;
  });
  const out = { asset, amount: amount.toString(), minProfit: minProfit.toString(), deadline: nowSec + cfg.DEADLINE_SECONDS, legs };
  if (v2) Object.assign(out, { v: 2, source });
  return out;
}

module.exports = { BPS, floorUsd, flashPremium, usdToAsset, assetToUsd, gasCostUsd, evaluateCycle, evaluateRoundTrip, optimizeSize, impactBps, decide, buildRunParams };
