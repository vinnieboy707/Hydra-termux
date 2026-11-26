'use strict';
// chronos research: the analysis of real flash-loan transactions, checked on a hand-built receipt whose numbers are
// known, and the live reader run against a local chain (no flash loans there: it must report none, not invent any).
const test = require('node:test');
const assert = require('node:assert');
const ganache = require('ganache');
const { ethers } = require('ethers');
const R = require('../lib/research.cjs');

const A = (n) => '0x' + n.repeat(40).slice(0, 40);
const topic = (a) => ethers.zeroPadValue(a, 32);
const USDC = A('a'), WETH = A('b'), C = A('c'), EOA = A('e'), AAVE = A('f'), POOL1 = A('1'), POOL2 = A('2'), POOL3 = A('3');
const transfer = (token, from, to, amt) => ({ address: token, topics: [R.T.transfer, topic(from), topic(to)], data: ethers.toBeHex(amt, 32) });
const swapV3 = (pool) => ({ address: pool, topics: [Object.keys(R.SWAPS)[0], topic(C), topic(C)], data: '0x' });

test('research: legs, venues (incl. ones you lack), gas and what was kept are read from the receipt', () => {
  const U = (n) => BigInt(Math.round(n * 1e6));
  const events = [{ source: 'aave_v3', tx: '0x01', block: 10, receiver: C, asset: USDC }];
  const logs = [
    transfer(USDC, AAVE, C, U(1000)), transfer(USDC, C, POOL1, U(1000)), transfer(WETH, POOL1, C, 5n * 10n ** 17n), swapV3(POOL1),
    transfer(WETH, C, POOL2, 5n * 10n ** 17n), transfer(USDC, POOL2, C, U(1010.5)), swapV3(POOL2), swapV3(POOL3),
    transfer(USDC, C, AAVE, U(1000.5)),
  ];
  const receipts = new Map([['0x01', { status: 1, gasUsed: 500000n, effectiveGasPrice: 10000000n, from: EOA, to: C, logs }]]);
  const factoryOf = new Map([[POOL1, A('9')], [POOL2, A('8')], [POOL3, A('7')]]);
  const venueOf = new Map([[A('9'), 'uniswap_v3'], [A('8'), 'pancake_v3']]);
  const price = (t) => (t === USDC ? { price8: 100000000n, decimals: 6 } : t === WETH ? { price8: 200000000000n, decimals: 18 } : null);
  const r = R.analyze({ events, receipts, factoryOf, venueOf, price, ethPrice8: 200000000000n });
  assert.strictEqual(r.transactions, 1); assert.strictEqual(r.succeeded, 1);
  assert.deepStrictEqual(r.legs, { 3: 1 });
  assert.ok(Math.abs(r.rows[0].keptUsd - 10) < 1e-9, 'borrowed 1000, repaid 1000.5, got 1010.5 back: kept $10');
  assert.ok(Math.abs(r.rows[0].gasUsd - 0.01) < 1e-9, '500k gas × 0.01 gwei × $2000');
  assert.strictEqual(r.profitableAfterGas, 1);
  assert.deepStrictEqual(r.venuesYouLack, [{ factory: A('7'), swaps: 1 }]);
  assert.strictEqual(r.topContracts[0].contract, C);
  // what every engine pools in your database (chain_trades): the row's sender, venues, borrowed token and gas price
  assert.deepStrictEqual([r.rows[0].sender, r.rows[0].venues, r.rows[0].assets, r.rows[0].gasPriceGwei], [EOA.toLowerCase(), ['uniswap_v3', 'pancake_v3', `unknown factory ${A('7')}`], [USDC], 0.01]);
  const row = require('../lib/sync.cjs').MAP.chainTrade({ ...r.rows[0], tx: '0x' + '1'.repeat(64) });
  assert.deepStrictEqual([row.lender, row.success, row.legs, row.gas_used, row.priced], ['aave_v3', true, 3, 500000, true]);
  assert.ok(Math.abs(row.net_usd - 9.99) < 1e-9, 'kept 10 − gas 0.01');
  assert.strictEqual(require('../lib/sync.cjs').MAP.chainTrade({ ...r.rows[0] }), null, 'a malformed hash is never sent');
  // a token Aave does not price is never valued: kept is reported as unknown, not guessed
  const r2 = R.analyze({ events, receipts, factoryOf, venueOf, price: (t) => (t === USDC ? { price8: 100000000n, decimals: 6 } : null), ethPrice8: 200000000000n });
  assert.ok(r2.rows[0].keptUsd !== null, 'only USDC changed hands net, so it is still fully priced');
  const logs3 = [...logs, transfer(A('d'), POOL2, C, 5n)];
  const r3 = R.analyze({ events, receipts: new Map([['0x01', { ...receipts.get('0x01'), logs: logs3 }]]), factoryOf, venueOf, price, ethPrice8: 200000000000n });
  assert.strictEqual(r3.rows[0].keptUsd, null);
});

test('research live reader: a chain with no flash loans reports none', async () => {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161 } }));
  const r = await R.run({ provider, aavePool: A('f'), balancerVault: A('b'), venues: [], assets: [], ethPrice8: 200000000000n, hours: 0.01 });
  assert.deepStrictEqual(r.flashLoans, {}); assert.strictEqual(r.transactions, 0); assert.strictEqual(r.profitableAfterGas, 0);
});

test('own-capital arbitrage (2.9.16): a cycle that ended with more and nothing less is kept; a plain two-pool trade is not', () => {
  const U = (n) => BigInt(Math.round(n * 1e6));
  // the bot's contract C spends its own 26.5 USDC through two pools and ends with 26.52: an arbitrage
  const arb = [transfer(USDC, C, POOL1, U(26.5)), transfer(WETH, POOL1, C, 10n ** 16n), swapV3(POOL1), transfer(WETH, C, POOL2, 10n ** 16n), transfer(USDC, POOL2, C, U(26.52)), swapV3(POOL2)];
  // a user swapping USDC → WETH through two pools: they end with less USDC and more WETH, which is a trade, not arbitrage
  const trade = [transfer(USDC, EOA, POOL1, U(100)), transfer(WETH, POOL1, POOL2, 10n ** 16n), swapV3(POOL1), transfer(WETH, POOL2, EOA, 2n * 10n ** 16n), swapV3(POOL2)];
  const events = [{ source: 'own capital', tx: '0xa1', block: 20, receiver: null }, { source: 'own capital', tx: '0xa2', block: 20, receiver: null }];
  const receipts = new Map([['0xa1', { status: 1, gasUsed: 400000n, effectiveGasPrice: 10000000n, from: EOA, to: C, logs: arb }], ['0xa2', { status: 1, gasUsed: 200000n, effectiveGasPrice: 10000000n, from: EOA, to: A('5'), logs: trade }]]);
  const price = (t) => (t === USDC ? { price8: 100000000n, decimals: 6 } : t === WETH ? { price8: 200000000000n, decimals: 18 } : null);
  const r = R.analyze({ events, receipts, factoryOf: new Map(), venueOf: new Map(), price, ethPrice8: 200000000000n });
  assert.strictEqual(r.transactions, 1, 'only the cycle is an arbitrage'); assert.strictEqual(r.rows[0].tx, '0xa1');
  assert.ok(Math.abs(r.rows[0].keptUsd - 0.02) < 1e-9); assert.strictEqual(r.rows[0].source, 'own capital'); assert.strictEqual(r.rows[0].receiver, C.toLowerCase());
  const row = require('../lib/sync.cjs').MAP.chainTrade({ ...r.rows[0], tx: '0x' + 'a'.repeat(64) });
  assert.strictEqual(row.lender, 'own capital', 'sent to chain_trades with its kind');
});

test('research no longer stops on a venue without a factory (Curve): the cause of the empty chain_trades table since 2.9.8', async () => {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161 } }));
  const venues = [{ id: 'uniswap_v3', factory: A('9') }, { id: 'curve_stable', kind: 'curve', pools: [{ address: A('6') }] }];
  const r = await R.run({ provider, aavePool: A('f'), balancerVault: A('b'), venues, assets: [], ethPrice8: 200000000000n, hours: 0.01, swapBlocks: 5 });
  assert.strictEqual(r.transactions, 0, 'it finishes (it threw before)');
});
