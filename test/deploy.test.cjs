'use strict';
// chronos deploy, end to end on a local test chain (synthetic chain, test only): the real `chronos deploy` code path
// with your real contract artifact, driven by scripted answers instead of a keyboard. The two keys below are
// ganache's public deterministic test keys; they hold nothing on any real network.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { ethers } = require('ethers');
const D = require('../lib/deploy.cjs');
const I = require('../lib/integrity.cjs');

const ROOT = path.join(__dirname, '..');
const NODE = process.execPath;
const TEST_OWNER_KEY = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'; // ganache account 0 (TEST-ONLY)
const TEST_OTHER_KEY = '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1'; // ganache account 1 (TEST-ONLY)

test('artifact: identical to the bytecode the execution tests run, source hash matches, tampering is refused', () => {
  const art = D.loadArtifact();
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ChronosFlashArb.json'), 'utf8'));
  assert.strictEqual(art.bytecode, fx.bytecode, 'what chronos deploy sends is exactly what the tests exercise');
  assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'contract', 'ChronosFlashArb.sol'), 'utf8')).digest('hex'), art.sourceSha256);
  assert.match(art.compiler, /^solc 0\.8\.24/); assert.strictEqual(art.settings.viaIR, true); assert.strictEqual(art.audited, false);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
  fs.writeFileSync(path.join(tmp, 'a.json'), JSON.stringify({ ...art, bytecode: art.bytecode.slice(0, -2) + '00' }));
  assert.throws(() => D.loadArtifact(path.join(tmp, 'a.json')), /does not match its recorded sha256/);
});

test('loan cap: largest ladder size plus headroom at the oracle price, rounded up, exact integer math', () => {
  // $25,000 × 1.20 at $1.00 (USDC, 6 decimals) = 30,000 USDC
  assert.strictEqual(D.capFor({ maxUsd: 25000, headroomPct: 20, decimals: 6, price8: 100000000n }), 30000n * 10n ** 6n);
  // $25,000 × 1.20 at $3,000 (WETH, 18 decimals) = 10 WETH
  assert.strictEqual(D.capFor({ maxUsd: 25000, headroomPct: 20, decimals: 18, price8: 300000000000n }), 10n * 10n ** 18n);
  // rounds up, never down: the largest trade is never refused by a cap one unit too small
  assert.strictEqual(D.capFor({ maxUsd: 1, headroomPct: 0, decimals: 0, price8: 300000000n }), 1n);
  const p = D.readDeployPolicy((k) => ({ MAX_LOAN_HEADROOM_PCT: '500', EXEC_GAS_TOPUP_ETH: '0.01' })[k]);
  assert.strictEqual(p.policy.MAX_LOAN_HEADROOM_PCT, 20); assert.strictEqual(p.policy.EXEC_GAS_TOPUP_ETH, 0.01); assert.strictEqual(p.problems.length, 1);
});

function sealedCopy() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-deploy-'));
  for (const f of I.codeFiles()) { const d = path.join(tmp, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), d); fs.chmodSync(d, 0o644); }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
  const r = spawnSync(NODE, [path.join(tmp, 'bin', 'chronos.cjs'), 'seal', '--yes'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  return tmp;
}
async function devchain() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const p = spawn(NODE, [path.join(ROOT, 'test', 'devchain.cjs')], { cwd: ROOT, env: { ...process.env, DEVCHAIN_PORT: String(port) }, stdio: ['ignore', 'pipe', 'ignore'] });
  const line = await new Promise((res, rej) => {
    let buf = ''; const t = setTimeout(() => rej(new Error('devchain timeout')), 90000);
    p.stdout.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i >= 0) { clearTimeout(t); res(buf.slice(0, i)); } });
    p.on('exit', (c) => rej(new Error('devchain exited ' + c)));
  });
  return { proc: p, env: JSON.parse(line), port };
}
// runs the real `chronos deploy` code in its own process with scripted answers
function runDeploy(copy, env, { answer = 'YES', planOnly = false, v2 = false, key = TEST_OWNER_KEY } = {}) {
  const runner = path.join(copy, 'deploy-runner.cjs');
  fs.writeFileSync(runner, `const { runDeploy } = require('./tui/deploy.cjs');
runDeploy({ planOnly: ${planOnly}, v2: ${v2}, ask: { secret: async () => { throw new Error('no prompt expected'); }, input: async () => ${JSON.stringify(answer)} }, svc: { restartIfRunning: () => false } })
  .then((c) => process.exit(c)).catch((e) => { console.log('ERROR ' + e.message); process.exit(9); });`);
  const r = spawnSync(NODE, [runner], { cwd: copy, encoding: 'utf8', timeout: 180000, env: { ...process.env, ...env, DEPLOYER_PRIVATE_KEY: key } });
  fs.unlinkSync(runner);
  return { code: r.status, out: r.stdout + r.stderr };
}

test('chronos deploy: plan only → refused → deployed and set up → second run sends nothing → wrong owner refused', { timeout: 600000 }, async () => {
  const dc = await devchain();
  const copy = sealedCopy();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-deploy-data-'));
  const executor = ethers.Wallet.createRandom().address;
  const env = { ...dc.env, CHRONOS_DATA_DIR: data, CHRONOS_EXECUTOR_ADDRESS: executor, EXEC_GAS_TOPUP_ETH: '0.005' };
  const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${dc.port}`, 42161, { staticNetwork: true, cacheTimeout: -1 });
  try {
    // 1. --plan: real gas estimate and cost, nothing sent, .env untouched
    const before = fs.readFileSync(dc.env.ENV_FILE, 'utf8');
    // 0. --v2 on a chain without Balancer: refused with the reason, nothing sent, .env untouched
    const r0 = runDeploy(copy, env, { planOnly: true, v2: true });
    assert.strictEqual(r0.code, 1, r0.out); assert.match(r0.out, /ChronosFlashArbV2/); assert.match(r0.out, /Balancer V2 was not found.*Nothing was sent/);
    assert.strictEqual(fs.readFileSync(dc.env.ENV_FILE, 'utf8'), before);
    let r = runDeploy(copy, env, { planOnly: true });
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /1 transaction: deploy ChronosFlashArb/); assert.match(r.out, /at most \d+\.\d{6} ETH/); assert.match(r.out, /--plan: nothing sent/);
    assert.strictEqual(fs.readFileSync(dc.env.ENV_FILE, 'utf8'), before);
    assert.ok(!r.out.includes(TEST_OWNER_KEY.slice(2, 20)), 'the key is never printed');
    // 2. anything but YES sends nothing
    r = runDeploy(copy, env, { answer: 'yes please' });
    assert.strictEqual(r.code, 1); assert.match(r.out, /Not sent/);
    assert.strictEqual(fs.readFileSync(dc.env.ENV_FILE, 'utf8'), before);
    // 3. YES: deployed, configured, written to .env
    r = runDeploy(copy, env);
    assert.strictEqual(r.code, 0, r.out);
    const addr = (fs.readFileSync(dc.env.ENV_FILE, 'utf8').match(/^CHRONOS_FLASH_ARB_ADDRESS=(0x[0-9a-fA-F]{40})$/m) || [])[1];
    assert.ok(addr, 'contract address written to .env\n' + r.out);
    const c = new ethers.Contract(addr, D.IFACE, provider);
    const owner = new ethers.Wallet(TEST_OWNER_KEY).address;
    assert.strictEqual(await c.owner(), owner);
    assert.strictEqual((await c.POOL()).toLowerCase(), dc.env.CHRONOS_AAVE_POOL.toLowerCase());
    assert.strictEqual(await c.operators(executor), true);
    const venues = JSON.parse(fs.readFileSync(dc.env.CHRONOS_VENUES_FILE, 'utf8')).venues;
    const sushi = venues.find((v) => v.id === 'sushi_v2').router;
    assert.strictEqual(await c.allowedRouters(sushi), true, 'executable router that passed its check is allowed');
    const camelot = venues.find((v) => v.id === 'camelot_v2');
    if (camelot.router.toLowerCase() !== sushi.toLowerCase()) assert.strictEqual(await c.allowedRouters(camelot.router), false, 'a non-executable venue is never allowed');
    const capLines = r.out.split('\n').filter((l) => /setMaxLoan\(/.test(l));
    assert.ok(capLines.length >= 1, r.out);
    assert.strictEqual(await provider.getBalance(executor), ethers.parseEther('0.005'), 'executor topped up to exactly the target');
    const log = fs.readFileSync(path.join(data, 'deployments.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const confirmed = log.filter((x) => x.state === 'confirmed');
    assert.ok(confirmed.length >= 4 && confirmed.every((x) => x.status === 1 && /^0x[0-9a-f]{64}$/.test(x.txHash)));
    // 4. second run: everything already in place, nothing sent
    r = runDeploy(copy, { ...env, ...{ } });
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /Nothing left to send/);
    assert.strictEqual(fs.readFileSync(path.join(data, 'deployments.jsonl'), 'utf8').trim().split('\n').length, log.length, 'no new transaction');
    // 5. a different wallet is refused before anything is sent
    r = runDeploy(copy, env, { key: TEST_OTHER_KEY });
    assert.strictEqual(r.code, 9); assert.match(r.out, /is owned by .*not by the wallet you unlocked/);
    // 5b. CONTRACT_ADDRESS that belongs to something else (here the test pool) is left alone, and yours is deployed
    const data2 = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-deploy-data2-'));
    const envText = fs.readFileSync(dc.env.ENV_FILE, 'utf8').replace(/^CHRONOS_FLASH_ARB_ADDRESS=.*\n/m, '') + `CONTRACT_ADDRESS=${dc.env.CHRONOS_AAVE_POOL}\n`;
    fs.writeFileSync(dc.env.ENV_FILE, envText, { mode: 0o600 });
    r = runDeploy(copy, { ...env, CHRONOS_DATA_DIR: data2 });
    assert.strictEqual(r.code, 0, r.out); assert.match(r.out, /CONTRACT_ADDRESS .* is not a ChronosFlashArb/);
    const after = fs.readFileSync(dc.env.ENV_FILE, 'utf8');
    assert.match(after, new RegExp(`^CONTRACT_ADDRESS=${dc.env.CHRONOS_AAVE_POOL}$`, 'm'), 'the other tool\'s address is left as it was');
    assert.match(after, /^CHRONOS_FLASH_ARB_ADDRESS=0x[0-9a-fA-F]{40}$/m);
    // 5c. through the real command: a refusal is one clear line, never a crash trace, and says nothing was sent
    const bad = ethers.Wallet.createRandom().address;
    const rb = spawnSync(NODE, [path.join(copy, 'bin', 'chronos.cjs'), 'deploy', '--plan'], { encoding: 'utf8', timeout: 180000, env: { ...process.env, ...env, CHRONOS_FLASH_ARB_ADDRESS: bad, DEPLOYER_PRIVATE_KEY: TEST_OWNER_KEY } });
    assert.strictEqual(rb.status, 1); assert.match(rb.stdout, /✗ .*has no contract on Arbitrum One.*nothing was sent/s); assert.ok(!/\n\s+at /.test(rb.stdout + rb.stderr), 'no stack trace');
    // 6. an address in .env without a contract is refused (never "deploys over" it)
    const empty = ethers.Wallet.createRandom().address;
    r = runDeploy(copy, { ...env, CHRONOS_FLASH_ARB_ADDRESS: empty });
    assert.strictEqual(r.code, 9); assert.match(r.out, /has no contract on Arbitrum One/);
  } finally { dc.proc.kill(); provider.destroy(); }
});

test('cloud-pack exports settings and public addresses only: no secret, no signing key, no executor', () => {
  const CP = require('../lib/cloudpack.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-'));
  const env = path.join(dir, '.env');
  fs.writeFileSync(env, ['ARB_RPC_URL=https://arb.example/SECRETNODE', 'ARB_RPC_URL_2=https://b.example/SECRET2', 'OPENROUTER_API_KEY=sk-or-v1-SECRETKEY',
    'CHRONOS_WEBHOOK_URL=https://hook.example/SECRETHOOK', 'PRIVATE_KEY=0x' + '11'.repeat(32), 'DEPLOYER_PRIVATE_KEY=0x' + '22'.repeat(32),
    'CHRONOS_EXECUTOR_ADDRESS=0x' + '33'.repeat(20), 'CHRONOS_EXECUTOR_KMS_KEY=projects/x/locations/y/keyRings/z/cryptoKeys/k/cryptoKeyVersions/1',
    'MIN_NET_PROFIT_USD=0.5', 'SIZE_LADDER_USD=200,500', 'EXEC_TIP_SHARE_BPS=6000', 'GUARD_MIN_SENDS=7', 'MAX_LOAN_HEADROOM_PCT=10',
    'CHRONOS_FLASH_ARB_ADDRESS=0x' + '44'.repeat(20), 'PAYOUT_WALLET_ADDRESS=0x' + '55'.repeat(20)].join('\n') + '\n');
  const r = CP.writePack(env, dir);
  const text = fs.readFileSync(r.file, 'utf8');
  for (const bad of ['SECRET', 'sk-or', '11'.repeat(32), '22'.repeat(32), '33'.repeat(20), 'cryptoKeys']) assert.ok(!text.includes(bad), 'leaked ' + bad);
  for (const good of ['MIN_NET_PROFIT_USD=0.5', 'SIZE_LADDER_USD=200,500', 'EXEC_TIP_SHARE_BPS=6000', 'GUARD_MIN_SENDS=7', 'MAX_LOAN_HEADROOM_PCT=10', 'CHRONOS_FLASH_ARB_ADDRESS=0x' + '44'.repeat(20)]) assert.ok(text.includes(good), 'missing ' + good);
  assert.strictEqual(fs.statSync(r.file).mode & 0o777, 0o600);
  assert.ok(r.missing.includes('GAS_CEILING_GWEI'), 'unset required settings are reported, not invented');
});

test('chronos set: refuses signing keys, secrets on the command line and unknown keys; checks bounds; writes 600', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'set-'));
  const env = path.join(dir, '.env'); fs.writeFileSync(env, 'MIN_NET_PROFIT_USD=0.35\n', { mode: 0o644 });
  const run = (...a) => spawnSync(NODE, [path.join(ROOT, 'bin', 'chronos.cjs'), 'set', ...a], { encoding: 'utf8', env: { ...process.env, ENV_FILE: env, PM2_HOME: path.join(dir, 'pm2') } });
  let r = run('PRIVATE_KEY', '0xabc'); assert.strictEqual(r.status, 2); assert.match(r.stdout, /never stores one/);
  r = run('OPENROUTER_API_KEY', 'sk-or-v1-x'); assert.strictEqual(r.status, 2); assert.match(r.stdout, /hidden prompt/);
  r = run('NOT_A_KEY', '1'); assert.strictEqual(r.status, 2);
  r = run('EXEC_TIP_SHARE_BPS', '9999'); assert.strictEqual(r.status, 1); assert.match(r.stdout, /not saved/);
  r = run('MIN_NET_PROFIT_USD', 'abc'); assert.strictEqual(r.status, 1);
  r = run('CHRONOS_EXECUTOR_ADDRESS', 'not-an-address'); assert.strictEqual(r.status, 1);
  assert.strictEqual(fs.readFileSync(env, 'utf8'), 'MIN_NET_PROFIT_USD=0.35\n', 'nothing written by a refused set');
  r = run('EXEC_TIP_SHARE_BPS', '6000'); assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  r = run('CHRONOS_EXECUTOR_ADDRESS', '0x' + 'ab'.repeat(20)); assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  const text = fs.readFileSync(env, 'utf8');
  assert.match(text, /^EXEC_TIP_SHARE_BPS=6000$/m); assert.match(text, /^CHRONOS_EXECUTOR_ADDRESS=0x(ab){20}$/m); assert.match(text, /^MIN_NET_PROFIT_USD=0\.35$/m);
  assert.strictEqual(fs.statSync(env).mode & 0o777, 0o600);
});

test('integrity: a file that is not part of the release is reported as foreign (code stays valid; you are told what it is)', () => {
  const copy = sealedCopy();
  const run = () => JSON.parse(spawnSync(NODE, ['-e', "console.log(JSON.stringify(require('./lib/integrity.cjs').verify()))"], { cwd: copy, encoding: 'utf8' }).stdout);
  let v = run(); assert.strictEqual(v.ok, true); assert.deepStrictEqual(v.foreign, []);
  fs.mkdirSync(path.join(copy, 'scripts')); fs.writeFileSync(path.join(copy, 'scripts', 'evidence_policy_adjuster.cjs'), '// not chronos\n');
  fs.mkdirSync(path.join(copy, 'data'), { recursive: true }); fs.writeFileSync(path.join(copy, 'data', 'mine.json'), '{}'); // your data is never "foreign"
  v = run(); assert.strictEqual(v.ok, true); assert.deepStrictEqual(v.foreign, ['scripts/evidence_policy_adjuster.cjs']);
  const d = spawnSync(NODE, [path.join(copy, 'bin', 'chronos.cjs'), 'verify'], { cwd: copy, encoding: 'utf8' });
  assert.match(d.stdout, /1 file\(s\) in the Chronos folder are not part of this release.*evidence_policy_adjuster/);
});

test('integrity: every contract, artifact, probe, cloud script and server file is sealed (none can ship unprotected)', () => {
  const sealed = new Set(I.codeFiles());
  const all = ['contract', 'contracts', 'cloud', 'server'].flatMap((d) => { const out = []; const walk = (p) => { for (const e of fs.readdirSync(path.join(ROOT, p), { withFileTypes: true })) e.isDirectory() ? walk(path.join(p, e.name)) : out.push(path.join(p, e.name)); }; if (fs.existsSync(path.join(ROOT, d))) walk(d); return out; });
  assert.ok(all.length >= 7);
  assert.deepStrictEqual(all.filter((f) => !sealed.has(f)), []);
});

test('every shipped contract can be priced and deployed with the same constructor arguments (the deploy screen once priced v2.2 with 2)', async () => {
  const { ethers } = require('ethers'); const Dp = require('../lib/deploy.cjs');
  const A = '0x' + '11'.repeat(20), V = '0x' + '22'.repeat(20), M = '0x' + '33'.repeat(20), P4 = '0x' + '44'.repeat(20);
  for (const f of [Dp.ARTIFACT, Dp.ARTIFACT_V2]) {
    const art = Dp.loadArtifact(f);
    const n = art.abi.find((x) => x.type === 'constructor').inputs.length;
    const args = Dp.ctorArgs(art, A, { vault: V, morpho: M, v4: P4 });
    assert.strictEqual(args.length, n, `${path.basename(f)}: one argument per constructor input`);
    const tx = await new ethers.ContractFactory(art.abi, art.bytecode).getDeployTransaction(...args); // the price shown before YES
    assert.ok(tx.data.startsWith(art.bytecode), 'the priced transaction deploys exactly this bytecode');
  }
  const v2 = Dp.loadArtifact(Dp.ARTIFACT_V2);
  assert.deepStrictEqual(Dp.ctorArgs(v2, A, {}).slice(1), Array(v2.abi.find((x) => x.type === 'constructor').inputs.length - 1).fill(ethers.ZeroAddress), 'unset lenders are the zero address ("not used")');
  const five = { abi: [{ type: 'constructor', inputs: [1, 2, 3, 4, 5].map((i) => ({ name: 'a' + i, type: 'address' })) }] };
  assert.throws(() => Dp.ctorArgs(five, A), /takes 5 arguments/, 'an unknown constructor is refused, never guessed');
});
