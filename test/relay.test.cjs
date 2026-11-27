'use strict';
// The price-move relay: the publisher batches moved pools into pool_moves rows (at most every 2 s, 500 pools a row),
// the listener joins the Realtime topic, takes pools from both broadcast shapes, caps them per minute and reconnects.
// Real counterpart: relay-realtime in chronos verify-real joins the same topic on your Supabase Realtime; the rows go
// through the signed ingest function (test/server.test.cjs) which broadcasts them.
const test = require('node:test');
const assert = require('node:assert');
const RL = require('../lib/relay.cjs');

const P = (n) => '0x' + n.toString(16).padStart(40, '0');

test('relay publisher: batches, spaces and splits what moved', () => {
  let t = 10000; const rows = [];
  const pub = new RL.Publisher({ enqueue: (table, row) => rows.push({ table, row }), now: () => t });
  assert.strictEqual(pub.tick(), 0, 'nothing moved: nothing posted');
  pub.moved(P(1).toUpperCase().replace('0X', '0x'), 100); pub.moved(P(1), 101); pub.moved('not-an-address', 102);
  assert.strictEqual(pub.tick(), 1); assert.deepStrictEqual(rows[0], { table: 'pool_moves', row: { block: 101, pools: [P(1)] } });
  pub.moved(P(2), 103); t += 1000; assert.strictEqual(pub.tick(), 0, 'within 2 s: wait');
  t += 1000; for (let i = 0; i < 1200; i++) pub.moved(P(1000 + i), 104);
  assert.strictEqual(pub.tick(), 3, '1,201 pools → 3 rows of at most 500');
  assert.ok(rows.slice(1).every((r) => r.row.pools.length <= RL.MAX_POOLS_ROW && r.row.block === 104));
  assert.deepStrictEqual(pub.status(), { rows: 4, pools: 1202, waiting: 0 });
});

test('relay listener: joins, takes pools, caps per minute, reconnects', async () => {
  const sockets = [];
  function fakeRealtime(url) { this.url = url; this.sent = []; this.h = {}; sockets.push(this); }
  fakeRealtime.prototype.on = function (ev, fn) { this.h[ev] = fn; };
  fakeRealtime.prototype.send = function (s) { this.sent.push(JSON.parse(s)); };
  fakeRealtime.prototype.close = function () {};
  const got = []; let t = 0;
  const url = RL.realtimeUrl('https://abc123.supabase.co/functions/v1/ingest', 'sb_publishable_x');
  assert.strictEqual(url, 'wss://abc123.supabase.co/realtime/v1/websocket?apikey=sb_publishable_x&vsn=1.0.0');
  assert.strictEqual(RL.realtimeUrl('http://localhost/ingest', 'k'), null);
  const l = new RL.Listener({ url, WS: fakeRealtime, onPools: (ps) => got.push(...ps), now: () => t }).start();
  const ws = sockets[0]; ws.h.open();
  assert.strictEqual(ws.sent[0].event, 'phx_join'); assert.strictEqual(ws.sent[0].topic, 'realtime:chronos-pool-moves');
  ws.h.message({ data: JSON.stringify({ topic: 'realtime:chronos-pool-moves', event: 'phx_reply', payload: { status: 'ok' } }) });
  assert.strictEqual(l.status().up, true);
  // the broadcast API's shape and the database's shape both carry the pools
  ws.h.message({ data: JSON.stringify({ event: 'broadcast', payload: { type: 'broadcast', event: 'moves', payload: { block: 5, pools: [P(1), 'junk'] } } }) });
  ws.h.message(JSON.stringify({ event: 'broadcast', payload: { event: 'moves', block: 6, pools: [P(2)] } }));
  ws.h.message({ data: JSON.stringify({ event: 'broadcast', payload: { event: 'other', payload: { pools: [P(3)] } } }) });
  assert.deepStrictEqual(got, [P(1), P(2)]);
  // a flood is capped at 2,000 pools a minute (hints only), then taken again the next minute
  const many = Array.from({ length: 2500 }, (_, i) => P(10 + i));
  ws.h.message({ data: JSON.stringify({ event: 'broadcast', payload: { event: 'moves', payload: { pools: many } } }) });
  assert.strictEqual(got.length, RL.TAKE_PER_MIN); assert.strictEqual(l.status().poolsDropped, 2500 - (RL.TAKE_PER_MIN - 2));
  t += 61000; ws.h.message({ data: JSON.stringify({ event: 'broadcast', payload: { event: 'moves', payload: { pools: [P(9)] } } }) });
  assert.strictEqual(got[got.length - 1], P(9));
  // the connection drops: it is retried with back-off, the join is sent again
  ws.h.close(); assert.strictEqual(l.status().up, false); assert.strictEqual(l.status().fails, 1);
  await new Promise((r) => setTimeout(r, 1100));
  assert.strictEqual(sockets.length, 2); sockets[1].h.open(); assert.strictEqual(sockets[1].sent[0].event, 'phx_join');
  l.stop();
  assert.strictEqual(new RL.Listener({ url: null, onPools: () => {} }).start().status().why, 'relay not configured');
});
