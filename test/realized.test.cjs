'use strict';
// Realized profit is read from receipts of YOUR contract (the real Drive ChronosFlashArb bytecode is used here).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ganache = require('ganache');
const { ethers } = require('ethers');
const { verifyRealized, contractFrom, candidateHashes } = require('../lib/realized.cjs');

const fx = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n + '.json'), 'utf8'));

test('only confirmed Arbitrage events from your own contract count, net of the gas actually paid', async () => {
  const eth = ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, miner: { defaultGasPrice: 20000000 }, wallet: { deterministic: true, totalAccounts: 3 } });
  const bp = new ethers.BrowserProvider(eth);
  const [owner, op] = [await bp.getSigner(0), await bp.getSigner(1)];
  const dep = async (n, ...a) => { const j = fx(n); const c = await new ethers.ContractFactory(j.abi, j.bytecode, owner).deploy(...a); await c.waitForDeployment(); return c; };
  const usdc = await dep('MockToken', 'USDC', 6), weth = await dep('MockToken', 'WETH', 18);
  const pool = await dep('MockAavePool', 5n), ra = await dep('MockRouter'), rb = await dep('MockRouter');
  const U = await usdc.getAddress(), W = await weth.getAddress();
  async function arbFor() {
    const arb = await dep('ChronosFlashArb', await pool.getAddress());
    await (await arb.setOperator(await op.getAddress(), true)).wait();
    for (const r of [ra, rb]) await (await arb.setRouter(await r.getAddress(), true)).wait();
    await (await arb.setMaxLoan(U, 10n ** 12n)).wait();
    return arb;
  }
  await (await usdc.mint(await pool.getAddress(), 10n ** 13n)).wait();
  for (const r of [ra, rb]) { await (await weth.mint(await r.getAddress(), 10n ** 21n)).wait(); await (await usdc.mint(await r.getAddress(), 10n ** 13n)).wait(); }
  await (await ra.setRate(U, W, 5n * 10n ** 8n, 1n)).wait();             // 1000 USDC -> 0.5 WETH
  await (await rb.setRate(W, U, 2020n * 10n ** 6n, 10n ** 18n)).wait();  // 0.5 WETH -> 1010 USDC
  const mine = await arbFor(), other = await arbFor();
  const now = (await bp.getBlock('latest')).timestamp;
  const legs = [{ dex: 0, router: await ra.getAddress(), tokenOut: W, fee: 500, minOut: 0n }, { dex: 0, router: await rb.getAddress(), tokenOut: U, fee: 500, minOut: 0n }];
  const run = async (arb) => (await (await arb.connect(op).execute(U, 1000n * 10n ** 6n, 10n ** 6n, BigInt(now + 3600), legs)).wait()).hash;
  const good = await run(mine);
  const notMine = await run(other);                                      // same event, different contract: must not count
  await (await usdc.mint(await owner.getAddress(), 5n)).wait();
  const plain = (await (await usdc.transfer(await op.getAddress(), 1n)).wait()).hash; // a transaction without any Arbitrage event

  const assets = [{ address: U.toLowerCase(), symbol: 'USDC', decimals: 6, price8: 100000000n }, { address: W.toLowerCase(), symbol: 'WETH', decimals: 18, price8: 200000000000n }];
  const r = await verifyRealized({ provider: bp, contract: await mine.getAddress(), hashes: [good, notMine, plain, '0x' + '00'.repeat(32)], assets, wethAddress: W, taxBps: 3000 });
  assert.strictEqual(r.checked, 4);
  assert.strictEqual(r.executions.length, 1, 'only the transaction on your contract counts');
  const x = r.executions[0];
  assert.strictEqual(x.txHash, good.toLowerCase());
  assert.strictEqual(x.profit, String(10n * 10n ** 6n - 500000n), '10 USDC gross − 0.5 USDC flash fee');
  const rc = await bp.getTransactionReceipt(good);
  const gasUsd = Number((BigInt(rc.gasUsed) * BigInt(rc.gasPrice) * 200000000000n) / 10n ** 18n) / 1e8;
  assert.ok(Math.abs(x.gasUsd - gasUsd) < 1e-9, 'gas is the receipt gas × effective price, in USD');
  assert.ok(Math.abs(r.totalNetUsd - (9.5 - gasUsd)) < 1e-9);
  assert.ok(Math.abs(x.netUsd - (9.5 - gasUsd)) < 1e-9, 'each execution is reported net of its own gas');
  assert.ok(Math.abs(r.taxReserveUsd - (9.5 - gasUsd) * 0.3) < 1e-9, 'Policy T1: 30% of gross − gas');
  assert.ok(r.profiting);

  // the same receipts checked against a contract that never traded: nothing
  const none = await verifyRealized({ provider: bp, contract: '0x' + '9'.repeat(40), hashes: [good, plain], assets, wethAddress: W, taxBps: 3000 });
  assert.strictEqual(none.executions.length, 0); assert.ok(!none.profiting);
  // no contract configured: explicit, never a guess
  assert.strictEqual((await verifyRealized({ provider: bp, contract: null, hashes: [good], assets })).note, 'no contract address set');
});

test('contract address and candidate hashes come from your settings and records only', () => {
  const env = { CONTRACT_ADDRESS: '0x1cd66cf5fac59f526f8f9732586c4d47a9eb67df' };
  assert.strictEqual(contractFrom((k) => env[k]), null, 'CONTRACT_ADDRESS alone is never trusted (it may be another tool\'s contract)');
  env.CHRONOS_FLASH_ARB_ADDRESS = '0x000000000000000000000000000000000000dead';
  assert.strictEqual(contractFrom((k) => env[k]).key, 'CHRONOS_FLASH_ARB_ADDRESS');
  assert.strictEqual(contractFrom(() => 'nope'), null);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'rz-'));
  fs.writeFileSync(path.join(dir, 'executions.jsonl'), JSON.stringify({ txHash: '0x' + 'cd'.repeat(32) }) + '\nnot json\n');
  const hs = candidateHashes({ actions: [{ isTx: true, txHash: '0x' + 'AB'.repeat(32) }, { isTx: false, txHash: 'N/A' }] }, dir);
  assert.deepStrictEqual(hs.sort(), ['0x' + 'ab'.repeat(32), '0x' + 'cd'.repeat(32)].sort());
});

test('CONTRACT_ADDRESS is adopted only when it is a Chronos contract (MAX_LEGS 4, borrows from the Aave pool)', async () => {
  const { adoptLegacy } = require('../lib/realized.cjs');
  const { ethers } = require('ethers');
  const I = new ethers.Interface(['function MAX_LEGS() view returns (uint8)', 'function POOL() view returns (address)']);
  const AAVE = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
  const fake = (legs, pool) => ({ call: async ({ data }) => { if (legs === null) throw new Error('execution reverted'); return data === I.getFunction('MAX_LEGS').selector ? I.encodeFunctionResult('MAX_LEGS', [legs]) : I.encodeFunctionResult('POOL', [pool]); } });
  const other = '0x1cd66cf5fac59f526f8f9732586c4d47a9eb67df';
  const env = (o) => (k) => o[k] || '';
  assert.strictEqual(await adoptLegacy(fake(4, AAVE), env({ CONTRACT_ADDRESS: other }), AAVE), ethers.getAddress(other));
  assert.strictEqual(await adoptLegacy(fake(null), env({ CONTRACT_ADDRESS: other }), AAVE), null, 'reverts: another tool\'s contract, never used');
  assert.strictEqual(await adoptLegacy(fake(3, AAVE), env({ CONTRACT_ADDRESS: other }), AAVE), null);
  assert.strictEqual(await adoptLegacy(fake(4, other), env({ CONTRACT_ADDRESS: other }), AAVE), null, 'a different lender is not ours');
  assert.strictEqual(await adoptLegacy(fake(4, AAVE), env({ CONTRACT_ADDRESS: other, CHRONOS_FLASH_ARB_ADDRESS: AAVE }), AAVE), null, 'yours is already set: nothing adopted');
});
