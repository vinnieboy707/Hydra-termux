/**
 * solana-arb-gate.js
 * Offline, deterministic, fail-closed gate for Solana cross-DEX flash-loan arbitrage.
 */

const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function stable(obj) {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'bigint') return JSON.stringify(obj.toString());
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) return '[' + obj.map(stable).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stable(obj[k])).join(',') + '}';
}

function big(val) {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number' || typeof val === 'string') return BigInt(val);
  throw new Error(`Cannot convert ${val} to BigInt`);
}

function cpmmOut(reserveIn, reserveOut, amountIn, feeBps = 30) {
  const rIn = big(reserveIn);
  const rOut = big(reserveOut);
  const amtIn = big(amountIn);
  const f = big(feeBps);
  
  if (amtIn <= 0n || rIn <= 0n || rOut <= 0n) return 0n;
  const amountInWithFee = amtIn * (10000n - f);
  const numerator = amountInWithFee * rOut;
  const denominator = (rIn * 10000n) + amountInWithFee;
  if (denominator === 0n) return 0n;
  return numerator / denominator;
}

function decideArb(inp) {
  const reasons = [];
  const need = (cond, msg) => {
    if (!cond) reasons.push(msg);
    return cond;
  };

  // Fail closed validation
  need(inp && typeof inp === 'object', 'input object required');
  if (reasons.length > 0) {
    return { go: false, reasons, fingerprint: sha256(stable({})) };
  }

  const {
    amountInQuote,
    pools,
    flashFeeBps = 9n, // e.g. 0.09% Kamino flash fee
    baseFeeLamports = 5000n,
    priorityFeeLamports = 1000n,
    minNetQuote = 0n,
    minMarginBps = 0n,
    solPriceQuote = 0n, // quote units per SOL
    tip = {},
    floor = {}
  } = inp;

  need(amountInQuote != null && big(amountInQuote) > 0n, 'invalid amountInQuote');
  need(pools && pools.buy && pools.sell, 'pools.buy and pools.sell required');
  need(pools?.buy?.reserveIn && pools?.buy?.reserveOut, 'buy pool reserves required');
  need(pools?.sell?.reserveIn && pools?.sell?.reserveOut, 'sell pool reserves required');

  if (reasons.length > 0) {
    return { go: false, reasons, fingerprint: sha256(stable(inp)) };
  }

  const amtQuote = big(amountInQuote);
  const buyFeeBps = pools.buy.feeBps != null ? big(pools.buy.feeBps) : 30n;
  const sellFeeBps = pools.sell.feeBps != null ? big(pools.sell.feeBps) : 30n;

  // Leg A: Buy BASE on pool A using QUOTE
  const baseOut = cpmmOut(pools.buy.reserveIn, pools.buy.reserveOut, amtQuote, buyFeeBps);
  need(baseOut > 0n, 'leg A output zero');

  // Leg B: Sell BASE on pool B for QUOTE
  const quoteOut = cpmmOut(pools.sell.reserveIn, pools.sell.reserveOut, baseOut, sellFeeBps);
  need(quoteOut > 0n, 'leg B output zero');

  if (reasons.length > 0) {
    return { go: false, reasons, fingerprint: sha256(stable(inp)) };
  }

  // Flash loan fee
  const flashFee = (amtQuote * big(flashFeeBps)) / 10000n;
  const totalRepay = amtQuote + flashFee;

  // Gross profit before fees/tips
  const grossProfit = quoteOut - totalRepay;

  // Lamports to quote conversion
  const lamportsToQuote = (lamports) => {
    const l = big(lamports);
    const spq = big(solPriceQuote || 100n);
    return (l * spq) / 1000000000n;
  };

  const baseFeeQuote = lamportsToQuote(baseFeeLamports);
  const priorityFeeQuote = lamportsToQuote(priorityFeeLamports);

  const preTip = grossProfit - flashFee - baseFeeQuote - priorityFeeQuote;

  // Tip calculation
  const tipConfig = tip || {};
  const floorConfig = floor || {};
  const shareBps = big(tipConfig.shareBps != null ? tipConfig.shareBps : 5000n);
  const capLamports = big(tipConfig.capLamports != null ? tipConfig.capLamports : 1000000n);
  const minLamports = big(tipConfig.minLamports != null ? tipConfig.minLamports : 1000n);
  const p50Lamports = big(floorConfig.p50Lamports != null ? floorConfig.p50Lamports : 5000n);

  const quoteToLamports = (quote) => {
    const q = big(quote);
    const spq = big(solPriceQuote || 100n);
    if (spq === 0n) return 0n;
    return (q * 1000000000n) / spq;
  };

  const byShare = preTip > 0n ? quoteToLamports((preTip * shareBps) / 10000n) : 0n;
  const tipLamports = [minLamports, p50Lamports, byShare].reduce((m, x) => (x > m ? x : m));

  need(tipLamports <= capLamports, `required tip ${tipLamports} lamports exceeds the cap ${capLamports}`);

  const tipQuote = lamportsToQuote(tipLamports);
  const net = preTip - tipQuote;

  need(net >= big(minNetQuote), `net profit ${net} below minNetQuote ${minNetQuote}`);

  const marginBps = amtQuote > 0n ? (net * 10000n) / amtQuote : 0n;
  need(marginBps >= big(minMarginBps || 0n), `margin BPS ${marginBps} below minMarginBps ${minMarginBps}`);

  const costsQuote = flashFee + baseFeeQuote + priorityFeeQuote + tipQuote;
  const onchainAssertMinQuote = amtQuote + costsQuote + big(minNetQuote);

  const decisionObj = {
    go: reasons.length === 0,
    reasons,
    amountInQuote: amtQuote.toString(),
    quoteOut: quoteOut.toString(),
    grossProfit: grossProfit.toString(),
    net: net.toString(),
    marginBps: marginBps.toString(),
    tipLamports: tipLamports.toString(),
    onchainAssertMinQuote: onchainAssertMinQuote.toString()
  };

  decisionObj.fingerprint = sha256(stable(decisionObj));
  return decisionObj;
}

function confirmWithSimulation({ decision, simOk, simulatedQuoteDelta }) {
  if (!decision || !decision.go) return { go: false, reason: 'decision was no-go' };
  if (!simOk) return { go: false, reason: 'simulation failed' };
  const delta = big(simulatedQuoteDelta || 0n);
  const minAssert = big(decision.onchainAssertMinQuote || 0n);
  if (delta < minAssert) {
    return { go: false, reason: `simulated quote delta ${delta} less than onchainAssertMinQuote ${minAssert}` };
  }
  return { go: true, reason: 'simulation and profit assertion confirmed' };
}

function paperVerdict({ infraCostPerDayQuote, paperStats }) {
  const cost = big(infraCostPerDayQuote || 0n);
  const stats = paperStats || {};
  const totalProfit = big(stats.totalNetQuote || 0n);
  const days = stats.daysRun ? Number(stats.daysRun) : 1;
  const dailyProfit = days > 0 ? totalProfit / BigInt(days) : 0n;
  const threshold = cost * 3n;

  const pass = dailyProfit >= threshold;
  return {
    pass,
    dailyProfit: dailyProfit.toString(),
    requiredThreshold: threshold.toString(),
    reason: pass ? 'clears 3x daily infra cost' : 'fails to clear 3x daily infra cost, do not go live'
  };
}

module.exports = {
  cpmmOut,
  decideArb,
  confirmWithSimulation,
  paperVerdict,
  sha256,
  stable
};
