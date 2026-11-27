'use strict';
// Your executor key on this phone (2.9.11): the encrypted keystore, the key agent (a real detached process started
// exactly as `chronos executor unlock` starts it, passphrase over a pipe), its signing policy, and the live executor
// signing through it. The chain here is a local one set to Arbitrum One's chain id with your contract on it
// (fakeChain); its real counterpart is the real agent on your phone against your real contract on Arbitrum One
// (chronos verify-real → executor-agent: unlocked, operator, gas, and the agent refusing non-trades).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ganache = require('ganache');
const { ethers } = require('ethers');
const KS = require('../lib/keystore.cjs');
const KA = require('../lib/keyagent.cjs');
const SH = require('../lib/shadow.cjs');
const { Executor } = require('../lib/executor.cjs');
const { readExecPolicy } = require('../lib/execpolicy.cjs');
const EK = require('../tui/executorkey.cjs');

const fx = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n + '.json'), 'utf8'));
const PK = '0x' + '42'.repeat(32); const ADDR = new ethers.Wallet(PK).address;
const PASS = 'executor horse battery staple';
const fastN = 1 << 10; // cheap scrypt for tests only; chronos executor import uses ethers' default
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ka-'));
const CONTRACT = '0x' + 'c0'.repeat(20);
const execData = (v2) => (v2
  ? SH.IFACE2.encodeFunctionData('execute', [0, '0x' + '11'.repeat(20), 1n, 1n, 1n, []])
  : SH.IFACE.encodeFunctionData('execute', ['0x' + '11'.repeat(20), 1n, 1n, 1n, []]));
const tradeTx = (o = {}) => ({ type: 2, chainId: 42161n, nonce: 0, to: CONTRACT, data: execData(true), value: 0n, gasLimit: 900000n, maxFeePerGas: 20_000_000n, maxPriorityFeePerGas: 1_000_000n, ...o });
const sel = KA.executeSelectors();

test('the key agent signs a trade and nothing else: chain, contract, value, type, function, gas and fee cap', () => {
  const pol = { contract: CONTRACT, selectors: sel };
  assert.strictEqual(KA.refuse(tradeTx(), pol), null, 'a v2 execute() to your contract is signed');
  assert.strictEqual(KA.refuse(tradeTx({ data: execData(false) }), pol), null, 'a v1 execute() too');
  assert.match(KA.refuse(tradeTx({ chainId: 1n }), pol), /not Arbitrum One/);
  assert.match(KA.refuse(tradeTx({ to: '0x' + '99'.repeat(20) }), pol), /only your contract/);
  assert.match(KA.refuse(tradeTx({ to: null }), pol), /only your contract/, 'a deployment is refused');
  assert.match(KA.refuse(tradeTx({ value: 1n }), pol), /never carries ETH/);
  assert.match(KA.refuse(tradeTx({ type: 0, gasPrice: 1n, maxFeePerGas: undefined, maxPriorityFeePerGas: undefined }), pol), /type-2/);
  const setOp = new ethers.Interface(['function setOperator(address,bool)', 'function withdraw(address,uint256,address)', 'function transfer(address,uint256)']);
  for (const f of [['setOperator', ['0x' + '99'.repeat(20), true]], ['withdraw', ['0x' + '11'.repeat(20), 1n, '0x' + '99'.repeat(20)]], ['transfer', ['0x' + '99'.repeat(20), 1n]]]) assert.match(KA.refuse(tradeTx({ data: setOp.encodeFunctionData(...f) }), pol), /only the contract's execute/, f[0] + ' is refused');
  assert.match(KA.refuse(tradeTx({ data: '0x' }), pol), /only the contract's execute/);
  assert.match(KA.refuse(tradeTx({ gasLimit: KA.DEFAULT_MAX_GAS + 1n }), pol), /gas limit/);
  assert.match(KA.refuse(tradeTx({ gasLimit: 10_000_000n, maxFeePerGas: 10n ** 10n }), pol), /over the 0\.05 ETH cap/, '10M gas at 10 gwei = 0.1 ETH: refused');
  assert.strictEqual(KA.refuse(tradeTx({ gasLimit: 4_000_000n, maxFeePerGas: 10n ** 10n }), pol), null, 'a big route at 10 gwei (0.04 ETH worst case) still signs: the cap never blocks a normal trade');
});

test('the executor key is kept encrypted, separate from the owner key, never in the settings bundle', async () => {
  const dir = tmp();
  assert.strictEqual(await KS.saveKey(dir, 'executor', PK, PASS, { scryptN: fastN }), ADDR);
  const raw = fs.readFileSync(KS.fileOf(dir, 'executor'), 'utf8');
  assert.ok(!raw.includes(PK.slice(2)), 'no plaintext key'); assert.strictEqual((fs.statSync(KS.fileOf(dir, 'executor')).mode & 0o777).toString(8), '600');
  assert.strictEqual(KS.executorAddress(dir), ADDR); assert.strictEqual(KS.ownerAddress(dir), null, 'the owner keystore is untouched');
  assert.throws(() => KS.fileOf(dir, '../x'), /unknown keystore/);
  const said = []; const KY = require('../tui/keys.cjs'); const env = path.join(dir, '.env'); fs.writeFileSync(env, 'CHRONOS_EXECUTOR_ADDRESS=' + ADDR + '\n', { mode: 0o600 });
  await KY.exportBundle({ envFile: env, dataDir: dir, out: path.join(dir, 'b.enc'), P: { secret: async () => PASS }, log: (s) => said.push(s) });
  assert.strictEqual(KS.open(fs.readFileSync(path.join(dir, 'b.enc'), 'utf8'), PASS).ownerJson, null, 'the executor keystore never travels in the bundle');
});

test('import refuses the owner key and a key for another executor; unlock takes three tries', async () => {
  const dir = tmp(); await KS.saveOwner(dir, PK, PASS, { scryptN: fastN });
  const log = []; const ans = (xs) => ({ secret: async () => xs.shift(), confirm: async () => false });
  const base = { dataDir: dir, log: (s) => log.push(s), get: () => '', setEnv: () => {} };
  assert.strictEqual(await EK.run({ ...base, sub: 'import', P: ans([PK]) }), 1); assert.match(log.at(-1), /is your OWNER wallet/);
  const other = tmp(); const set = {};
  assert.strictEqual(await EK.run({ ...base, dataDir: other, sub: 'import', P: ans([PK]), get: (k) => (k === 'CHRONOS_EXECUTOR_ADDRESS' ? '0x' + '99'.repeat(20) : '') }), 1); assert.match(log.at(-1), /but your executor is 0x9999/);
  assert.strictEqual(await EK.run({ ...base, dataDir: other, sub: 'import', P: ans([PK, PASS, PASS]), setEnv: (k, v) => { set[k] = v; }, contractOwner: async () => '0x' + '77'.repeat(20) }), 0);
  assert.strictEqual(KS.executorAddress(other), ADDR); assert.strictEqual(set.CHRONOS_EXECUTOR_ADDRESS, ADDR, 'the executor address is set when it was empty');
  assert.strictEqual(await EK.run({ ...base, dataDir: tmp(), sub: 'import', P: ans([PK]), contractOwner: async () => ADDR }), 1); assert.match(log.at(-1), /owns your contract/);
  // unlock: no contract → refused; wrong passphrases → still locked after three
  assert.strictEqual(await EK.run({ ...base, dataDir: other, sub: 'unlock', P: ans([]) }), 1); assert.match(log.at(-1), /No contract yet/);
  let tries = 0; const fakeStart = async () => { tries++; return { ok: false, why: 'that passphrase does not open the executor keystore' }; };
  assert.strictEqual(await EK.run({ ...base, dataDir: other, sub: 'unlock', get: (k) => (k === 'CHRONOS_FLASH_ARB_ADDRESS' ? CONTRACT : ''), P: ans(['a wrong one!', 'b wrong one!', 'c wrong one!']), start: fakeStart }), 1);
  assert.strictEqual(tries, 3); assert.match(log.at(-1), /Three wrong passphrases: still locked/);
});

test('the key agent: a real detached process, unlocked over a pipe, socket 600, signs trades, refuses the rest, locks', async () => {
  const dir = tmp(); await KS.saveKey(dir, 'executor', PK, PASS, { scryptN: fastN });
  assert.strictEqual(await KA.status(dir), null);
  await assert.rejects(new KA.AgentSigner(dir).getAddress(), /executor key is locked/);
  const bad = await KA.start({ dataDir: dir, contract: CONTRACT, passphrase: 'not the passphrase' });
  assert.strictEqual(bad.ok, false); assert.match(bad.why, /passphrase does not open/);
  const ok = await KA.start({ dataDir: dir, contract: CONTRACT, passphrase: PASS });
  try {
    assert.strictEqual(ok.ok, true, JSON.stringify(ok)); assert.strictEqual(ok.address, ADDR);
    assert.strictEqual((fs.statSync(KA.sockOf(dir)).mode & 0o777).toString(8), '600'); assert.strictEqual((fs.statSync(path.dirname(KA.sockOf(dir))).mode & 0o777).toString(8), '700');
    const twice = await KA.start({ dataDir: dir, contract: CONTRACT, passphrase: PASS }); assert.strictEqual(twice.ok, false); assert.match(twice.why, /already running/);
    const s = new KA.AgentSigner(dir);
    assert.strictEqual(await s.getAddress(), ADDR);
    const raw = await s.signTransaction(tradeTx());
    const t = ethers.Transaction.from(raw); assert.strictEqual(t.from, ADDR); assert.strictEqual(t.to.toLowerCase(), CONTRACT);
    await assert.rejects(s.signTransaction(tradeTx({ to: '0x' + '99'.repeat(20) })), /refused by the key agent: only your contract/);
    await assert.rejects(s.signTransaction(tradeTx({ value: 10n ** 18n })), /refused by the key agent: a trade never carries ETH/);
    await assert.rejects(s.signMessage('hello'), /signs trades only/);
    const st = await KA.status(dir); assert.strictEqual(st.signed, 1); assert.strictEqual(st.contract.toLowerCase(), CONTRACT); assert.strictEqual(st.maxTxEth, '0.05');
    const logText = fs.readFileSync(KA.logOf(dir), 'utf8'); assert.ok(logText.includes(ethers.keccak256(raw)) && !logText.includes(PK.slice(2)), 'logged by hash, no key');
    // the agent keeps the key; the engine process never sees it (nothing in this process's memory beyond the socket)
    assert.ok(!JSON.stringify(s).includes(PK.slice(2)));
  } finally {
    const said = []; assert.strictEqual(await EK.run({ sub: 'lock', dataDir: dir, log: (x) => said.push(x) }), 0);
  }
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(await KA.status(dir), null, 'locked'); assert.ok(!fs.existsSync(KA.sockOf(dir)), 'socket removed');
  await assert.rejects(new KA.AgentSigner(dir).signTransaction(tradeTx()), /executor key is locked/);
});

// an agent that lies (signs another transaction, or as another account): the engine must refuse what comes back
function fakeAgent(lie) {
  const me = new ethers.Wallet(PK), other = new ethers.Wallet('0x' + '43'.repeat(32));
  return async (_dir, req) => {
    if (req.op === 'address') return { address: me.address };
    const t = ethers.Transaction.from(req.unsigned);
    if (lie === 'other-tx') { t.nonce = t.nonce + 1; return { raw: await me.signTransaction(t) }; }
    return { raw: await other.signTransaction(t) };
  };
}

test('the engine checks every signature the agent returns: another transaction or another account is refused', async () => {
  await assert.rejects(new KA.AgentSigner('/x', null, { call: fakeAgent('other-tx') }).signTransaction(tradeTx()), /signed a different transaction/);
  await assert.rejects(new KA.AgentSigner('/x', null, { call: fakeAgent('other-account') }).signTransaction(tradeTx()), /signed as another account/);
});

// ---------------------------------------------------------------- your contract on a local chain (Arbitrum's chain id)
async function fakeChain() {
  const eth = ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 2 } });
  const bp = new ethers.BrowserProvider(eth, undefined, { cacheTimeout: -1 });
  const owner = await bp.getSigner(0);
  const dep = async (n, ...a) => { const j = fx(n); const c = await new ethers.ContractFactory(j.abi, j.bytecode, owner).deploy(...a); await c.waitForDeployment(); return c; };
  const usdc = await dep('MockToken', 'USDC', 6), weth = await dep('MockToken', 'WETH', 18);
  const pool = await dep('MockAavePool', 5n), ra = await dep('MockRouter'), rb = await dep('MockRouter');
  const U = await usdc.getAddress(), W = await weth.getAddress();
  const arb = await dep('ChronosFlashArb', await pool.getAddress());
  for (const r of [ra, rb]) await (await arb.setRouter(await r.getAddress(), true)).wait();
  await (await arb.setMaxLoan(U, 10n ** 12n)).wait();
  await (await usdc.mint(await pool.getAddress(), 10n ** 13n)).wait();
  for (const r of [ra, rb]) { await (await weth.mint(await r.getAddress(), 10n ** 21n)).wait(); await (await usdc.mint(await r.getAddress(), 10n ** 13n)).wait(); }
  await (await ra.setRate(U, W, 5n * 10n ** 8n, 1n)).wait();
  await (await rb.setRate(W, U, 2020n * 10n ** 6n, 10n ** 18n)).wait();
  const now = (await bp.getBlock('latest')).timestamp;
  const runParams = { asset: U, amount: (1000n * 10n ** 6n).toString(), minProfit: (10n ** 6n).toString(), deadline: now + 600,
    legs: [{ dex: 0, router: await ra.getAddress(), tokenOut: W, fee: 500, minOut: '0' }, { dex: 0, router: await rb.getAddress(), tokenOut: U, fee: 500, minOut: '0' }] };
  const aave = { pool: await pool.getAddress(), flashEnabled: true, availableLiquidity: 10n ** 13n };
  const px = { assetPrice8: 100000000n, decimals: 6, ethPrice8: 200000000000n, gasPriceWei: (await bp.getFeeData()).gasPrice };
  return { bp, owner, arb, A: await arb.getAddress(), runParams, aave, px };
}

test('live executor signing through the key agent: not ready until operator + gas, trades, and holds the moment it is locked', async () => {
  const w = await fakeChain(); const dir = tmp();
  await KS.saveKey(dir, 'executor', PK, PASS, { scryptN: fastN });
  const { policy } = readExecPolicy((k) => ({ MAX_DAILY_GAS_USD: '50' })[k]);
  const mk = () => new Executor({ provider: w.bp, signer: new KA.AgentSigner(dir, w.bp), contract: w.A, policy, cfg: { MIN_NET_PROFIT_USD: 0.35, GAS_CEILING_GWEI: 100, DEADLINE_SECONDS: 120 }, dataDir: dir });
  let ex = mk();
  const locked = await ex.readiness(); assert.strictEqual(locked.ready, false); assert.match(locked.why, /key agent is not running/, 'locked: never ready');
  const ok = await KA.start({ dataDir: dir, contract: w.A, passphrase: PASS });
  try {
    assert.ok(ok.ok, JSON.stringify(ok));
    assert.match((await ex.readiness()).why, /not an operator/);
    await (await w.arb.setOperator(ADDR, true)).wait();
    await (await w.owner.sendTransaction({ to: ADDR, value: 10n ** 18n })).wait();
    assert.strictEqual((await ex.readiness()).ready, true);
    const r = await ex.execute({ cand: { runParams: w.runParams, routeKey: 'USDC>WETH|a|b' }, aave: w.aave, px: w.px });
    assert.strictEqual(r.sent, true, JSON.stringify(r)); assert.strictEqual(r.status, 'success');
    assert.strictEqual((await w.bp.getTransaction(r.txHash)).from, ADDR, 'signed by your executor key, through the agent');
    assert.ok(r.netUsd > 0.35);
    assert.ok(ex.signer.connect({}) instanceof KA.AgentSigner, 'after a node failover the rebound signer still signs through the agent');
  } finally { await KA.call(dir, { op: 'stop' }).catch(() => null); }
  await new Promise((res) => setTimeout(res, 200));
  ex = mk();
  const held = await ex.readiness(); assert.strictEqual(held.ready, false); assert.match(held.why, /chronos executor unlock/);
  const n0 = await w.bp.getTransactionCount(ADDR);
  const r2 = await ex.execute({ cand: { runParams: { ...w.runParams }, routeKey: 'other' }, aave: w.aave, px: w.px });
  assert.strictEqual(r2.sent, false); assert.match(r2.reason, /locked/); assert.strictEqual(await w.bp.getTransactionCount(ADDR), n0, 'nothing sent while locked');
});
