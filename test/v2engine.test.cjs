'use strict';
// The engine drives contract v2 end to end on a local chain with the real ChronosFlashArbV2 bytecode
// (contracts/v2) and the stand-ins in test/fixtures/v2 (each paired with its real counterpart in counterparts.json):
// it reads which contract is deployed and what it allows, builds the exact call (Balancer or Aave loan; direct pool,
// direct pair or router legs), and the shadow tester checks every requirement and gets the contract's own profit.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const ganache = require('ganache');
const E = require('../lib/engine.cjs');
const CI = require('../lib/contractinfo.cjs');
const SH = require('../lib/shadow.cjs');

const art = (dir, n) => JSON.parse(fs.readFileSync(path.join(__dirname, ...dir, n + '.json'), 'utf8'));
const CFG = { MIN_NET_PROFIT_USD: 0.01, MAX_SLIPPAGE_BPS: 50, MIN_PROFIT_CAPTURE_BPS: 5000, DEADLINE_SECONDS: 120 };
const M = (n) => BigInt(n) * 10n ** 6n, W = (n) => BigInt(n) * 10n ** 18n;

async function world() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 3 } }));
  const [owner, executor] = await Promise.all([provider.getSigner(0), provider.getSigner(1)]);
  const A = (c) => c.getAddress();
  const deploy = async (n, ...a) => { const j = art(['fixtures', 'v2'], n); const c = await new ethers.ContractFactory(j.abi, j.bytecode, owner).deploy(...a); await c.waitForDeployment(); return c; };
  const usdc = await deploy('MockToken', 'USDC', 6), weth = await deploy('MockToken', 'WETH', 18);
  const [U, Wt] = await Promise.all([A(usdc), A(weth)]);
  const aave = await deploy('MockAavePool', 5n), vault = await deploy('MockBalancerVaultFull');
  const r1 = await deploy('MockRouter'), v3f = await deploy('MockV3Factory'), v2f = await deploy('MockV2Factory'), other = await deploy('MockV3Factory');
  const pool = await deploy('MockV3Pool', await A(v3f), U, Wt, 500); await v3f.register(U, Wt, 500, await A(pool));
  if (U.toLowerCase() < Wt.toLowerCase()) await pool.setRate(5n * 10n ** 8n, 1n); else await pool.setRate(1n, 5n * 10n ** 8n); // 1000 USDC → 0.5 WETH
  const pair = await deploy('MockV2Pair', await A(v2f), Wt, U, 30n); await v2f.register(Wt, U, await A(pair));
  await weth.mint(await A(pair), W(1000)); await usdc.mint(await A(pair), M(2_060_000)); await pair.sync(); // 2060 USDC/WETH
  for (const x of [aave, vault]) await usdc.mint(await A(x), M(10_000_000));
  await usdc.mint(await A(pool), M(10_000_000)); await weth.mint(await A(pool), W(1000));
  await weth.mint(await A(r1), W(1000)); await usdc.mint(await A(r1), M(10_000_000));
  await r1.setRate(Wt, U, 2020n * 10n ** 6n, 10n ** 18n); await r1.setRate(U, Wt, 5n * 10n ** 8n, 1n);
  const j = art(['..', 'contracts', 'v2'], 'ChronosFlashArbV2');
  const arb = await new ethers.ContractFactory(j.abi, j.bytecode, owner).deploy(...require('../lib/deploy.cjs').ctorArgs(j, await A(aave), { vault: await A(vault) })); await arb.waitForDeployment(); // no Morpho or V4 on this chain: zero address = not used
  await arb.setOperator(await executor.getAddress(), true); await arb.setRouter(await A(r1), true);
  await arb.setFactory(await A(v3f), true, 0); await arb.setFactory(await A(v2f), true, 30); await arb.setMaxLoan(U, M(100_000));
  const lc = async (c) => (await A(c)).toLowerCase();
  const mk = { pool: { kind: 'v3', fee: 500, address: await lc(pool), factory: await lc(v3f), router: await A(r1) },
    pair: { kind: 'v2', fee: 0, address: await lc(pair), factory: await lc(v2f), router: await A(r1) },
    viaRouter: { kind: 'v3', fee: 3000, address: '0x' + '0d'.repeat(20), factory: await lc(other), router: await A(r1) } };
  return { provider, arb, arbA: await A(arb), executor: await executor.getAddress(), U, Wt, aave, vault: await lc(vault), aavePool: await A(aave), factories: [await lc(v3f), await lc(v2f), await lc(other)], mk, other };
}

const pairOut = (amtIn) => { const f = amtIn * 9970n; return (f * M(2_060_000)) / (W(1000) * 10000n + f); };

test('reads the deployed contract: v2, its vault, which factories it allows and as what', async () => {
  const w = await world();
  const info = await CI.read(w.provider, w.arbA, w.factories);
  assert.strictEqual(info.kind, 2); assert.strictEqual(info.vault, w.vault);
  assert.deepStrictEqual(w.factories.map((f) => info.factories[f]), [{ allowed: true, v2FeeBps: 0 }, { allowed: true, v2FeeBps: 30 }, { allowed: false, v2FeeBps: 0 }]);
  assert.deepStrictEqual([CI.legMode(info, w.mk.pool), CI.legMode(info, w.mk.pair), CI.legMode(info, w.mk.viaRouter)], ['pool', 'pair', 'router']);
  const v1 = await CI.read(w.provider, w.aavePool, []); // anything without VAULT() is treated as v1
  assert.strictEqual(v1.kind, 1);
});

test('Balancer loan, direct pool then direct pair: preflight passes and the contract reports the profit the engine expects', async () => {
  const w = await world(); const info = await CI.read(w.provider, w.arbA, w.factories);
  const amount = M(1000), mid = W(1) / 2n, out = pairOut(mid);
  const cand = { contractProfit: out - amount, premium: 0n, outs: [mid, out] };
  const params = E.buildRunParams({ asset: w.U, amount, cand, route: { markets: [w.mk.pool, w.mk.pair], path: [w.U, w.Wt, w.U] }, cfg: CFG, assetPrice8: 100000000n, decimals: 6, nowSec: (await w.provider.getBlock('latest')).timestamp, contract: info, source: 1 });
  const flash = { provider: 'balancer_v2', vault: w.vault, available: String(M(10_000_000)) };
  const pf = await SH.preflight({ provider: w.provider, contract: w.arbA, executor: w.executor, params, aave: null, flash });
  assert.ok(pf.ok, pf.checks.filter((c) => !c.ok).map((c) => c.name).join(', '));
  assert.ok(pf.checks.some((c) => c.name === 'contract borrows from this Balancer vault' && c.ok));
  const sim = await SH.simulate({ provider: w.provider, contract: w.arbA, executor: w.executor, params });
  assert.ok(sim.ok, sim.error); assert.strictEqual(sim.profit, out - amount, 'contract profit = the engine\'s own figure (0% Balancer fee)');
});

test('Aave loan with a router leg: the 5 bps fee is paid and counted', async () => {
  const w = await world(); const info = await CI.read(w.provider, w.arbA, w.factories);
  const amount = M(1000), mid = W(1) / 2n, out = M(1010), premium = M(1000) * 5n / 10000n;
  const cand = { contractProfit: out - amount - premium, premium, outs: [mid, out] };
  const params = E.buildRunParams({ asset: w.U, amount, cand, route: { markets: [w.mk.pool, w.mk.viaRouter], path: [w.U, w.Wt, w.U] }, cfg: CFG, assetPrice8: 100000000n, decimals: 6, nowSec: (await w.provider.getBlock('latest')).timestamp, contract: info, source: 0 });
  assert.deepStrictEqual(params.legs.map((l) => l.v2dex), [2, 0]);
  const pf = await SH.preflight({ provider: w.provider, contract: w.arbA, executor: w.executor, params, aave: { pool: w.aavePool, flashEnabled: true, availableLiquidity: String(M(10_000_000)) } });
  assert.ok(pf.ok, pf.checks.filter((c) => !c.ok).map((c) => c.name).join(', '));
  const sim = await SH.simulate({ provider: w.provider, contract: w.arbA, executor: w.executor, params });
  assert.ok(sim.ok, sim.error); assert.strictEqual(sim.profit, out - amount - premium);
});

test('what the contract would refuse is caught before sending, with the fix; its own errors are decoded', async () => {
  const w = await world(); const info = await CI.read(w.provider, w.arbA, w.factories);
  const amount = M(1000), mid = W(1) / 2n, out = pairOut(mid);
  const nowSec = (await w.provider.getBlock('latest')).timestamp;
  const build = (over = {}) => E.buildRunParams({ asset: w.U, amount, cand: { contractProfit: out - amount, premium: 0n, outs: [mid, out] }, route: { markets: [w.mk.pool, w.mk.pair], path: [w.U, w.Wt, w.U] }, cfg: CFG, assetPrice8: 100000000n, decimals: 6, nowSec, contract: info, source: 1, ...over });
  // the factory was allowed when read, then the owner removed it
  await w.arb.setFactory(w.factories[1], false, 0);
  const pf = await SH.preflight({ provider: w.provider, contract: w.arbA, executor: w.executor, params: build(), flash: { vault: w.vault, available: String(M(10_000_000)) } });
  const f = pf.checks.find((c) => c.name === 'every pool/pair factory allowed');
  assert.strictEqual(f.ok, false); assert.match(f.fix, /setFactory/);
  const sim = await SH.simulate({ provider: w.provider, contract: w.arbA, executor: w.executor, params: build() });
  assert.strictEqual(sim.ok, false); assert.match(sim.error, /^PoolNotAllowed/);
  // a vault the contract does not use, or not enough Balancer liquidity
  const p2 = await SH.preflight({ provider: w.provider, contract: w.arbA, executor: w.executor, params: build(), flash: { vault: '0x' + '1'.repeat(40), available: '1' } });
  assert.deepStrictEqual(p2.checks.filter((c) => /Balancer/.test(c.name)).map((c) => c.ok), [false, false]);
});

test('deploy artifact for v2: the exact bytecode these tests and the real-protocol probe run, hash-checked', () => {
  const D = require('../lib/deploy.cjs'); const crypto = require('crypto');
  const art = D.loadArtifact(D.ARTIFACT_V2);
  assert.strictEqual(art.bytecode, art2().bytecode, 'chronos deploy --v2 sends what was tested');
  assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'contract', 'ChronosFlashArbV2.sol'), 'utf8')).digest('hex'), art.sourceSha256);
  assert.strictEqual(art.audited, false);
});
const art2 = () => art(['..', 'contracts', 'v2'], 'ChronosFlashArbV2');

test('v2 factory settings: V3 fee 0, V2 measured fee rounded up, unmeasured V2 left to its router, unchecked venues left out', () => {
  const D = require('../lib/deploy.cjs');
  const a = (n) => '0x' + n.repeat(40);
  const venues = [{ id: 'uni3', kind: 'v3', executable: true, factory: a('1') }, { id: 'uni2', kind: 'v2', executable: true, factory: a('2') }, { id: 'cake2', kind: 'v2', executable: true, factory: a('3') }, { id: 'bad', kind: 'v3', executable: true, factory: a('4') }, { id: 'camelot', kind: 'v2', executable: false, factory: a('5') }];
  const r = D.v2Factories(venues, new Set(['uni3', 'uni2', 'cake2', 'camelot']), { uni2: 29, camelot: 30 });
  assert.deepStrictEqual(r.factories.map((f) => [f.id, f.fee]), [['uni3', 0], ['uni2', 30]]);
  assert.deepStrictEqual(r.skipped, ['cake2']);
});

test('deploy plan for v2: deploy with the vault → factories, operator, routers, caps → second plan sends nothing; a v1 address is replaced and kept', async () => {
  const D = require('../lib/deploy.cjs');
  const w = await world(); const owner = await w.provider.getSigner(0);
  const ownerA = await owner.getAddress();
  const v2 = { vault: ethers.getAddress(w.vault), factories: [{ id: 'v3f', address: ethers.getAddress(w.factories[0]), fee: 0 }, { id: 'v2f', address: ethers.getAddress(w.factories[1]), fee: 30 }] };
  const base = { provider: w.provider, owner: ownerA, aavePool: w.aavePool, executor: w.executor, routers: [{ id: 'r1', address: ethers.getAddress(w.mk.pool.router) }], assets: [{ address: w.U, symbol: 'USDC', decimals: 6, price8: 100000000n }], maxLadderUsd: 1000, headroomPct: 20, topUpEth: 0.001, v2 };
  const fresh = await D.plan({ ...base, contract: null });
  assert.strictEqual(fresh.deploy, true);
  assert.deepStrictEqual(fresh.steps.filter((s) => s.fn === 'setFactory').map((s) => s.args[2]), [0, 30]);
  const d = await D.deployContract(owner, D.loadArtifact(D.ARTIFACT_V2), w.aavePool, 6_000_000n, () => {}, v2.vault);
  for (const s of fresh.steps.filter((x) => x.fn)) await (await owner.sendTransaction(D.txFor(s, d.address))).wait();
  const again = await D.plan({ ...base, contract: d.address });
  assert.deepStrictEqual(again.steps.filter((s) => s.fn), [], 'everything already in place');
  assert.ok(again.kept.some((k) => /v2f factory already allowed \(fee 30 bps\)/.test(k)));
  // a fee set below the measured one would make every pair swap revert: the plan corrects it
  const arbD = new ethers.Contract(d.address, D.IFACE, owner); await (await arbD.setFactory(v2.factories[1].address, true, 20)).wait();
  const fix = await D.plan({ ...base, contract: d.address });
  assert.deepStrictEqual(fix.steps.filter((x) => x.fn).map((x) => [x.fn, x.args[2]]), [['setFactory', 30]]);
  assert.match(fix.steps[0].why, /was 20/);
  // a v1-style contract (no VAULT) at the address: deploy a new v2, keep the old one
  const v1 = await new ethers.ContractFactory(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ChronosFlashArb.json'), 'utf8')).abi, JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ChronosFlashArb.json'), 'utf8')).bytecode, owner).deploy(w.aavePool);
  await v1.waitForDeployment();
  const rep = await D.plan({ ...base, contract: await v1.getAddress() });
  assert.strictEqual(rep.deploy, true); assert.strictEqual(rep.replaces, await v1.getAddress());
  // a v2 wired to another vault is refused
  const odd = await new ethers.ContractFactory(art2().abi, art2().bytecode, owner).deploy(...D.ctorArgs(art2(), w.aavePool, { vault: '0x' + '1'.repeat(40) })); await odd.waitForDeployment();
  await assert.rejects(D.plan({ ...base, contract: await odd.getAddress() }), /borrows from Balancer vault/);
});
