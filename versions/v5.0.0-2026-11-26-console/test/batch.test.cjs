'use strict';
// Batching + block pinning against a local chain. Proves: one scan = one block, batched requests return exactly what
// single calls return, reverts are failures (never numbers), and a broken batch falls back at the same block.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const ganache = require('ganache');
const { ethers } = require('ethers');
const { Batcher } = require('../lib/batch.cjs');
const C = require('../lib/chain.cjs');

function compile() {
  const src = fs.readFileSync(path.join(__dirname, 'mocks', 'ChainMocks.sol'), 'utf8');
  const out = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'M.sol': { content: src } }, settings: { evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
  const errs = (out.errors || []).filter((e) => e.severity === 'error'); if (errs.length) throw new Error(errs[0].formattedMessage);
  return out.contracts['M.sol'];
}

test('batched quotes: one block per scan, identical to single calls, reverts are failures, safe fallback', async () => {
  const eth = ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 2 } });
  const bp = new ethers.BrowserProvider(eth); const signer = await bp.getSigner(0);
  const art = compile();
  const dep = async (n, ...a) => { const c = await new ethers.ContractFactory(art[n].abi, '0x' + art[n].evm.bytecode.object, signer).deploy(...a); await c.waitForDeployment(); return c; };
  const A = (c) => c.getAddress();
  const usdc = await dep('MockERC20', 'USDC', 6), weth = await dep('MockERC20', 'WETH', 18);
  const f = await dep('MockV3Factory'), q = await dep('MockQuoter', await A(f)), mc = await dep('MockMulticall3'), broken = await dep('BrokenMulticall');
  const U = await A(usdc), W = await A(weth);
  await (await q.setRate(U, W, 500, 5n * 10n ** 26n)).wait();             // 1000 USDC -> 0.5 WETH
  const market = { id: 'uni:500', kind: 'v3', fee: 500, quoter: await A(q) };
  // read the block fresh (ethers caches getBlockNumber briefly; the scanner itself uses getBlock('latest'))
  const block = (await bp.getBlock('latest')).number;

  // the market moves in the next block
  await (await q.setRate(U, W, 500, 4n * 10n ** 26n)).wait();             // 1000 USDC -> 0.4 WETH
  const amounts = Array.from({ length: 25 }, (_, i) => BigInt(i + 1) * 10n ** 9n);

  // pinned to the earlier block, through Multicall3
  const stats = { batches: 0, calls: 0, fallbacks: 0, rpc: 0 };
  const pinned = new Batcher(bp, { blockTag: block, address: await A(mc), stats, size: 40 });
  const counter = { n: 0, fail: 0 };
  const quote = C.makeQuoter(bp, counter, pinned);
  const outs = await Promise.all(amounts.map((a) => quote(market, U, W, a)));
  outs.forEach((o, i) => assert.strictEqual(o, (amounts[i] * 5n * 10n ** 26n) / 10n ** 18n, 'every quote is from the pinned block (old price)'));
  assert.ok(stats.rpc <= 2, `25 quotes cost ${stats.rpc} request(s)`);
  assert.strictEqual(stats.fallbacks, 0);

  // identical quote asked twice in a scan is asked once
  const again = await quote(market, U, W, amounts[0]);
  assert.strictEqual(again, outs[0]); assert.ok(counter.cached >= 1); assert.strictEqual(counter.n, 25);

  // latest block sees the new price
  const latest = C.makeQuoter(bp, { n: 0, fail: 0 }, new Batcher(bp, { blockTag: 'latest', address: await A(mc) }));
  assert.strictEqual(await latest(market, U, W, 10n ** 9n), 4n * 10n ** 17n);

  // a reverting quote is a failure, never a number (no rate set for WETH->USDC)
  const c2 = { n: 0, fail: 0 };
  assert.strictEqual(await C.makeQuoter(bp, c2, pinned)(market, W, U, 10n ** 18n), null);
  assert.strictEqual(c2.fail, 1);
  // a long revert message must not be decoded as if it were a quote
  assert.strictEqual(await C.makeQuoter(bp, { n: 0, fail: 0 }, pinned)(market, U, W, 7n), null, 'revert bytes are never read as a number');
  assert.strictEqual(await C.makeQuoter(bp, { n: 0, fail: 0 }, pinned)(market, U, W, 8n), null, 'even when the revert bytes are shaped like a quote');
  // a quoter address with no code answers "success" with empty data: that is not a quote either
  const ghost = { ...market, id: 'ghost', quoter: ethers.Wallet.createRandom().address };
  assert.strictEqual(await C.makeQuoter(bp, { n: 0, fail: 0 }, pinned)(ghost, U, W, 10n ** 9n), null, 'empty answers are failures');

  // whole batch fails (broken multicall): each call is retried alone, still at the pinned block
  const s3 = { batches: 0, calls: 0, fallbacks: 0, rpc: 0 };
  const fb = C.makeQuoter(bp, { n: 0, fail: 0 }, new Batcher(bp, { blockTag: block, address: await A(broken), stats: s3 }));
  const fo = await Promise.all(amounts.slice(0, 5).map((a) => fb(market, U, W, a)));
  assert.ok(s3.fallbacks >= 1);
  fo.forEach((o, i) => assert.strictEqual(o, outs[i]));

  // no multicall at all: same answers, one request per call
  const s4 = { batches: 0, calls: 0, fallbacks: 0, rpc: 0 };
  const plain = C.makeQuoter(bp, { n: 0, fail: 0 }, new Batcher(bp, { blockTag: block, multicall: false, stats: s4 }));
  assert.strictEqual(await plain(market, U, W, amounts[3]), outs[3]);
  assert.strictEqual(s4.batches, 0);
});

test('batched pool discovery finds the same pools as before and skips empty ones', async () => {
  const eth = ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 2 } });
  const bp = new ethers.BrowserProvider(eth); const signer = await bp.getSigner(0);
  const art = compile();
  const dep = async (n, ...a) => { const c = await new ethers.ContractFactory(art[n].abi, '0x' + art[n].evm.bytecode.object, signer).deploy(...a); await c.waitForDeployment(); return c; };
  const A = (c) => c.getAddress();
  const t = [await dep('MockERC20', 'A', 18), await dep('MockERC20', 'B', 18), await dep('MockERC20', 'C', 18)];
  const T = await Promise.all(t.map(A));
  const f = await dep('MockV3Factory'), q = await dep('MockQuoter', await A(f)), mc = await dep('MockMulticall3');
  const live = await dep('MockV3Pool', 10n ** 18n), empty = await dep('MockV3Pool', 0n);
  await (await f.setPool(T[0], T[1], 500, await A(live))).wait();
  await (await f.setPool(T[1], T[2], 3000, await A(empty))).wait();
  const venues = [{ id: 'uni', kind: 'v3', executable: true, factory: await A(f), quoter: await A(q), router: null, fees: [100, 500, 3000, 10000] }];
  const stats = { batches: 0, calls: 0, fallbacks: 0, rpc: 0 };
  const m = await C.discoverMarkets(bp, venues, T.map((x) => x.toLowerCase()), null, null, 0, new Batcher(bp, { address: await A(mc), stats }));
  assert.strictEqual(m.length, 1, 'the zero-liquidity pool is skipped');
  assert.strictEqual(m[0].fee, 500);
  assert.ok(stats.rpc <= 3, `12 lookups + liquidity checks cost ${stats.rpc} requests`);
});
