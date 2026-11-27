'use strict';
// The executor hand-off: the cloud engine offers the address it derived from its KMS key; this phone saves it
// (chronos executor, chronos mainnet) with nothing copied by hand. Only well-formed offers are used, the newest wins,
// and nothing is ever sent on chain here. Real counterpart: kms-signer in chronos verify-real (the cloud engine's own
// key gives that address) and the operator/gas step of chronos deploy, shown and sent only on YES.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('../lib/handoff.cjs');
const { runMainnet } = require('../tui/mainnet.cjs');

const KEY = 'projects/my-proj/locations/us-east4/keyRings/chronos/cryptoKeys/executor/cryptoKeyVersions/1';
const A = (n) => '0x' + String(n).repeat(40);

test('only a well-formed offer is used; the newest wins and the others are named', () => {
  assert.strictEqual(H.choose([]), null);
  assert.strictEqual(H.choose([{ address: 'nope', kms_key: KEY }, { address: A(1), kms_key: 'projects/x' }]), null, 'malformed offers are never used');
  const c = H.choose([{ device: 'chronos-engine', address: A('a'), kms_key: KEY }, { device: 'old-vm', address: A('b'), kms_key: KEY }, { device: 'x', address: A('a'), kms_key: KEY }]);
  assert.strictEqual(c.address.toLowerCase(), A('a')); assert.strictEqual(c.device, 'chronos-engine');
  assert.deepStrictEqual(c.others, [A('b')]);
});

test('chronos executor saves both values once and says what is next; it reports when nothing is offered', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ho-')); const env = path.join(dir, '.env');
  fs.writeFileSync(env, 'ARB_RPC_URL=https://x\n', { mode: 0o600 });
  const out = []; const log = (s) => out.push(s);
  assert.strictEqual(await H.run({ envFile: env, executors: async () => [], log }), 1);
  assert.match(out.join('\n'), /approve the device "chronos-engine"/);
  assert.strictEqual(await H.run({ envFile: env, executors: async () => { const e = new Error('device pending'); e.status = 403; throw e; }, log }), 1);
  assert.match(out.join('\n'), /not approved: chronos device/);
  assert.strictEqual(await H.run({ envFile: env, executors: async () => [{ device: 'chronos-engine', address: A('c'), kms_key: KEY }], log }), 0);
  const txt = fs.readFileSync(env, 'utf8');
  assert.match(txt, new RegExp(`^CHRONOS_EXECUTOR_KMS_KEY=${KEY.replace(/\//g, '\\/')}$`, 'm'));
  assert.match(txt, /^CHRONOS_EXECUTOR_ADDRESS=0x[cC]{40}$/m); assert.match(txt, /^ARB_RPC_URL=https:\/\/x$/m, 'other settings kept');
  assert.strictEqual((fs.statSync(env).mode & 0o777).toString(8), '600', 'S0: .env stays mode 600');
  await H.run({ envFile: env, executors: async () => [{ device: 'chronos-engine', address: A('c'), kms_key: KEY }], log });
  assert.match(out.at(-2), /already saved/);
  assert.match(out.join('\n'), /chronos mainnet \(makes it an operator/);
});

test('chronos mainnet picks up the offered executor instead of asking you to paste it, then makes it an operator', async () => {
  const e = { ARB_RPC_URL: 'https://n', ARBITRUM_WSS_URL: 'wss://x', TAX_RESERVE_VAULT: A(1), PAYOUT_WALLET_ADDRESS: A(2), CHRONOS_FLASH_ARB_ADDRESS: A(9) }; const calls = []; const out = [];
  const o = await runMainnet({
    version: '2.9.0', onPhone: true, get: (k) => e[k] || '', log: (s) => out.push(s), device: async () => ({ status: 'approved' }),
    realcheck: () => ({ results: [{ id: 'contract-v2-probe', status: 'pass' }] }), contractKind: async () => 2,
    executors: async () => [{ device: 'chronos-engine', address: A(7), kms_key: KEY }],
    run: (a) => { calls.push(a.join(' ')); if (a[0] === 'executor') { e.CHRONOS_EXECUTOR_ADDRESS = A(7); e.CHRONOS_EXECUTOR_KMS_KEY = KEY; } return 0; },
  });
  assert.deepStrictEqual(calls, ['phone', 'verify-real', 'executor', 'deploy --v2']);
  assert.ok(!calls.some((c) => c.startsWith('set CHRONOS_EXECUTOR')), 'nothing to paste');
  assert.ok(o.done.includes('executor ' + A(7)));
  // offline or not approved: falls back to the paste prompt
  const e2 = { ...e }; delete e2.CHRONOS_EXECUTOR_ADDRESS; delete e2.CHRONOS_EXECUTOR_KMS_KEY; const calls2 = [];
  await runMainnet({ version: '2.9.0', onPhone: true, get: (k) => e2[k] || '', log: () => {}, device: async () => ({ status: 'approved' }), realcheck: () => ({ results: [{ id: 'contract-v2-probe', status: 'pass' }] }), contractKind: async () => 2,
    executors: async () => { throw new Error('offline'); }, run: (a) => { calls2.push(a.join(' ')); return a[0] === 'set' ? 1 : 0; } });
  assert.ok(calls2.includes('set CHRONOS_EXECUTOR_ADDRESS'));
});

test('the cloud engine offers its executor once approved, and the phone is told when one is ready', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'daemon.cjs'), 'utf8');
  assert.match(src, /new KmsSigner\(kmsKey, S\.st\.provider\)\.getAddress\(\);\s*await DV\.offerExecutor\(a, kmsKey\)/, 'the address offered is the one the KMS key itself gives');
  assert.match(src, /if \(S\.device\.status !== 'approved'\) return;/, 'only an approved engine offers');
  assert.match(src, /action: 'chronos executor'/);
  const sh = fs.readFileSync(path.join(__dirname, '..', 'cloud', 'gcp-setup.sh'), 'utf8');
  assert.match(sh, /chronos-executor\.sh/); assert.match(sh, /cloudshell download/);
});
