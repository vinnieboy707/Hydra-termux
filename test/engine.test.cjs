'use strict';
// Engine math and decisions: flash premium, sizing, guardrails, run parameters, and the synthetic-pool scan pipeline.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const E = require('../lib/engine.cjs');
const { runScan } = require('../lib/scan.cjs');
const { loadConfig } = require('../lib/config.cjs');
const { ABI } = require('../lib/chain.cjs');

// ---- synthetic constant-product pools (test data only; production uses real quotes) ----
const cp = (amtIn, rIn, rOut, feeBps) => { const x = amtIn * BigInt(10000 - feeBps); return (x * rOut) / (rIn * 10000n + x); };
const USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831', WETH = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1';
const P8 = { [USDC]: 100000000n, [WETH]: 200000000000n }; // $1 and $2000
const asset = (address, symbol, decimals, price8) => ({ address, symbol, decimals, flashEnabled: true, price8, available: null, notes: [] });
const U = (n) => BigInt(Math.round(n * 1e6)), E18 = (n) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;

function world({ poolA, poolB, gasPriceWei = 20000000n, premiumBps = 5, flags = {} }) {
  // poolX = {usdc: reserve (6dp), weth: reserve (18dp), feeBps}
  const mk = (id, p, exec) => ({ id, venueId: id, kind: 'v3', fee: p.feeBps * 100, pair: [USDC, WETH].sort(), address: id, executable: exec, router: '0x' + '11'.repeat(20), p });
  const markets = [mk('A', poolA, flags.execA ?? true), mk('B', poolB, flags.execB ?? true)];
  const quote = async (m, tin, tout, amt) => {
    const inIsUsdc = tin === USDC;
    const rIn = inIsUsdc ? m.p.usdc : m.p.weth, rOut = inIsUsdc ? m.p.weth : m.p.usdc;
    const out = cp(amt, rIn, rOut, m.p.feeBps);
    return out > 0n ? out : null;
  };
  return { assets: [asset(USDC, 'USDC', 6, P8[USDC]), asset(WETH, 'WETH', 18, P8[WETH])], ethUsd: 2000, gasPriceWei, premiumBps, markets, quote, blockNumber: 1, nowSec: 1700000000 };
}
const CFG = { MIN_NET_PROFIT_USD: 0.35, MAX_SLIPPAGE_BPS: 35, GAS_CEILING_GWEI: 0.05, GAS_UNITS_ASSUMED: 900000, SCREEN_SIZE_USD: 1000, SCAN_TOPK: 10, OPT_REFINE_ITERS: 24, MIN_PROFIT_CAPTURE_BPS: 5000, SLIPPAGE_PROBE_USD: 10, DEADLINE_SECONDS: 120, SIZE_LADDER_USD: [200, 500, 1000, 2500, 5000, 10000, 25000, 50000] };

test('flash premium rounds up like the pool; usd<->asset conversions invert', () => {
  assert.strictEqual(E.flashPremium(1000000000n, 5), 500000n);
  assert.strictEqual(E.flashPremium(999n, 5), 1n);
  assert.strictEqual(E.usdToAsset(1000, 100000000n, 6), 1000000000n);
  assert.strictEqual(E.usdToAsset(2000, 200000000000n, 18), 10n ** 18n);
  assert.strictEqual(E.assetToUsd(10n ** 18n, 200000000000n, 18), 2000);
});

test('impact: same price as probe = 0 bps; 1% worse = 100 bps', () => {
  assert.strictEqual(E.impactBps({ amountIn: 1000n, amountOut: 500n, probeIn: 10n, probeOut: 5n }), 0);
  assert.strictEqual(E.impactBps({ amountIn: 1000n, amountOut: 495n, probeIn: 10n, probeOut: 5n }), 100);
});

test('optimizer finds the true best size on two constant-product pools (vs brute force)', async () => {
  // Pool A cheap WETH (1900), pool B dear WETH (2100), 30 bps fees, deep pools.
  const A = { usdc: U(19_000_000), weth: E18(10_000), feeBps: 30 }, B = { usdc: U(21_000_000), weth: E18(10_000), feeBps: 30 };
  const evalFn = (amt) => E.evaluateRoundTrip({ amount: amt, premiumBps: 5, gasCostAsset: U(0.1),
    quoteBuy: async (a) => cp(a, A.usdc, A.weth, 30), quoteSell: async (a) => cp(a, B.weth, B.usdc, 30) });
  const ladder = [200, 500, 1000, 2500, 5000, 10000, 25000, 50000].map((u) => U(u));
  const found = await E.optimizeSize(evalFn, ladder, 40);
  let bruteBest = null;
  for (let u = 200; u <= 50000; u += 50) { const r = await evalFn(U(u)); if (r && (!bruteBest || r.net > bruteBest.net)) bruteBest = r; }
  assert.ok(found.net > 0n, 'there is a real spread here');
  assert.ok(found.net * 1000n >= bruteBest.net * 999n, `optimizer ${found.net} within 0.1% of brute force ${bruteBest.net}`);
});

test('no spread -> never profitable (fees + premium + gas always lose)', async () => {
  const P = { usdc: U(20_000_000), weth: E18(10_000), feeBps: 5 };
  const d = world({ poolA: P, poolB: P });
  const res = await runScan(CFG, d);
  assert.strictEqual(res.approved, 0);
  assert.ok(res.candidates.every((c) => c.netUsd < 0));
});

test('a real spread is found, sized, approved, and matches an independent calculation', async () => {
  const A = { usdc: U(19_000_000), weth: E18(10_000), feeBps: 5 }, B = { usdc: U(20_000_000), weth: E18(10_000), feeBps: 5 };
  const d = world({ poolA: A, poolB: B });
  const res = await runScan(CFG, d);
  assert.strictEqual(res.status, 'SCANNED');
  assert.ok(res.candidates.length >= 2, 'both borrow directions are evaluated');
  assert.ok(res.candidates[0].approved, JSON.stringify(res.candidates[0].reasons));
  const top = res.candidates.find((c) => c.borrowSymbol === 'USDC');
  assert.ok(top.approved, JSON.stringify(top.reasons));
  assert.strictEqual(top.buyOn, 'A'); assert.strictEqual(top.sellOn, 'B');
  // independent recomputation from the recorded amounts
  const amt = BigInt(top.quote.amount);
  const o1 = cp(amt, A.usdc, A.weth, 5), o2 = cp(o1, B.weth, B.usdc, 5);
  assert.strictEqual(BigInt(top.quote.out1), o1); assert.strictEqual(BigInt(top.quote.out2), o2);
  assert.strictEqual(BigInt(top.quote.contractProfit), o2 - amt - E.flashPremium(amt, 5));
  assert.ok(top.netUsd >= CFG.MIN_NET_PROFIT_USD);
  assert.ok(top.impact1 <= 35 && top.impact2 <= 35);
  assert.ok(top.amountUsd >= 200 && top.amountUsd <= 50000 + 1, 'size stays inside the ladder limits');
});

test('guardrails: gas gate, non-executable venue, profit floor and impact cap each block approval', async () => {
  const A = { usdc: U(19_000_000), weth: E18(10_000), feeBps: 5 }, B = { usdc: U(20_000_000), weth: E18(10_000), feeBps: 5 };
  const gas = await runScan(CFG, world({ poolA: A, poolB: B, gasPriceWei: 100000000n })); // 0.1 gwei > 0.05 ceiling
  assert.strictEqual(gas.status, 'STANDBY_GAS_WAIT'); assert.strictEqual(gas.approved, 0);
  assert.ok(gas.candidates[0].reasons.some((r) => r.startsWith('STANDBY_GAS_WAIT')));
  const ne = await runScan(CFG, world({ poolA: A, poolB: B, flags: { execB: false } }));
  assert.strictEqual(ne.approved, 0); assert.ok(ne.candidates[0].reasons.some((r) => r.startsWith('NOT_EXECUTABLE')));
  const hi = await runScan({ ...CFG, MIN_NET_PROFIT_USD: 1e9 }, world({ poolA: A, poolB: B }));
  assert.strictEqual(hi.approved, 0); assert.ok(hi.candidates[0].reasons.some((r) => /below floor/.test(r)));
  const thin = { usdc: U(190_000), weth: E18(100), feeBps: 5 }, thin2 = { usdc: U(200_000), weth: E18(100), feeBps: 5 };
  const imp = await runScan({ ...CFG, MAX_SLIPPAGE_BPS: 1 }, world({ poolA: thin, poolB: thin2 }));
  assert.strictEqual(imp.approved, 0); assert.ok(imp.candidates[0].reasons.some((r) => /impact/.test(r)));
});

test('failed quotes never turn into profit', async () => {
  const A = { usdc: U(19_000_000), weth: E18(10_000), feeBps: 5 }, B = { usdc: U(20_000_000), weth: E18(10_000), feeBps: 5 };
  const d = world({ poolA: A, poolB: B }); d.quote = async () => null;
  const res = await runScan(CFG, d);
  assert.strictEqual(res.candidates.length, 0); assert.strictEqual(res.approved, 0);
});

test('run params encode against the Drive contract ABI and respect its rules', async () => {
  const A = { usdc: U(19_000_000), weth: E18(10_000), feeBps: 5 }, B = { usdc: U(20_000_000), weth: E18(10_000), feeBps: 5 };
  const res = await runScan(CFG, world({ poolA: A, poolB: B }));
  const rp = res.candidates[0].runParams;
  assert.ok(rp, 'top candidate approved');
  const artifact = path.join(__dirname, '..', 'contract_abi.json');
  const abi = JSON.parse(fs.readFileSync(artifact, 'utf8'));
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData('execute', [rp.asset, rp.amount, rp.minProfit, rp.deadline, rp.legs]);
  assert.ok(data.startsWith(iface.getFunction('execute').selector));
  assert.ok(BigInt(rp.minProfit) > 0n);                                        // contract rejects 0
  assert.strictEqual(rp.legs.length, 2);
  assert.strictEqual(rp.legs[rp.legs.length - 1].tokenOut, rp.asset);          // must end in the borrowed asset
  const top = res.candidates[0].quote;
  assert.ok(BigInt(rp.minProfit) <= BigInt(top.contractProfit));               // never asks for more than the quote shows
  assert.ok(BigInt(rp.legs[1].minOut) >= BigInt(rp.amount) + BigInt(top.premium) + BigInt(rp.minProfit));
  assert.ok(rp.deadline === 1700000000 + CFG.DEADLINE_SECONDS);
});

test('Uniswap QuoterV2 selector matches the one already used in your own scripts (0xc6a5026a)', () => {
  const i = new ethers.Interface(ABI.quoterV2);
  assert.strictEqual(i.getFunction('quoteExactInputSingle').selector, '0xc6a5026a');
});

test('config fails closed on missing or non-numeric values and lists them', () => {
  const c = loadConfig('/nonexistent/.env', { ARB_RPC_URL: 'http://x', MIN_NET_PROFIT_USD: 'abc' });
  assert.ok(c.problems.some((p) => p.startsWith('MIN_NET_PROFIT_USD')));
  assert.ok(c.problems.some((p) => p.startsWith('GAS_UNITS_ASSUMED')));
  assert.ok(c.problems.some((p) => p.startsWith('SIZE_LADDER_USD')));
});

test('price-impact cap is enforced on EACH leg separately', async () => {
  const deep = { usdc: U(190_000_000), weth: E18(100_000), feeBps: 5 }, deep2 = { usdc: U(200_000_000), weth: E18(100_000), feeBps: 5 };
  const thinBuy = { usdc: U(1_900_000), weth: E18(1_000), feeBps: 5 }, thinSell = { usdc: U(2_000_000), weth: E18(1_000), feeBps: 5 };
  const cfg = { ...CFG, MAX_SLIPPAGE_BPS: 8, SIZE_LADDER_USD: [20000] };
  const buyThin = (await runScan(cfg, world({ poolA: thinBuy, poolB: deep2 }))).candidates.find((c) => c.borrowSymbol === 'USDC');
  assert.ok(buyThin.impact1 > 8 && buyThin.impact2 <= 8, `leg 1 alone is over the cap (${buyThin.impact1}/${buyThin.impact2})`);
  assert.ok(!buyThin.approved && buyThin.reasons.some((r) => r.startsWith('leg 1 impact')));
  const sellThin = (await runScan(cfg, world({ poolA: deep, poolB: thinSell }))).candidates.find((c) => c.borrowSymbol === 'USDC');
  assert.ok(sellThin.impact2 > 8 && sellThin.impact1 <= 8, `leg 2 alone is over the cap (${sellThin.impact1}/${sellThin.impact2})`);
  assert.ok(!sellThin.approved && sellThin.reasons.some((r) => r.startsWith('leg 2 impact')));
});

test('gas is subtracted from profit: a spread smaller than gas is a loss, not a win', async () => {
  const A = { usdc: U(19_800_000), weth: E18(10_000), feeBps: 5 }, B = { usdc: U(20_000_000), weth: E18(10_000), feeBps: 5 };
  const cfg = { ...CFG, GAS_CEILING_GWEI: 100, SIZE_LADDER_USD: [1000] };
  const cheap = (await runScan(cfg, world({ poolA: A, poolB: B, gasPriceWei: 1000000n }))).candidates.find((c) => c.borrowSymbol === 'USDC');
  const dear = (await runScan(cfg, world({ poolA: A, poolB: B, gasPriceWei: 1000000000n }))).candidates.find((c) => c.borrowSymbol === 'USDC');
  const expectedGasUsd = 1e9 * 900000 / 1e18 * 2000; // 1 gwei * 900k units * $2000
  assert.ok(Math.abs(dear.gasUsdAssumed - expectedGasUsd) < 1e-6);
  assert.ok(Math.abs((cheap.netUsd - dear.netUsd) - (dear.gasUsdAssumed - cheap.gasUsdAssumed)) < 1e-4, 'net moves one-for-one with gas');
  assert.ok(dear.netUsd < cheap.netUsd && dear.netUsd < dear.grossUsd - dear.premiumUsd);
});

test('assets that are not flash-loanable are never used as the borrow side', async () => {
  const A = { usdc: U(19_000_000), weth: E18(10_000), feeBps: 5 }, B = { usdc: U(20_000_000), weth: E18(10_000), feeBps: 5 };
  const w = world({ poolA: A, poolB: B });
  w.assets.find((a) => a.symbol === 'WETH').flashEnabled = false;
  const only = await runScan(CFG, w);
  assert.ok(only.candidates.length > 0 && only.candidates.every((c) => c.borrowSymbol === 'USDC'));
  w.assets.forEach((a) => { a.flashEnabled = false; });
  assert.strictEqual((await runScan(CFG, w)).candidates.length, 0);
});

test('buildRunParams: minProfit never exceeds the quote and leg 2 must return principal + premium + minProfit', () => {
  const route = { buy: { kind: 'v3', router: '0xaa', fee: 500 }, sell: { kind: 'v2', router: '0xbb', fee: 0 } };
  const amount = U(1000), premium = U(0.5);
  // quote shows only $0.20 of contract profit while the floor is $0.35: params must not demand more than the quote shows
  let cand = { out1: E18(0.5), out2: amount + premium + U(0.2), premium, contractProfit: U(0.2) };
  let rp = E.buildRunParams({ asset: '0xusdc', tokenB: '0xweth', amount, cand, route, cfg: CFG, assetPrice8: 100000000n, decimals: 6, nowSec: 1 });
  assert.strictEqual(BigInt(rp.minProfit), U(0.2));
  // $5 of profit with 35 bps slippage allowance: out2*(1-slip) is below principal+premium+minProfit, so the floor must lift minOut
  cand = { out1: E18(0.5), out2: amount + premium + U(5), premium, contractProfit: U(5) };
  rp = E.buildRunParams({ asset: '0xusdc', tokenB: '0xweth', amount, cand, route, cfg: CFG, assetPrice8: 100000000n, decimals: 6, nowSec: 1 });
  const need = amount + premium + BigInt(rp.minProfit);
  assert.ok((cand.out2 * 9965n) / 10000n < need, 'precondition: plain slippage floor would be too low');
  assert.strictEqual(BigInt(rp.legs[1].minOut), need);
  assert.deepStrictEqual([rp.legs[0].dex, rp.legs[1].dex], [0, 1]); // UniV3 = 0, UniV2 = 1
});
