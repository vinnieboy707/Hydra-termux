'use strict';
// Shadow test → automatic live execution, end to end, with your real ChronosFlashArb bytecode on a local chain and a
// stand-in for Cloud KMS that signs exactly the way KMS does (DER, sometimes high-s). TEST-ONLY key below; the real
// executor key lives in a Cloud KMS HSM and never appears in code.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const ganache = require('ganache');
const { ethers } = require('ethers');
const { KmsSigner, parseDer, N } = require('../lib/kms.cjs');
const SH = require('../lib/shadow.cjs');
const { Executor } = require('../lib/executor.cjs');
const MODE = require('../lib/mode.cjs');
const { readExecPolicy } = require('../lib/execpolicy.cjs');
const { verifyRealized } = require('../lib/realized.cjs');
const BAL = require('../lib/balances.cjs');

const fx = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n + '.json'), 'utf8'));
const KEY = 'projects/chronos-test/locations/us-east4/keyRings/chronos/cryptoKeys/executor/cryptoKeyVersions/1';

// ---------------------------------------------------------------- a Cloud KMS stand-in
function derInt(v) { let h = v.toString(16); if (h.length % 2) h = '0' + h; let b = Buffer.from(h, 'hex'); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return Buffer.concat([Buffer.from([0x02, b.length]), b]); }
function der(r, s) { const body = Buffer.concat([derInt(r), derInt(s)]); return Buffer.concat([Buffer.from([0x30, body.length]), body]); }
function fakeKms({ protectionLevel = 'HSM', highS = 'alternate', otherKeySigns = false } = {}) {
  const sk = new ethers.SigningKey('0x' + '5a'.repeat(32)); // TEST-ONLY
  const other = new ethers.SigningKey('0x' + '6b'.repeat(32)); // TEST-ONLY
  const spki = Buffer.concat([Buffer.from('3056301006072a8648ce3d020106052b8104000a034200', 'hex'), Buffer.from(sk.publicKey.slice(2), 'hex')]);
  const pem = `-----BEGIN PUBLIC KEY-----\n${spki.toString('base64')}\n-----END PUBLIC KEY-----\n`;
  let n = 0; const seen = { tokens: [], signs: 0 };
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
      if (req.url === '/token') { res.end(JSON.stringify({ access_token: 'meta-token', expires_in: 3600, token_type: 'Bearer' })); return; }
      seen.tokens.push(req.headers.authorization);
      if (!/^Bearer (test-token|meta-token)$/.test(req.headers.authorization || '')) { res.statusCode = 401; res.end('{}'); return; }
      if (req.method === 'GET' && req.url === `/v1/${KEY}/publicKey`) { res.end(JSON.stringify({ pem, algorithm: 'EC_SIGN_SECP256K1_SHA256', protectionLevel, name: KEY })); return; }
      if (req.method === 'POST' && req.url === `/v1/${KEY}:asymmetricSign`) {
        seen.signs++;
        const digest = Buffer.from(JSON.parse(b).digest.sha256, 'base64');
        const sig = (otherKeySigns ? other : sk).sign(digest);
        let s = BigInt(sig.s);
        if (highS === 'always' || (highS === 'alternate' && n++ % 2 === 0)) s = N - s; // KMS may return either
        res.end(JSON.stringify({ signature: der(BigInt(sig.r), s).toString('base64'), name: KEY, protectionLevel }));
        return;
      }
      res.statusCode = 404; res.end('{}');
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, seen, address: ethers.computeAddress(sk.publicKey), endpoint: `http://127.0.0.1:${srv.address().port}/v1/`, tokenUrl: `http://127.0.0.1:${srv.address().port}/token` })));
}

test('KMS signer: address from the HSM public key, low-s signatures that recover to it, metadata-server auth', async () => {
  const k = await fakeKms();
  try {
    const s = new KmsSigner(KEY, null, { endpoint: k.endpoint, token: async () => 'test-token' });
    assert.strictEqual(await s.getAddress(), k.address);
    for (let i = 0; i < 4; i++) { // half of these come back high-s from "KMS"
      const d = ethers.keccak256(ethers.toUtf8Bytes('chronos ' + i));
      const sig = await s.signDigest(d);
      assert.ok(BigInt(sig.s) <= N / 2n, 'low-s only (EIP-2)');
      assert.strictEqual(ethers.recoverAddress(d, sig), k.address);
    }
    const raw = await s.signTransaction({ type: 2, chainId: 42161n, nonce: 0, to: '0x000000000000000000000000000000000000dEaD', value: 1n, gasLimit: 21000n, maxFeePerGas: 10n ** 9n, maxPriorityFeePerGas: 1n });
    assert.strictEqual(ethers.Transaction.from(raw).from, k.address, 'the transaction is signed by the KMS key');
    // on the VM the token comes from the metadata server, cached
    process.env.CHRONOS_METADATA_TOKEN_URL = k.tokenUrl;
    const m = new KmsSigner(KEY, null, { endpoint: k.endpoint });
    await m.getAddress(); await m.signDigest(ethers.ZeroHash.replace(/0$/, '1'));
    assert.ok(k.seen.tokens.includes('Bearer meta-token'));
    delete process.env.CHRONOS_METADATA_TOKEN_URL;
    // refusals: wrong key name, non-HSM key, a signature that is not from this key
    assert.throws(() => new KmsSigner('not-a-key-name'), /full key version name/);
    assert.throws(() => new KmsSigner(KEY, null, { endpoint: 'http://evil.example/v1/' }), /https/);
    assert.throws(() => parseDer(Buffer.from('3006020100020100', 'hex')), /malformed/);
  } finally { k.srv.close(); }
  const soft = await fakeKms({ protectionLevel: 'SOFTWARE' });
  try { await assert.rejects(new KmsSigner(KEY, null, { endpoint: soft.endpoint, token: async () => 'test-token' }).getAddress(), /must be HSM/); } finally { soft.srv.close(); }
  const wrong = await fakeKms({ otherKeySigns: true });
  try { await assert.rejects(new KmsSigner(KEY, null, { endpoint: wrong.endpoint, token: async () => 'test-token' }).signDigest(ethers.keccak256('0x01')), /does not recover/); } finally { wrong.srv.close(); }
});

// ---------------------------------------------------------------- your contract on a local chain
async function world() {
  const eth = ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, wallet: { deterministic: true, totalAccounts: 3 } });
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
  await (await ra.setRate(U, W, 5n * 10n ** 8n, 1n)).wait();             // 1000 USDC -> 0.5 WETH
  await (await rb.setRate(W, U, 2020n * 10n ** 6n, 10n ** 18n)).wait();  // 0.5 WETH -> 1010 USDC
  const now = (await bp.getBlock('latest')).timestamp;
  const runParams = { asset: U, amount: (1000n * 10n ** 6n).toString(), minProfit: (10n ** 6n).toString(), deadline: now + 600,
    legs: [{ dex: 0, router: await ra.getAddress(), tokenOut: W, fee: 500, minOut: '0' }, { dex: 0, router: await rb.getAddress(), tokenOut: U, fee: 500, minOut: '0' }] };
  const aave = { pool: await pool.getAddress(), flashEnabled: true, availableLiquidity: 10n ** 13n };
  const px = { assetPrice8: 100000000n, decimals: 6, ethPrice8: 200000000000n, gasPriceWei: (await bp.getFeeData()).gasPrice };
  return { eth, bp, owner, arb, A: await arb.getAddress(), U, W, ra, runParams, aave, px, usdc };
}

test('shadow test: every contract and flash-loan requirement is checked, and the contract itself computes the profit', async () => {
  const w = await world();
  const kms = await fakeKms();
  try {
    const executor = kms.address;
    // not an operator yet: the preflight names the exact owner call that fixes it, and nothing is simulated
    let r = await SH.run({ provider: w.bp, contract: w.A, executor, cand: { runParams: w.runParams, netUsd: 9 }, aave: w.aave, px: w.px, floorUsd: 0.35 });
    assert.strictEqual(r.win, false); assert.strictEqual(r.stage, 'preflight');
    assert.ok(r.failed.some((f) => f.name === 'executor is an operator' && f.fix === `owner: setOperator(${executor}, true)`));
    await (await w.arb.setOperator(executor, true)).wait();
    // too big for maxLoan, a router that is not allowed, a reserve that cannot flash-loan: each one named
    const big = { ...w.runParams, amount: (10n ** 13n).toString() };
    let pf = await SH.preflight({ provider: w.bp, contract: w.A, executor, params: big, aave: w.aave });
    assert.ok(pf.checks.find((c) => c.name === 'amount within maxLoan for the asset' && !c.ok));
    pf = await SH.preflight({ provider: w.bp, contract: w.A, executor, params: { ...w.runParams, legs: [{ ...w.runParams.legs[0], router: '0x000000000000000000000000000000000000bEEF' }, w.runParams.legs[1]] }, aave: w.aave });
    assert.ok(pf.checks.find((c) => c.name === 'every router allowed' && !c.ok && /setRouter\(0x000000000000000000000000000000000000bEEF/.test(c.fix)));
    pf = await SH.preflight({ provider: w.bp, contract: w.A, executor, params: w.runParams, aave: { ...w.aave, flashEnabled: false } });
    assert.ok(!pf.ok);
    // everything met: the contract's own return value is the profit (10 USDC gross − 0.5 USDC flash fee)
    r = await SH.run({ provider: w.bp, contract: w.A, executor, cand: { runParams: w.runParams, netUsd: 9 }, aave: w.aave, px: w.px, floorUsd: 0.35 });
    assert.strictEqual(r.stage, 'done'); assert.strictEqual(r.profit, String(9500000n)); assert.ok(r.win);
    assert.ok(Math.abs(r.netUsd - (9.5 - r.gasUsd)) < 1e-9 && r.gasUsd > 0, 'net is after gas at the live price');
    // a minProfit the market cannot pay: the contract's own error, decoded, and no win
    r = await SH.run({ provider: w.bp, contract: w.A, executor, cand: { runParams: { ...w.runParams, minProfit: (100n * 10n ** 6n).toString() }, netUsd: 9 }, aave: w.aave, px: w.px, floorUsd: 0.35 });
    assert.strictEqual(r.win, false); assert.match(r.error, /^Unprofitable\(|^Slippage\(/);
  } finally { kms.srv.close(); }
});

test('3-leg route through your real contract: the scan\'s call shape is accepted and the contract computes the profit', async () => {
  const w = await world();
  const kms = await fakeKms();
  try {
    const dep = async (n, ...a) => { const j = fx(n); const c = await new ethers.ContractFactory(j.abi, j.bytecode, w.owner).deploy(...a); await c.waitForDeployment(); return c; };
    const x = await dep('MockToken', 'ARB', 18); const X = await x.getAddress();
    const rc = await dep('MockRouter'), rd = await dep('MockRouter');
    for (const r of [rc, rd]) await (await w.arb.setRouter(await r.getAddress(), true)).wait();
    await (await x.mint(await rc.getAddress(), 10n ** 24n)).wait();
    await (await w.usdc.mint(await rd.getAddress(), 10n ** 13n)).wait();
    await (await rc.setRate(w.W, X, 4000n, 1n)).wait();                         // 0.5 WETH -> 2000 ARB
    await (await rd.setRate(X, w.U, 505n * 10n ** 6n, 10n ** 21n)).wait();      // 2000 ARB -> 1010 USDC
    await (await w.arb.setOperator(kms.address, true)).wait();
    const p = { ...w.runParams, legs: [w.runParams.legs[0], { dex: 0, router: await rc.getAddress(), tokenOut: X, fee: 3000, minOut: '0' }, { dex: 0, router: await rd.getAddress(), tokenOut: w.U, fee: 500, minOut: '0' }] };
    const pf = await SH.preflight({ provider: w.bp, contract: w.A, executor: kms.address, params: p, aave: w.aave });
    assert.ok(pf.ok, JSON.stringify(pf.checks.filter((c) => !c.ok)));
    assert.ok(pf.checks.find((c) => c.name === 'every router allowed' && c.ok));
    const r = await SH.run({ provider: w.bp, contract: w.A, executor: kms.address, cand: { runParams: p, netUsd: 9 }, aave: w.aave, px: w.px, floorUsd: 0.01 });
    assert.strictEqual(r.stage, 'done'); assert.strictEqual(r.profit, String(9500000n), '1010 back − 1000 borrowed − 0.5 flash fee, computed by the contract'); assert.ok(r.win);
    // a 5th leg is beyond the contract's MAX_LEGS: refused before anything is simulated
    const five = { ...p, legs: [...p.legs, p.legs[1], p.legs[2]] };
    const pf5 = await SH.preflight({ provider: w.bp, contract: w.A, executor: kms.address, params: five, aave: w.aave });
    assert.ok(pf5.checks.find((c) => c.name === 'legs within MAX_LEGS' && !c.ok));
  } finally { kms.srv.close(); }
});

test('live executor: KMS-signed, re-simulated, tip from surplus, recorded, verified from the receipt; refuses below the floor', async () => {
  const w = await world();
  const kms = await fakeKms();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-'));
  try {
    const signer = new KmsSigner(KEY, w.bp, { endpoint: kms.endpoint, token: async () => 'test-token' });
    const from = await signer.getAddress();
    const { policy } = readExecPolicy((k) => ({ MAX_DAILY_GAS_USD: '50' })[k]);
    const mk = (cfg) => new Executor({ provider: w.bp, signer, contract: w.A, policy, cfg: { MIN_NET_PROFIT_USD: 0.35, GAS_CEILING_GWEI: 100, DEADLINE_SECONDS: 120, ...cfg }, dataDir: dir });
    let ex = mk({});
    assert.match((await ex.readiness()).why, /not an operator/);
    await (await w.arb.setOperator(from, true)).wait();
    assert.match((await ex.readiness()).why, /ETH; needs/, 'no gas money, not ready');
    await (await w.owner.sendTransaction({ to: from, value: 10n ** 18n })).wait();
    assert.strictEqual((await ex.readiness()).ready, true);
    // a floor the trade cannot clear: nothing is signed or sent
    const before = kms.seen.signs;
    let r = await mk({ MIN_NET_PROFIT_USD: 50 }).execute({ cand: { runParams: w.runParams, routeKey: 'USDC>WETH|a|b' }, aave: w.aave, px: w.px });
    assert.strictEqual(r.sent, false); assert.match(r.reason, /below floor/); assert.strictEqual(kms.seen.signs, before);
    // today's spending cap is used up: a send whose revert could cost more is not signed
    const { Spend } = require('../lib/spend.cjs'); const spent = new Spend({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'cap-')), cap: 0 });
    r = await new Executor({ provider: w.bp, signer, contract: w.A, policy, cfg: { MIN_NET_PROFIT_USD: 0.35, GAS_CEILING_GWEI: 100, DEADLINE_SECONDS: 120 }, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'exec2-')), spend: spent }).execute({ cand: { runParams: w.runParams, routeKey: 'USDC>WETH|a|b' }, aave: w.aave, px: w.px });
    assert.strictEqual(r.sent, false); assert.match(r.reason, /CHRONOS_DAILY_SPEND_CAP_USD/); assert.strictEqual(kms.seen.signs, before, 'nothing signed over the cap');
    // the real thing
    r = await ex.execute({ cand: { runParams: w.runParams, routeKey: 'USDC>WETH|a|b' }, aave: w.aave, px: w.px });
    assert.strictEqual(r.sent, true, JSON.stringify(r)); assert.strictEqual(r.status, 'success');
    assert.ok(Math.abs(r.profitUsd - 9.5) < 1e-9 && r.netUsd > 0.35, 'profit from the Arbitrage event, net of the gas actually paid');
    const tx = await w.bp.getTransaction(r.txHash);
    assert.strictEqual(tx.from, from); assert.ok(tx.maxPriorityFeePerGas > 0n, 'priority fee bid from the surplus');
    // the on-chain minimum covers this send's own worst-case gas and bid plus the floor, so a trade that lands can
    // never net below the floor even if the market moves between the simulation and inclusion
    const sent = require('../lib/shadow.cjs').IFACE.parseTransaction({ data: tx.data });
    const minProfitUsd = Number(sent.args.find((a, i) => sent.fragment.inputs[i].name === 'minProfit')) / 1e6; // USDC, 6 dp, $1
    const worstUsd = Number(tx.gasLimit * tx.maxFeePerGas) / 1e18 * 2000; // WETH at $2,000 in this world
    assert.ok(minProfitUsd >= worstUsd + 0.35 - 1e-6, `minProfit $${minProfitUsd} covers worst gas+bid $${worstUsd} + floor`);
    const rec = fs.readFileSync(path.join(dir, 'executions.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.strictEqual(rec[0].txHash, r.txHash); assert.ok(rec[0].expectedNetUsd >= 0.35, 'even after the full bid the expected net clears the floor');
    // realized profit is verified independently from the receipt
    const assets = [{ address: w.U.toLowerCase(), symbol: 'USDC', decimals: 6, price8: 100000000n }, { address: w.W.toLowerCase(), symbol: 'WETH', decimals: 18, price8: 200000000000n }];
    const rz = await verifyRealized({ provider: w.bp, contract: w.A, hashes: rec.map((x) => x.txHash), assets, wethAddress: w.W, taxBps: 3000 });
    assert.strictEqual(rz.executions.length, 1); assert.ok(rz.profiting);
    assert.strictEqual(ex.today().succeeded, 1);
    // the same route right away: cooling down, nothing sent
    assert.match((await ex.execute({ cand: { runParams: w.runParams, routeKey: 'USDC>WETH|a|b' }, aave: w.aave, px: w.px })).reason, /cooling down/);
    // the owner pauses the contract: the requirement check stops it before signing
    await (await w.arb.pause()).wait();
    const s2 = kms.seen.signs;
    r = await mk({}).execute({ cand: { runParams: w.runParams, routeKey: 'other' }, aave: w.aave, px: w.px });
    assert.strictEqual(r.sent, false); assert.match(r.reason, /contract not paused/); assert.strictEqual(kms.seen.signs, s2);
  } finally { kms.srv.close(); }
});

test('mode switch: live only when every condition is met; back to shadow on any limit, with a hold', () => {
  const { policy } = readExecPolicy(() => undefined);
  const exec = { ready: true };
  const good = { runs: 10, sims: 8, wins: 6, winRate: 0.75, perDayUsd: 12, observedMin: 60 };
  const base = { policy, goMinUsdPerDay: 5, maxDailyDrawdownUsd: 25, exec, shadow: good, live: null };
  assert.strictEqual(MODE.evaluate(base).mode, 'LIVE');
  for (const [k, v] of [['exec', { ready: false, why: 'no key' }], ['shadow', { ...good, wins: 4 }], ['shadow', { ...good, winRate: 0.5 }], ['shadow', { ...good, perDayUsd: 4 }], ['shadow', { ...good, perDayUsd: null }]]) {
    const m = MODE.evaluate({ ...base, [k]: v });
    assert.strictEqual(m.mode, 'SHADOW', `${k} ${JSON.stringify(v)} keeps it in shadow`);
    assert.ok(m.next.some((c) => !c.met), 'the screen can show what is missing');
  }
  assert.strictEqual(MODE.evaluate({ ...base, policy: { ...policy, CHRONOS_MODE: 'shadow' } }).mode, 'SHADOW', 'CHRONOS_MODE=shadow never sends');
  const live = MODE.evaluate(base);
  const day = MODE.utcDay(Date.now());
  // any limit demotes: loss, reverts, revert gas, gas balance, kill switch
  for (const [extra, hold] of [[{ live: { day, netUsd: -30, sent: 3, gasUsd: 1, lossGasUsd: 0, consecutiveReverts: 0 } }, 'day'], [{ live: { day, netUsd: 1, sent: 3, gasUsd: 1, lossGasUsd: 0, consecutiveReverts: 3 } }, '30min'], [{ live: { day, netUsd: 1, sent: 3, gasUsd: 9, lossGasUsd: 6, consecutiveReverts: 0 } }, 'day'], [{ gasEth: 0.0001 }, 'none'], [{ killed: true }, 'none']]) {
    const m = MODE.evaluate({ ...base, ...extra, prev: live });
    assert.strictEqual(m.mode, 'SHADOW', JSON.stringify(extra));
    if (hold === 'day') assert.ok(m.heldUntil > Date.now() && new Date(m.heldUntil).toISOString().endsWith('T00:00:00.000Z'), 'money limits hold until the next UTC day');
    if (hold === '30min') assert.ok(Math.abs(m.heldUntil - Date.now() - 30 * 60000) < 5000);
    // while held, good shadow numbers do not switch it back
    if (m.heldUntil) assert.strictEqual(MODE.evaluate({ ...base, prev: m }).mode, 'SHADOW');
  }
  assert.match(MODE.summary(MODE.evaluate({ ...base, shadow: { ...good, wins: 2 } })), /^SHADOW · live when: wins 2\/5/);
  assert.match(MODE.summary(live), /^LIVE · today/);
  assert.strictEqual(readExecPolicy((k) => ({ EXEC_TIP_SHARE_BPS: '99999' })[k]).problems.length, 1, 'out-of-bounds limits are refused, not used');
});

test('balances: shown only when a second independent source agrees; disagreement shows no number', async () => {
  const w = await world();
  const holder = await w.owner.getAddress();
  const tokens = [{ address: w.U, symbol: 'USDC', decimals: 6 }];
  await (await w.usdc.mint(holder, 1234n * 10n ** 6n)).wait();
  const second = new ethers.BrowserProvider(w.eth); // another connection: in production another provider
  let b = await BAL.verifiedBalances({ primary: w.bp, secondary: second, accounts: [{ label: 'payout wallet', address: holder }], tokens });
  assert.strictEqual(b.source, 'second node, same block');
  assert.ok(b.rows[0].eth.verified && b.rows[0].eth.amount > 0);
  assert.deepStrictEqual(b.rows[0].tokens.map((t) => [t.symbol, t.verified, t.amount]), [['USDC', true, 1234]]);
  // a second source that disagrees: unverified, and the number is withheld
  const liar = new Proxy(second, { get: (t, k) => (k === 'getBalance' ? async () => 1n : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
  b = await BAL.verifiedBalances({ primary: w.bp, secondary: liar, accounts: [{ label: 'payout wallet', address: holder }], tokens });
  assert.strictEqual(b.rows[0].eth.verified, false); assert.strictEqual(b.rows[0].eth.amount, null);
  // the explorer as the second source (Blockscout API shape)
  const bal = await w.bp.getBalance(holder);
  const srv = http.createServer((req, res) => {
    if (req.url === `/api/v2/addresses/${holder}`) return res.end(JSON.stringify({ hash: holder, coin_balance: bal.toString() }));
    if (req.url === `/api/v2/addresses/${holder}/token-balances`) return res.end(JSON.stringify([{ token: { address_hash: w.U, decimals: '6', symbol: 'USDC' }, value: '1234000000', token_id: null }]));
    res.statusCode = 404; res.end('{}');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    b = await BAL.verifiedBalances({ primary: w.bp, blockscoutUrl: `http://127.0.0.1:${srv.address().port}`, accounts: [{ label: 'payout wallet', address: holder }], tokens });
    assert.strictEqual(b.source, 'Blockscout explorer'); assert.ok(b.rows[0].eth.verified); assert.strictEqual(b.rows[0].tokens[0].amount, 1234);
  } finally { srv.close(); }
  b = await BAL.verifiedBalances({ primary: w.bp, accounts: [{ label: 'payout wallet', address: holder }], tokens });
  assert.match(b.why, /no second source/); assert.strictEqual(b.rows[0].eth.amount, null);
  assert.ok(b.rows[0].tokens.length && b.rows[0].tokens.every((t) => !t.verified && t.amount === null), 'one source alone never shows a token balance');
  // a second node that disagrees on a token balance: that token shows no number
  const tokenLiar = new Proxy(second, { get: (t, k) => (k === 'call' ? async (tx) => (String(tx.data || '').startsWith('0x70a08231') ? ethers.toBeHex(1n, 32) : t.call(tx)) : k === 'send' ? async (m, p) => (m === 'eth_call' && String((p[0] || {}).data || '').startsWith('0x70a08231') ? ethers.toBeHex(1n, 32) : t.send(m, p)) : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
  b = await BAL.verifiedBalances({ primary: w.bp, secondary: tokenLiar, accounts: [{ label: 'payout wallet', address: holder }], tokens });
  assert.ok(b.rows[0].eth.verified, 'ETH still agrees');
  assert.deepStrictEqual(b.rows[0].tokens.map((t) => [t.symbol, t.verified, t.amount]), [['USDC', false, null]]);
});

test('after a node failover the executor reads, simulates and signs through the new node (it never stays on a dead one)', () => {
  const { Executor } = require('../lib/executor.cjs');
  const dead = { name: 'dead' }, fresh = { name: 'fresh' };
  const signer = { at: dead, connect(p) { return { ...this, at: p }; } };
  const ex = new Executor({ provider: dead, signer, contract: '0x' + '11'.repeat(20), policy: {}, cfg: {}, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rb-')) });
  ex.rebind(fresh);
  assert.strictEqual(ex.provider, fresh); assert.strictEqual(ex.signer.at, fresh, 'the signer follows the node');
});

test('a trade with no receipt in time is settled later: a revert still counts against reverts in a row, the gas cap and the spending cap', () => {
  const { Executor } = require('../lib/executor.cjs'); const { Spend } = require('../lib/spend.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settle-')); const spend = new Spend({ dataDir: dir, cap: 5 });
  const ex = new Executor({ provider: {}, signer: {}, contract: '0x' + '11'.repeat(20), policy: {}, cfg: {}, dataDir: dir, spend });
  const h = '0x' + 'ab'.repeat(32); ex.stats.pending.push(h); ex._save();
  const again = new Executor({ provider: {}, signer: {}, contract: '0x' + '11'.repeat(20), policy: {}, cfg: {}, dataDir: dir, spend });
  assert.deepStrictEqual(again.stats.pending, [h], 'pending trades survive a restart');
  assert.strictEqual(again.settle(h, { status: 'reverted', gasUsd: 0.4 }), true);
  assert.strictEqual(again.today().reverted, 1); assert.strictEqual(again.today().consecutiveReverts, 1);
  assert.ok(Math.abs(again.today().lossGasUsd - 0.4) < 1e-12); assert.ok(Math.abs(spend.today().byKind['gas-loss'] - 0.4) < 1e-12);
  assert.strictEqual(again.settle(h, { status: 'reverted', gasUsd: 0.4 }), false, 'never counted twice');
  assert.strictEqual(again.settle('0x' + 'cd'.repeat(32), { status: 'reverted', gasUsd: 9 }), false, 'a transaction that is not a pending trade of this executor is ignored');
});
