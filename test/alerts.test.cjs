'use strict';
// Where alerts go by default (your project's alerts function, device-signed), how `off` and your own url win, and
// how the AI agent's model is chosen from OpenRouter's own list when you set none. Real counterparts: alert-webhook,
// notify-webhook and ai-agent in chronos verify-real (test/counterparts.json).
process.env.CHRONOS_RELEASE_BASE = 'https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/release';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const HU = require('../lib/hookurl.cjs');
const AM = require('../lib/agentmodel.cjs');
const OWN = 'https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/alerts';
const verifies = (h, body) => {
  const pub = crypto.createPublicKey({ key: Buffer.from(h['x-device-pub'], 'base64'), format: 'der', type: 'spki' });
  return crypto.verify(null, Buffer.from(`${h['x-chronos-ts']}.${body}`), pub, Buffer.from(h['x-chronos-sig'], 'base64'));
};

test('alerts go to your project\'s alerts function unless you set your own url or off', () => {
  const env = (o) => (k) => o[k];
  assert.strictEqual(HU.ownUrl(), OWN);
  assert.strictEqual(HU.effective(env({}), 'CHRONOS_WEBHOOK_URL'), OWN);
  assert.strictEqual(HU.effective(env({ CHRONOS_WEBHOOK_URL: '  ' }), 'CHRONOS_WEBHOOK_URL'), OWN);
  assert.strictEqual(HU.effective(env({ CHRONOS_WEBHOOK_URL: 'off' }), 'CHRONOS_WEBHOOK_URL'), null);
  assert.strictEqual(HU.effective(env({ CHRONOS_WEBHOOK_URL: 'OFF' }), 'CHRONOS_WEBHOOK_URL'), null);
  assert.strictEqual(HU.effective(env({ CHRONOS_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x' }), 'CHRONOS_WEBHOOK_URL'), 'https://discord.com/api/webhooks/1/x');
  assert.ok(HU.isOwn(OWN));
  assert.ok(!HU.isOwn('https://evil.example/functions/v1/alerts'), 'another host is never sent your device signature');
  assert.ok(!HU.isOwn('https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/ingest'));
  assert.ok(!HU.isOwn('not a url'));
  assert.deepStrictEqual(HU.headersFor('https://discord.com/api/webhooks/1/x', '{}'), { 'content-type': 'application/json' });
  const body = '{"a":1}'; const h = HU.headersFor(OWN, body);
  assert.ok(verifies(h, body), 'device-signed over ts.body');
});

test('the alert webhook signs with this device for your project, with HMAC for your own url', async () => {
  const { createWebhook } = require('../lib/webhook.cjs');
  const seen = [];
  const fetchImpl = async (url, o) => { seen.push({ url, h: o.headers, body: o.body }); return { status: 200 }; };
  await createWebhook({ url: OWN, secret: 'ignored-for-own', fetchImpl, minGapMs: 0 })('escalated', { symptom: 'x' });
  assert.ok(verifies(seen[0].h, seen[0].body)); assert.ok(!seen[0].h['x-chronos-signature'], 'no HMAC secret sent to your project');
  await createWebhook({ url: 'https://hooks.example/x', secret: 's3', fetchImpl, minGapMs: 0 })('escalated', { symptom: 'x' });
  assert.match(seen[1].h['x-chronos-signature'], /^t=\d+,v1=[0-9a-f]{64}$/); assert.ok(!seen[1].h['x-device-pub'], 'your device key is never sent elsewhere');
});

test('phone-style notifications post id and channel, device-signed to your project', async () => {
  const seen = []; const orig = globalThis.fetch;
  globalThis.fetch = async (url, o) => { seen.push({ url, h: o.headers, body: o.body }); return { ok: true, status: 200 }; };
  const old = process.env.PATH; process.env.PATH = ''; // no termux-notification here
  try {
    const n = require('../lib/notify.cjs').createNotifier({ webhook: OWN, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'nt-')) });
    const r = await n.send({ id: 'profit', title: 'Verified on-chain profit', text: '+$1.00', minIntervalMs: 0 });
    assert.deepStrictEqual(r.via, ['webhook']);
    const b = JSON.parse(seen[0].body); assert.strictEqual(b.id, 'profit'); assert.strictEqual(b.channel, 'notify');
    assert.ok(verifies(seen[0].h, seen[0].body));
  } finally { globalThis.fetch = orig; process.env.PATH = old; }
});

test('the AI model: yours, else the newest Claude Sonnet OpenRouter lists (remembered a day), else off', async () => {
  const list = { data: [{ id: 'anthropic/claude-sonnet-a', created: 100 }, { id: 'anthropic/claude-sonnet-b', created: 300 }, { id: 'anthropic/claude-opus-z', created: 900 }, { id: 'anthropic/claude-sonnet-c:free', created: 999 }, { id: 'openai/x', created: 1000 }] };
  assert.strictEqual(AM.pick(list.data), 'anthropic/claude-sonnet-b');
  assert.strictEqual(AM.pick([{ id: 'anthropic/claude-haiku-q', created: 1 }]), 'anthropic/claude-haiku-q');
  assert.strictEqual(AM.pick([{ id: 'openai/x' }]), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'am-'));
  let calls = 0; const fetchImpl = async () => { calls++; return { ok: true, json: async () => list }; };
  assert.deepStrictEqual(await AM.resolve(() => 'me/mine', dir, { fetchImpl }), { model: 'me/mine', chosen: false });
  assert.strictEqual(calls, 0, 'your model: OpenRouter is not asked');
  assert.deepStrictEqual(await AM.resolve(() => '', dir, { fetchImpl }), { model: 'anthropic/claude-sonnet-b', chosen: true });
  assert.deepStrictEqual(await AM.resolve(() => '', dir, { fetchImpl }), { model: 'anthropic/claude-sonnet-b', chosen: true });
  assert.strictEqual(calls, 1, 'remembered');
  assert.strictEqual(AM.current(() => '', dir, Date.now() + 2 * 86400000), null, 'forgotten after a day');
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'am-'));
  assert.strictEqual(await AM.resolve(() => '', dir2, { fetchImpl: async () => { throw new Error('offline'); } }), null, 'unreachable: off, never a guessed model');
  assert.strictEqual(await AM.resolve(() => '', dir2, { fetchImpl: async () => ({ ok: false, status: 500 }) }), null);
});
