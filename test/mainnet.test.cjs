'use strict';
// chronos mainnet: the right next step for every state, nothing skipped, nothing repeated, contract v2 offered only
// after its real-protocol checks pass, and the Cloud Shell hand-off printed when the executor is missing.
const test = require('node:test');
const assert = require('node:assert');
const { runMainnet, CLOUD_CMD } = require('../tui/mainnet.cjs');

const A = (n) => '0x' + String(n).repeat(40);
function rig({ env = {}, device = { status: 'approved', code: 'ABCD-EFGH' }, v2probe = 'pass', kinds = {}, onRun = () => 0, onPhone = true } = {}) {
  const e = { ...env }; const calls = []; const out = [];
  const d = {
    version: '2.4.0', onPhone, get: (k) => e[k] || '', log: (s) => out.push(s), device: async () => device,
    realcheck: () => ({ results: [{ id: 'contract-v2-probe', status: v2probe, detail: '' }, { id: 'rpc-is-arbitrum', status: 'pass' }] }),
    contractKind: async (a) => kinds[a] ?? null,
    run: (args) => { calls.push(args.join(' ')); return onRun(args, e, kinds); },
  };
  return { d, e, calls, out };
}
const ALL = { ARB_RPC_URL: 'https://n', ARBITRUM_WSS_URL: 'wss://x', TAX_RESERVE_VAULT: A(1), PAYOUT_WALLET_ADDRESS: A(2) };

test('fresh phone: asks each setting, runs the real checks, deploys v2 on YES, writes the cloud pack, hands off to Cloud Shell', async () => {
  const r = rig({ onRun: (a, e, kinds) => {
    if (a[0] === 'keys') { Object.assign(e, ALL); return 0; } // every wallet and key in one sitting
    if (a[0] === 'deploy') { e.CHRONOS_FLASH_ARB_ADDRESS = A(9); kinds[A(9)] = 2; return 0; }
    if (a[0] === 'set') return 1; // executor not available yet: Esc
    return 0;
  } });
  const o = await runMainnet(r.d);
  assert.deepStrictEqual(r.calls, ['keys', 'phone', 'verify-real', 'deploy --v2', 'cloud-pack', 'set CHRONOS_EXECUTOR_ADDRESS']);
  assert.ok(o.done.includes('contract v2 deployed at ' + A(9)));
  assert.ok(r.out.join('\n').includes(CLOUD_CMD('2.4.0')));
  assert.ok(o.left.some((l) => l.startsWith('Cloud Shell:')));
});

test('back from Cloud Shell: only the executor is pasted, then deploy runs once more to make it an operator and fund gas', async () => {
  const r = rig({ env: { ...ALL, CHRONOS_FLASH_ARB_ADDRESS: A(9) }, kinds: { [A(9)]: 2 }, onRun: (a, e) => {
    if (a[0] === 'set' && a[1] === 'CHRONOS_EXECUTOR_ADDRESS') { e.CHRONOS_EXECUTOR_ADDRESS = A(7); return 0; }
    if (a[0] === 'set' && a[1] === 'CHRONOS_EXECUTOR_KMS_KEY') { e.CHRONOS_EXECUTOR_KMS_KEY = 'projects/p/locations/l/keyRings/k/cryptoKeys/c/cryptoKeyVersions/1'; return 0; }
    return 0;
  } });
  const o = await runMainnet(r.d);
  assert.deepStrictEqual(r.calls, ['phone', 'verify-real', 'cloud-pack', 'set CHRONOS_EXECUTOR_ADDRESS', 'set CHRONOS_EXECUTOR_KMS_KEY', 'deploy --v2']);
  assert.deepStrictEqual(o.left, []);
});

test('everything in place: only the real checks and the idempotent deploy (sends nothing when nothing is missing)', async () => {
  const r = rig({ env: { ...ALL, CHRONOS_FLASH_ARB_ADDRESS: A(9), CHRONOS_EXECUTOR_ADDRESS: A(7), CHRONOS_EXECUTOR_KMS_KEY: 'k' }, kinds: { [A(9)]: 2 } });
  const o = await runMainnet(r.d);
  assert.deepStrictEqual(r.calls, ['phone', 'verify-real', 'deploy --v2']);
  assert.deepStrictEqual(o.left, []);
});

test('contract v2 is not offered when its real-protocol checks did not pass; an unapproved device stops at step 1', async () => {
  const r = rig({ env: ALL, v2probe: 'fail' });
  const o = await runMainnet(r.d);
  assert.ok(!r.calls.some((c) => c.startsWith('deploy')), 'no deploy');
  assert.ok(o.left.includes('contract v2 real-protocol checks must pass'));
  const p = rig({ device: { status: 'pending', code: 'WXYZ-1234' } });
  const q = await runMainnet(p.d);
  assert.deepStrictEqual(p.calls, []); assert.match(p.out.join(' '), /approve pairing code WXYZ-1234/); assert.deepStrictEqual(q.left, ['approve this device']);
});
