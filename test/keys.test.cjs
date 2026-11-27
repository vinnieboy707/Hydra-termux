'use strict';
// chronos keys: every wallet address and key in one sitting, in order; what is already on this device imported first
// (tested; private keys never); the websocket derived from your node's provider and tested on the live chain, never
// derived from Arbitrum's public RPC (it has none); optional ones skippable. Real counterpart: the live tests each key
// gets in lib/catalog.cjs (testRpc, wssLive) and wss-feed / rpc-is-arbitrum in chronos verify-real.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const K = require('../tui/keys.cjs');
const A = (n) => '0x' + String(n).repeat(40);

test('the websocket url comes from the same provider and key; the public RPC has none', () => {
  assert.strictEqual(K.wssFromRpc('https://arb-mainnet.g.alchemy.com/v2/abc123'), 'wss://arb-mainnet.g.alchemy.com/v2/abc123');
  assert.strictEqual(K.wssFromRpc('https://arbitrum-mainnet.infura.io/v3/k1'), 'wss://arbitrum-mainnet.infura.io/ws/v3/k1');
  assert.strictEqual(K.wssFromRpc('https://red-x.arbitrum-mainnet.quiknode.pro/tok/'), 'wss://red-x.arbitrum-mainnet.quiknode.pro/tok/');
  assert.strictEqual(K.wssFromRpc('https://arbitrum-mainnet.core.chainstack.com/k'), 'wss://arbitrum-mainnet.core.chainstack.com/k');
  assert.strictEqual(K.wssFromRpc('https://lb.drpc.org/ogrpc?network=arbitrum&dkey=d'), 'wss://lb.drpc.org/ogws?network=arbitrum&dkey=d');
  assert.strictEqual(K.wssFromRpc('https://rpc.swiftnodes.io/rpc/arbitrum?key=sw1'), 'wss://rpc.swiftnodes.io/ws/arbitrum?key=sw1');
  assert.strictEqual(K.wssFromRpc('https://rpc.swiftnodes.io/rpc/base?key=sw1'), null, 'another chain on the same provider is not Arbitrum');
  assert.strictEqual(K.wssFromRpc('https://arb1.arbitrum.io/rpc'), null, 'Arbitrum public RPC: no websocket');
  assert.strictEqual(K.wssFromRpc('https://unknown.example/rpc'), null, 'an unknown provider is never guessed');
  assert.strictEqual(K.wssFromRpc('http://arb-mainnet.g.alchemy.com/v2/x'), null); assert.strictEqual(K.wssFromRpc('nope'), null);
});

function rig(env, { wssOk = true, answers = {} } = {}) {
  const e = { ...env }; const out = []; const runs = []; const saved = [];
  return { e, out, runs, saved, d: {
    get: (k) => e[k] || '', log: (s) => out.push(s),
    run: (a) => { runs.push(a.join(' ')); if (a[0] === 'set' && answers[a[1]]) { e[a[1]] = answers[a[1]]; return 0; } return 1; },
    testWss: async (u) => (wssOk ? { ok: true, msg: 'connected · Arbitrum One (42161)' } : { ok: false, msg: 'no answer in 8 s' }),
    save: (k, v) => { e[k] = v; saved.push(k); },
    importFirst: async () => { e.TAX_RESERVE_VAULT = A(1); return { files: 3, imported: [{ key: 'TAX_RESERVE_VAULT' }], failed: [], conflicts: [] }; },
  } };
}

test('one sitting: imports what is on the device, derives the websocket, asks only for the rest, in order', async () => {
  const r = rig({}, { answers: { ARB_RPC_URL: 'https://arb-mainnet.g.alchemy.com/v2/k', PAYOUT_WALLET_ADDRESS: A(2) } });
  const o = await K.runKeys(r.d);
  assert.deepStrictEqual(r.runs, ['set ARB_RPC_URL', 'set ARB_RPC_URL_2', 'set ARB_RPC_URL_3', 'set PAYOUT_WALLET_ADDRESS', 'set OPENROUTER_API_KEY']);
  assert.strictEqual(r.e.ARBITRUM_WSS_URL, 'wss://arb-mainnet.g.alchemy.com/v2/k'); assert.deepStrictEqual(r.saved, ['ARBITRUM_WSS_URL']);
  assert.match(r.out.join('\n'), /found on this device: 3 file\(s\) searched · 1 imported \(TAX_RESERVE_VAULT\)/);
  assert.match(r.out.join('\n'), /ARBITRUM_WSS_URL derived from your node's provider and tested/);
  assert.deepStrictEqual(o.missing, []); assert.match(r.out.at(-1), /owner private key is not asked for here\. Keep it encrypted once \(chronos owner save\)/);
});

test('public RPC: the websocket is optional and never invented; a missing required key is reported', async () => {
  const r = rig({ ARB_RPC_URL: 'https://arb1.arbitrum.io/rpc' });
  const o = await K.runKeys(r.d);
  assert.ok(!r.e.ARBITRUM_WSS_URL); assert.match(r.out.join('\n'), /no websocket \(Arbitrum's public RPC has none\)/);
  assert.deepStrictEqual(o.missing, ['PAYOUT_WALLET_ADDRESS']); assert.ok(o.skipped.includes('ARBITRUM_WSS_URL'));
  const r2 = rig({ ARB_RPC_URL: 'https://arb-mainnet.g.alchemy.com/v2/k' }, { wssOk: false });
  await K.runKeys(r2.d); assert.ok(!r2.e.ARBITRUM_WSS_URL, 'a websocket that does not answer is not saved'); assert.match(r2.out.join('\n'), /did not answer \(no answer in 8 s\)/);
});

test('the importer reads a folder or a file you name (CHRONOS_IMPORT_FROM), and never a .example', () => {
  const IMP = require('../lib/importer.cjs');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-')); const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-'));
  fs.mkdirSync(path.join(ws, 'proj')); fs.writeFileSync(path.join(ws, 'proj', '.env'), 'PAYOUT_WALLET_ADDRESS=' + A(3) + '\n');
  fs.writeFileSync(path.join(ws, 'keys-from-gemini.txt'), 'OPENROUTER_API_KEY=sk-or-x\n'); fs.writeFileSync(path.join(ws, '.env.example'), 'X=1\n');
  const files = IMP.candidateFiles({ home, extra: [ws, path.join(ws, 'keys-from-gemini.txt')] });
  assert.ok(files.includes(path.join(ws, 'proj', '.env'))); assert.ok(files.includes(path.join(ws, 'keys-from-gemini.txt')));
  assert.ok(!files.some((f) => f.endsWith('.example')));
});

test('a node you already have counts, and the websocket comes from whichever node has a provider', async () => {
  const r = rig({ ARBITRUM_RPC_URL: 'https://arb1.arbitrum.io/rpc', ALCHEMY_RPC_URL: 'https://arb-mainnet.g.alchemy.com/v2/k2' }, { answers: { PAYOUT_WALLET_ADDRESS: A(2) } });
  await K.runKeys(r.d);
  assert.ok(!r.runs.includes('set ARB_RPC_URL'), 'not asked again: ARBITRUM_RPC_URL is a node'); assert.match(r.out.join('\n'), /node already set \(ARBITRUM_RPC_URL\)/);
  assert.strictEqual(r.e.ARBITRUM_WSS_URL, 'wss://arb-mainnet.g.alchemy.com/v2/k2', 'derived from the Alchemy node, not the public one');
});
