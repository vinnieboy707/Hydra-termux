'use strict';
// Exercises lib/chain.cjs (the real ethers code the scanner uses on mainnet) against mock contracts on a local chain,
// then feeds those REAL ethers quotes through runScan end to end. Proves the wiring; says nothing about mainnet prices.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const ganache = require('ganache');
const { ethers } = require('ethers');
const C = require('../lib/chain.cjs');
const { runScan } = require('../lib/scan.cjs');

function compile() {
  const src = fs.readFileSync(path.join(__dirname, 'mocks', 'ChainMocks.sol'), 'utf8');
  const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'M.sol': { content: src } }, settings: { evmVersion: 'paris', optimizer: { enabled: false }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
  const errs = (out.errors || []).filter((e) => e.severity === 'error'); if (errs.length) throw new Error(errs[0].formattedMessage);
  return out.contracts['M.sol'];
}

test('chain.cjs against local mocks: Aave reads, venue validation, pool discovery, quotes, full scan', async () => {
  const eth = ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 4 } });
  const bp = new ethers.BrowserProvider(eth); const signer = await bp.getSigner(0);
  const art = compile();
  const dep = async (n, ...a) => { const f = new ethers.ContractFactory(art[n].abi, '0x' + art[n].evm.bytecode.object, signer); const c = await f.deploy(...a); await c.waitForDeployment(); return c; };
  const addr = (c) => c.getAddress();

  const usdc = await dep('MockERC20', 'USDC', 6), weth = await dep('MockERC20', 'WETH', 18);
  const aav = await dep('MockAave'), oracle = await dep('MockOracle'), ap = await dep('MockAP', await addr(oracle));
  await aav.setProvider(await addr(ap));
  const FLASH = (1n << 56n) | (1n << 63n);
  const aTokU = ethers.Wallet.createRandom().address, aTokW = ethers.Wallet.createRandom().address;
  await usdc.mint(aTokU, 5_000_000n * 10n ** 6n); await weth.mint(aTokW, 1000n * 10n ** 18n);
  await aav.add(await addr(usdc), FLASH, aTokU); await aav.add(await addr(weth), FLASH, aTokW);
  await oracle.set(await addr(usdc), 100000000n); await oracle.set(await addr(weth), 200000000000n);

  // venues: one V3 (uniswap-like), one V2-style
  const v3f = await dep('MockV3Factory'), v3q = await dep('MockQuoter', await addr(v3f)), v2f = await dep('MockV2Factory'), v2r = await dep('MockV2Router', await addr(v2f));
  const pool500 = await dep('MockV3Pool', 10n ** 18n), pair = await dep('MockV3Pool', 1n);
  const U = await addr(usdc), W = await addr(weth);
  await v3f.setPool(U, W, 500, await addr(pool500));
  await v2f.setPair(U, W, await addr(pair));
  // USDC->WETH on V3: 1000 USDC (1e9 units) -> 0.5 WETH (5e17 wei)
  await v3q.setRate(U, W, 500, 5n * 10n ** 26n);          // 1e9 * 5e26 / 1e18 = 5e17 = 0.5 WETH
  await v3q.setRate(W, U, 500, 1990n * 10n ** 6n);          // WETH->USDC at 1990 (out = in*r/1e18)
  // V2 side sells WETH at 2010 (higher): the spread is buy-on-V3 sell-on-V2
  await v2r.setRate(W, U, 2010n * 10n ** 6n);              // 0.5e18 * 2010e6 / 1e18 = 1005e6 = 1005 USDC
  await v2r.setRate(U, W, 5n * 10n ** 26n);

  const provider = await C.connect({ rpcUrl: 'unused' }).catch(() => null);
  assert.strictEqual(provider, null, 'connect() needs a real url; expected to fail on a fake one');
  const lim = C.limiter(4);

  const aave = await C.readAave(bp, lim, await addr(aav));
  assert.strictEqual(aave.premiumBps, 5);
  const au = aave.assets.find((a) => a.symbol === 'USDC'), aw = aave.assets.find((a) => a.symbol === 'WETH');
  assert.ok(au.flashEnabled && aw.flashEnabled);
  assert.strictEqual(au.decimals, 6); assert.strictEqual(aw.decimals, 18);
  assert.strictEqual(au.price8, 100000000n); assert.strictEqual(aw.price8, 200000000000n);
  assert.strictEqual(au.available, 5_000_000n * 10n ** 6n);

  const venuesCfg = { venues: [
    { id: 'uni_like', kind: 'v3', executable: true, factory: await addr(v3f), quoter: await addr(v3q), router: null, fees: [100, 500, 3000, 10000] },
    { id: 'v2_like', kind: 'v2', executable: true, factory: await addr(v2f), router: await addr(v2r) },
    { id: 'wrong_quoter', kind: 'v3', executable: false, factory: await addr(await dep('MockV3Factory')), quoter: await addr(v3q), router: null, fees: [500] },
    { id: 'not_a_v3_factory', kind: 'v3', executable: false, factory: await addr(v2f), quoter: await addr(v3q), router: null, fees: [500] },
  ] };
  const { good, report } = await C.validateVenues(bp, venuesCfg, lim);
  assert.deepStrictEqual(good.map((v) => v.id), ['uni_like', 'v2_like']);
  assert.match(report.find((r) => r.id === 'wrong_quoter').why, /quoter\.factory\(\)/, 'valid V3 factory but its quoter belongs to another factory: switched off for that reason');
  assert.strictEqual(report.find((r) => r.id === 'not_a_v3_factory').ok, false);

  const tokens = [U.toLowerCase(), W.toLowerCase()];
  const markets = await C.discoverMarkets(bp, good, tokens, lim, null, 0);
  assert.strictEqual(markets.length, 2);
  assert.deepStrictEqual(markets.map((m) => m.kind).sort(), ['v2', 'v3']);

  await oracle.setUnit(10n ** 18n);
  const aavAddr = await addr(aav);
  await assert.rejects(() => C.readAave(bp, lim, aavAddr), /base unit is not 1e8/, 'an oracle with a different unit would corrupt all sizing: refuse');
  await oracle.setUnit(10n ** 8n);

  const counter = { n: 0, fail: 0 }; const quote = C.makeQuoter(bp, counter);
  const m3 = markets.find((m) => m.kind === 'v3'), m2 = markets.find((m) => m.kind === 'v2');
  assert.strictEqual(await quote(m3, U, W, 1000n * 10n ** 6n), 5n * 10n ** 17n);
  assert.strictEqual(await quote(m2, W, U, 5n * 10n ** 17n), 1005n * 10n ** 6n);
  assert.strictEqual(await quote(m3, U, U, 1n), null, 'a quote that reverts is null, never a number');
  assert.strictEqual(counter.fail, 1);

  // end to end: real ethers quotes -> scan. Spread 1005 - 1000 = 5 USDC on 1000, minus 0.5 premium, minus gas
  const cfg = { MIN_NET_PROFIT_USD: 0.35, MAX_SLIPPAGE_BPS: 35, GAS_CEILING_GWEI: 0.05, GAS_UNITS_ASSUMED: 900000, SCREEN_SIZE_USD: 1000, SCAN_TOPK: 10, OPT_REFINE_ITERS: 6, MIN_PROFIT_CAPTURE_BPS: 5000, SLIPPAGE_PROBE_USD: 10, DEADLINE_SECONDS: 120, SIZE_LADDER_USD: [500, 1000, 2000] };
  const res = await runScan(cfg, { assets: aave.assets, ethUsd: 2000, gasPriceWei: 20000000n, premiumBps: aave.premiumBps, markets, quote, blockNumber: 1, nowSec: 1700000000 });
  const top = res.candidates.find((c) => c.borrowSymbol === 'USDC');
  assert.ok(top, 'USDC route evaluated'); assert.ok(top.approved, JSON.stringify(top.reasons));
  assert.strictEqual(top.buyOn.split(':')[0], 'uni_like'); assert.strictEqual(top.sellOn.split(':')[0], 'v2_like');
  assert.ok(Math.abs(top.grossUsd - top.amountUsd * 0.005) < 0.01, 'gross is 0.5% of size: 1005 vs 1000 (linear mocks)');
  assert.ok(top.runParams && top.runParams.legs.length === 2, 'approved route carries contract run params');
});
