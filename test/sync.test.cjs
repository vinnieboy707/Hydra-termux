'use strict';
// Engine to portal sync: device-signed requests, offline queue, retries, and only allowlisted fields leave the device.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const SYNC = require('../lib/sync.cjs');

function server(handler) {
  return new Promise((res) => {
    const reqs = [];
    const s = http.createServer((req, rsp) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { reqs.push({ headers: req.headers, body: b }); const r = handler(reqs.length, req.headers, b); rsp.writeHead(r.status, { 'content-type': 'application/json' }); rsp.end(JSON.stringify(r.json || {})); }); });
    s.listen(0, '127.0.0.1', () => res({ s, reqs, url: `http://127.0.0.1:${s.address().port}/functions/v1/ingest` }));
  });
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sync-'));

test('sync: url must be your Supabase function (or localhost); the default is your project, derived from the release address', () => {
  for (const u of ['http://evil.example/functions/v1/ingest', 'https://evil.example/functions/v1/ingest', 'https://abc.supabase.co/rest/v1/executions'])
    assert.equal(SYNC.createSync({ url: u, dataDir: tmp() }).enabled, false, String(u));
  assert.equal(SYNC.createSync({ url: 'https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/ingest', dataDir: tmp() }).enabled, true);
  assert.equal(SYNC.defaultUrl(), process.env.CHRONOS_RELEASE_BASE.replace(/\/release$/, '/ingest'));
});

test('sync: every post is signed by this device (Ed25519 over ts.body); no shared secret exists; only mapped columns are sent', async () => {
  const dir = tmp(); const { s, reqs, url } = await server(() => ({ status: 200, json: { ok: true } }));
  try {
    require('../lib/device.cjs').key(); // this device's key (test copy, see test/isolate.cjs)
    const sync = SYNC.createSync({ url, dataDir: dir });
    sync.enqueue('shadow_runs', SYNC.MAP.shadow({ at: 1700000000000, route: 'A>B|x|y', block: 123, stage: 'done', win: true, netUsd: 4.2, profitUsd: 5, gasUsd: 0.8 }));
    const r = await sync.flush();
    assert.equal(r.sent, 1);
    const q = reqs[0];
    const pk = crypto.createPublicKey({ key: Buffer.from(q.headers['x-device-pub'], 'base64'), format: 'der', type: 'spki' });
    assert.ok(crypto.verify(null, Buffer.from(q.headers['x-chronos-ts'] + '.' + q.body), pk, Buffer.from(q.headers['x-chronos-sig'], 'base64')), 'signature verifies with the device public key');
    assert.ok(!crypto.verify(null, Buffer.from('0.' + q.body), pk, Buffer.from(q.headers['x-chronos-sig'], 'base64')), 'the timestamp is part of what is signed');
    assert.ok(!fs.existsSync(path.join(dir, 'live', 'ingest.key')), 'no shared secret file is ever created');
    const body = JSON.parse(q.body);
    assert.equal(body.table, 'shadow_runs');
    assert.deepEqual(body.rows[0], { ts: '2023-11-14T22:13:20.000Z', block: 123, route_key: 'A>B|x|y', stage: 'done', win: true, net_usd: 4.2, profit_usd: 5, gas_usd: 0.8, failed: null, error: null });
    assert.equal(sync.pending(), 0);
  } finally { s.close(); }
});

test('sync: a failing server never throws, rows are kept and retried with backoff, then delivered', async () => {
  const dir = tmp(); let n = 0; const { s, reqs, url } = await server(() => (++n <= 2 ? { status: 500, json: { error: 'down' } } : { status: 200, json: { ok: true } }));
  try {
    const sync = SYNC.createSync({ url, dataDir: dir });
    sync.enqueue('heartbeats', { service: 'chronos-engine', ts: new Date().toISOString(), mode: 'SHADOW' });
    const t0 = Date.now();
    assert.ok((await sync.flush(t0)).error);
    assert.equal(sync.pending(), 1);
    assert.deepEqual(await sync.flush(t0 + 1000), { sent: 0 }, 'inside the backoff: no request');
    assert.equal(reqs.length, 1);
    assert.ok((await sync.flush(t0 + 60000)).error); // second failure
    assert.equal((await sync.flush(t0 + 600000)).sent, 1); // delivered
    assert.equal(sync.pending(), 0);
  } finally { s.close(); }
});

test('sync: queue is bounded (oldest dropped) and a mapper refuses incomplete records', () => {
  const sync = SYNC.createSync({ url: 'http://127.0.0.1:1/functions/v1/ingest', dataDir: tmp(), maxQueue: 5 });
  for (let i = 0; i < 9; i++) sync.enqueue('mode_events', { ts: 't', mode: 'SHADOW', reason: String(i) });
  assert.equal(sync.pending(), 5);
  assert.equal(SYNC.MAP.shadow({ at: 1, route: null, block: 1 }), null);
  assert.equal(SYNC.MAP.opportunity({ netUsd: 3 }, 1, 1), null, 'no runParams, not executable');
  assert.equal(SYNC.MAP.execution({}, 1), null);
});

test('sync: only externally verified balances are sent; unverified amounts never leave the device', () => {
  const rows = SYNC.MAP.balances({ rows: [
    { label: 'executor', address: '0x1', eth: { verified: true, amount: 0.004 }, tokens: [{ symbol: 'USDC', verified: false, amount: null }, { symbol: 'WETH', verified: true, amount: 1.5 }] },
    { label: 'contract', address: '0x2', eth: { verified: false, amount: null }, tokens: [] },
  ] }, 99, 1700000000000);
  assert.deepEqual(rows.map((r) => [r.label, r.token, r.amount]), [['executor', 'ETH', '0.004'], ['executor', 'WETH', '1.5']]);
});

test('sync: a device that is not enrolled yet sends nothing and keeps its rows until it is', async () => {
  const keyfile = process.env.CHRONOS_DEVICE_KEY; const saved = fs.existsSync(keyfile) ? fs.readFileSync(keyfile) : null;
  if (saved) fs.unlinkSync(keyfile);
  const { s, reqs, url } = await server(() => ({ status: 200, json: { ok: true } }));
  try {
    const sync = SYNC.createSync({ url, dataDir: tmp() });
    sync.enqueue('heartbeats', { service: 'x', ts: new Date().toISOString() });
    const r = await sync.flush(); assert.match(r.error, /not enrolled/); assert.equal(reqs.length, 0); assert.equal(sync.pending(), 1);
  } finally { s.close(); if (saved) fs.writeFileSync(keyfile, saved, { mode: 0o600 }); }
});

test('sync: rows the database refuses are found, set aside and counted; they never hold up the rest', async () => {
  const dir = tmp();
  const { s, reqs, url } = await server((n, h, b) => { const j = JSON.parse(b); return j.rows.some((r) => r.outcome === 'bogus') ? { status: 422, json: { error: 'violates check constraint' } } : { status: 200, json: { ok: true } }; });
  try {
    const sync = SYNC.createSync({ url, dataDir: dir });
    for (let i = 0; i < 7; i++) sync.enqueue('agent_events', { ts: new Date().toISOString(), agent: 'x', severity: 'info', source: 's', message: 'm' + i, outcome: i === 3 ? 'bogus' : 'none' });
    sync.enqueue('heartbeats', { service: 'chronos-engine', ts: new Date().toISOString(), mode: 'SHADOW' });
    const r = await sync.flush();
    assert.equal(r.error, undefined, 'a refusal is not a retryable failure');
    assert.equal(r.sent, 7, '6 events + the heartbeat');
    assert.equal(sync.pending(), 0);
    assert.equal(sync.status().rejected, 1);
    const aside = fs.readFileSync(path.join(dir, 'sync-rejected.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(aside.map((x) => [x.table, x.row.message]), [['agent_events', 'm3']]);
    assert.ok(reqs.some((q) => JSON.parse(q.body).table === 'heartbeats'), 'the heartbeat behind them was sent');
  } finally { s.close(); }
});

test('vocabulary: the engine only uses words the database accepts; aliases and unknown outcomes are mapped, not refused', () => {
  const V = require('../lib/vocab.cjs');
  const src = fs.readdirSync(path.join(__dirname, '..', 'lib')).filter((f) => f.endsWith('.cjs')).map((f) => fs.readFileSync(path.join(__dirname, '..', 'lib', f), 'utf8')).join('\n');
  const outcomes = [...src.matchAll(/outcome: '([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(outcomes.length > 10);
  assert.deepEqual([...new Set(outcomes)].filter((o) => !V.OUTCOMES.includes(o)), [], 'add it to lib/vocab.cjs and to the database constraint');
  const sev = [...src.matchAll(/agents\.event\('[a-z-]+', '([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(sev.filter((x) => !V.SEVERITIES.includes(x) && !V.SEVERITY_ALIAS[x]), []);
  assert.deepEqual(V.eventRow({ severity: 'warn', outcome: 'mystery', detail: { a: 1 } }), { severity: 'warning', outcome: 'none', detail: { a: 1, outcome: 'mystery' } });
  assert.deepEqual(V.eventRow({ severity: 'info', outcome: 'fixed', detail: null }), { severity: 'info', outcome: 'fixed', detail: null });
});
