'use strict';
// Persistence without plaintext: the owner key kept in the standard Ethereum keystore (scrypt + AES, unlocked by your
// passphrase), a sealed settings bundle (scrypt + AES-256-GCM) that carries every setting to a new device and never a
// private key in plaintext, and deploy/payout asking for the passphrase instead of the key. Real counterpart: the
// keystore format is ethers' (the one MetaMask and geth import), opened here by ethers itself.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ethers } = require('ethers');
const KS = require('../lib/keystore.cjs');
const KY = require('../tui/keys.cjs');
const { ownerWallet } = require('../tui/owner.cjs');
const PK = '0x' + '11'.repeat(32); const ADDR = new ethers.Wallet(PK).address;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ks-'));
const fastN = 1 << 10; // a cheap scrypt cost for tests only; real keystores use ethers' default

test('the owner key is kept encrypted, readable only with the passphrase, never in plaintext, never deleted', async () => {
  const dir = tmp();
  await assert.rejects(KS.saveOwner(dir, PK, 'short'), /at least 10 characters/);
  assert.strictEqual(await KS.saveOwner(dir, PK, 'correct horse battery', { scryptN: fastN }), ADDR);
  const raw = fs.readFileSync(KS.fileOf(dir), 'utf8');
  assert.ok(!raw.includes(PK.slice(2)), 'the key is not in the file'); assert.strictEqual((fs.statSync(KS.fileOf(dir)).mode & 0o777).toString(8), '600');
  assert.strictEqual(KS.ownerAddress(dir), ADDR, 'the address is readable without the passphrase');
  assert.strictEqual((await KS.unlockOwner(dir, 'correct horse battery')).address, ADDR);
  await assert.rejects(KS.unlockOwner(dir, 'wrong horse battery'));
  assert.strictEqual((await ethers.Wallet.fromEncryptedJson(raw, 'correct horse battery')).privateKey, PK, 'standard keystore: ethers itself opens it');
  await KS.saveOwner(dir, '0x' + '22'.repeat(32), 'another long passphrase', { scryptN: fastN });
  assert.ok(fs.readdirSync(path.dirname(KS.fileOf(dir))).some((f) => /owner\.json\.replaced-\d+/.test(f)), 'the old keystore is moved aside, not deleted');
});

test('the settings bundle restores every setting with one passphrase and never carries a private key in plaintext', async () => {
  const a = tmp(), b = tmp(); const envA = path.join(a, '.env'), envB = path.join(b, '.env');
  fs.writeFileSync(envA, `ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/k\nTAX_RESERVE_VAULT=0x${'1'.repeat(40)}\nDEPLOYER_PRIVATE_KEY=${PK}\nOPENROUTER_API_KEY=sk-or-abc\n`, { mode: 0o600 });
  await KS.saveOwner(a, PK, 'correct horse battery', { scryptN: fastN });
  const said = []; const P = (answers) => ({ secret: async () => answers.shift() });
  const out = path.join(a, 'chronos-keys.enc');
  assert.strictEqual(await KY.exportBundle({ envFile: envA, dataDir: a, out, P: P(['correct horse battery', 'correct horse battery']), log: (s) => said.push(s) }), 0);
  const sealed = fs.readFileSync(out, 'utf8');
  for (const plain of ['alchemy', 'sk-or-abc', PK.slice(2), '1111111111']) assert.ok(!sealed.includes(plain), 'nothing readable in the bundle: ' + plain);
  const opened = KS.open(sealed, 'correct horse battery');
  assert.ok(!opened.entries.some((e) => /PRIVATE_KEY/.test(e.key)), 'no private key in the bundle'); assert.ok(opened.ownerJson && !opened.ownerJson.includes(PK.slice(2)), 'the keystore travels still encrypted');
  assert.throws(() => KS.open(sealed, 'wrong passphrase here'), /wrong passphrase/);
  const t = JSON.parse(sealed); t.data = Buffer.from('x' + Buffer.from(t.data, 'base64').toString('latin1').slice(1), 'latin1').toString('base64');
  assert.throws(() => KS.open(JSON.stringify(t), 'correct horse battery'), /wrong passphrase, or the file was changed/, 'a changed bundle is refused');
  fs.writeFileSync(envB, 'OPENROUTER_API_KEY=sk-or-mine\n', { mode: 0o600 });
  assert.strictEqual(await KY.importBundle({ file: out, envFile: envB, dataDir: b, P: P(['nope nope nope', 'correct horse battery']), log: (s) => said.push(s), test: async (k) => (k === 'TAX_RESERVE_VAULT' ? { ok: true } : null) }), 0);
  const envText = fs.readFileSync(envB, 'utf8');
  assert.match(envText, /^ARBITRUM_RPC_URL=https:\/\/arb-mainnet\.g\.alchemy\.com\/v2\/k$/m); assert.match(envText, /^OPENROUTER_API_KEY=sk-or-mine$/m, 'a value already set here is kept');
  assert.ok(!/PRIVATE_KEY/.test(envText)); assert.strictEqual(KS.ownerAddress(b), ADDR, 'owner keystore restored');
  assert.match(said.at(-1), /2 added · 1 already set here \(kept\) · owner keystore restored/);
});

test('deploy and payouts ask for the passphrase instead of the key; three wrong ones send nothing', async () => {
  const dir = tmp(); await KS.saveOwner(dir, PK, 'correct horse battery', { scryptN: fastN });
  const log = []; const ans = (xs) => ({ secret: async () => xs.shift() });
  const ok = await ownerWallet({ P: ans(['wrong one here', 'correct horse battery']), get: () => '', provider: null, dataDir: dir, log: (s) => log.push(s), signingKeys: ['DEPLOYER_PRIVATE_KEY'] });
  assert.strictEqual(ok.wallet.address, ADDR); assert.strictEqual(ok.from, 'keystore');
  const no = await ownerWallet({ P: ans(['a wrong one', 'b wrong one', 'c wrong one']), get: () => '', provider: null, dataDir: dir, log: (s) => log.push(s), signingKeys: [] });
  assert.strictEqual(no, null); assert.match(log.at(-1), /Three wrong passphrases: nothing was sent/);
  // no keystore: a typed key, then the offer to keep it encrypted
  const d2 = tmp(); const P2 = { secret: async (l) => (/private key/.test(l) ? PK : 'correct horse battery'), confirm: async () => true };
  const typed = await ownerWallet({ P: P2, get: () => '', provider: null, dataDir: d2, log: () => {}, signingKeys: [] });
  assert.strictEqual(typed.from, 'typed'); assert.strictEqual(KS.ownerAddress(d2), ADDR, 'kept encrypted for next time');
});

test('every phone gets its own engine name on your server (the start of its pairing code), not "localhost"', () => {
  const { execFileSync } = require('child_process');
  const name = (home) => execFileSync(process.execPath, ['-e', "console.log(require('./lib/device.cjs').engineName('localhost') + ' ' + require('./lib/device.cjs').engineName('vdizzle'))"], { cwd: path.join(__dirname, '..'), env: { ...process.env, HOME: home, CHRONOS_DEVICE_KEY: path.join(home, 'device.key') } }).toString().trim();
  const a = name(tmp()), b = name(tmp());
  assert.match(a, /^localhost-[A-Z2-9]{4} vdizzle$/); assert.match(b, /^localhost-[A-Z2-9]{4} vdizzle$/);
  assert.notStrictEqual(a, b, 'two phones, two names'); assert.match(require('fs').readFileSync(path.join(__dirname, '..', 'lib', 'daemon.cjs'), 'utf8'), /service: 'chronos-engine@' \+ DV\.engineName\(\)/);
});

test('a hidden prompt hands the terminal back after the answer (no frozen terminal), and chronos set exits', async () => {
  const { EventEmitter } = require('events');
  const raw = []; let paused = false;
  const fake = Object.assign(new EventEmitter(), { isTTY: true, setRawMode: (b) => raw.push(b), resume: () => { paused = false; }, pause: () => { paused = true; }, setEncoding: () => {} });
  const real = Object.getOwnPropertyDescriptor(process, 'stdin');
  Object.defineProperty(process, 'stdin', { value: fake, configurable: true });
  const w = process.stdout.write; process.stdout.write = () => true;
  try {
    delete require.cache[require.resolve('../tui/prompt.cjs')]; const P = require('../tui/prompt.cjs');
    const got = P.secret('key', 'hint'); fake.emit('data', 'abc123'); fake.emit('data', '\r');
    assert.strictEqual(await got, 'abc123');
    assert.deepStrictEqual(raw, [true, false], 'raw mode on for the prompt, off after it'); assert.ok(paused, 'input paused: the process can exit');
    assert.strictEqual(fake.listenerCount('data'), 0);
  } finally { process.stdout.write = w; Object.defineProperty(process, 'stdin', real); }
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'bin', 'chronos.cjs'), 'utf8');
  assert.match(src, /const r = require\('\.\.\/lib\/service\.cjs'\)\.restartSoon\(\);[\s\S]{0,200}\n  \}\n  process\.exit\(0\);\n\}/, 'chronos set never waits on PM2 and always ends');
  assert.match(require('fs').readFileSync(path.join(__dirname, '..', 'lib', 'service.cjs'), 'utf8'), /spawn\(bin, \['restart', NAME, '--update-env'\], \{ detached: true, stdio: 'ignore' \}\); c\.unref\(\)/);
});

test('a node url that does not answer fails its test in seconds and lets the command finish (no retry loop)', async () => {
  const C = require('../lib/catalog.cjs');
  const t0 = Date.now(); const r = await C.testRpc('http://127.0.0.1:9/rpc');
  assert.strictEqual(r.ok, false); assert.ok(Date.now() - t0 < 9000);
  const { execFileSync } = require('child_process');
  const out = execFileSync(process.execPath, ['-e', "require('./lib/catalog.cjs').testRpc('http://127.0.0.1:9/rpc').then((r) => console.log('done', r.ok))"], { cwd: path.join(__dirname, '..'), timeout: 20000 }).toString();
  assert.match(out, /^done false/); assert.ok(!/failed to detect network/.test(out), 'no detect-network retry loop');
});
