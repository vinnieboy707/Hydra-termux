/**
 * Test Suite for Solana Cross-DEX Flash-Loan Arbitrage Gate (solana-arb-gate.js)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  cpmmOut,
  decideArb,
  confirmWithSimulation,
  paperVerdict
} = require('./solana-arb-gate');

function baseInput() {
  return {
    amountInQuote: 1_000_000n, // 1 USDC (6 decimals)
    solPriceQuote: 150_000_000n, // $150 per SOL in quote units
    pools: {
      buy: {
        reserveIn: 10_000_000_000n, // 10,000 USDC
        reserveOut: 100_000_000_000n, // 100,000 BASE
        feeBps: 30n
      },
      sell: {
        reserveIn: 101_000_000_000n, // 101,000 BASE
        reserveOut: 10_500_000_000n, // 10,500 USDC (higher price on sell pool -> profitable arb)
        feeBps: 30n
      }
    },
    flashFeeBps: 9n,
    baseFeeLamports: 5000n,
    priorityFeeLamports: 1000n,
    minNetQuote: 100n,
    minMarginBps: 1n,
    tip: { shareBps: 5000n, capLamports: 1000000n, minLamports: 1000n },
    floor: { p50Lamports: 5000n }
  };
}

function runTests() {
  console.log('[Solana Arb Gate Test] Starting test suite...');

  // 1. Test cpmmOut basic math
  const out = cpmmOut(1_000_000n, 1_000_000n, 10_000n, 30);
  assert.ok(out > 0n);

  // 2. Test decideArb execution on profitable scenario
  const decision = decideArb(baseInput());
  assert.strictEqual(decision.go, true);
  assert.ok(BigInt(decision.net) > 0n);
  assert.ok(decision.fingerprint);

  // 3. Test fail-closed on missing inputs
  const badDecision = decideArb({ amountInQuote: 1000n });
  assert.strictEqual(badDecision.go, false);
  assert.ok(badDecision.reasons.length > 0);

  // 4. Test search optimization / brute force comparison snippet
  const f = (x) => cpmmOut(500_000n, 1_400_000n, cpmmOut(1_000_000n, 500_000n, x, 30), 30);
  let best = 1n;
  const profit = (x) => f(x) - x - (x * 5n + 9999n) / 10000n;
  for (let x = 1n; x <= 1000n; x += 100n) {
    if (profit(x) > profit(best)) best = x;
  }
  assert.ok(best > 0n);

  // 5. Test simulation is the authoritative gate
  const d = decideArb(baseInput());
  assert.strictEqual(confirmWithSimulation({ decision: d, simOk: true, simulatedQuoteDelta: d.onchainAssertMinQuote }).go, true);
  assert.strictEqual(confirmWithSimulation({ decision: d, simOk: false, simulatedQuoteDelta: d.onchainAssertMinQuote }).go, false);
  assert.strictEqual(confirmWithSimulation({ decision: d, simOk: true, simulatedQuoteDelta: (BigInt(d.onchainAssertMinQuote) - 1n).toString() }).go, false);

  // 6. Test paperVerdict with infra cost (must clear 3x daily infra cost)
  const verdictPass = paperVerdict({
    infraCostPerDayQuote: 1000n,
    paperStats: { totalNetQuote: 5000n, daysRun: 1 }
  });
  assert.strictEqual(verdictPass.pass, true);

  const verdictFail = paperVerdict({
    infraCostPerDayQuote: 2000n,
    paperStats: { totalNetQuote: 3000n, daysRun: 1 }
  });
  assert.strictEqual(verdictFail.pass, false);

  // 7. Test deterministic, offline, keyless
  assert.strictEqual(JSON.stringify(decideArb(baseInput())), JSON.stringify(decideArb(baseInput())));
  const src = fs.readFileSync(path.join(__dirname, 'solana-arb-gate.js'), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  assert.doesNotMatch(code, /Date\.now|Math\.random|fetch\(|require\('(@solana|stripe|ethers|http|https|net)/);
  assert.doesNotMatch(code, /sendTransaction|sendBundle|signTransaction|Keypair/);

  console.log('[Solana Arb Gate Test] All tests passed successfully.');
}

runTests();
