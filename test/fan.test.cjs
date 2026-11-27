'use strict';
// Burst mode (2.9.19, lib/fan.cjs): every scan read spread over all your nodes at once; a rate limit or a slow node
// never retried on itself, the request goes to the next node at once; nodes that could bill per request and your
// send lane stay out. Nodes are played by fakeNode (answers, 429s, limit errors inside the JSON, timeouts); their
// real counterparts are your RPC nodes, each checked by chronos verify-real (burst-nodes: chain id 42161, fast-fail).
const test = require('node:test');
const assert = require('node:assert');
const FAN = require('../lib/fan.cjs');

function fakeNode(key, behave = 'ok') {
  const n = { key, url: `https://${key}.example/rpc`, hits: 0 };
  n.provider = { _send: async (payload) => {
    n.hits++; const list = Array.isArray(payload) ? payload : [payload];
    const mode = typeof behave === 'function' ? behave(n.hits) : behave;
    if (mode === '429') throw Object.assign(new Error('server response 429 Too Many Requests'), { info: { responseStatus: '429 Too Many Requests' } });
    if (mode === 'daily') throw new Error('daily request count exceeded, request rate limited');
    if (mode === 'timeout') throw Object.assign(new Error('request timeout'), { code: 'TIMEOUT' });
    if (mode === 'json-limit') return list.map((p) => ({ jsonrpc: '2.0', id: p.id, error: { code: -32005, message: 'limit exceeded' } }));
    return list.map((p) => ({ jsonrpc: '2.0', id: p.id, result: p.method === 'eth_chainId' ? '0xa4b1' : '0x' + (1000 + n.hits).toString(16) }));
  } };
  return n;
}
const fanOf = (nodes, now = () => 1e12) => new FAN.FanProvider(nodes, { now, make: () => { throw new Error('not used'); } });
const call = (fan, id = 1) => fan._send({ jsonrpc: '2.0', id, method: 'eth_blockNumber', params: [] });

test('every request goes to the next node in turn: N nodes carry N requests at once', async () => {
  const ns = ['a', 'b', 'c'].map((k) => fakeNode(k)); const fan = fanOf(ns);
  await Promise.all([1, 2, 3, 4, 5, 6].map((i) => call(fan, i)));
  assert.deepStrictEqual(ns.map((n) => n.hits), [2, 2, 2]);
  assert.strictEqual(fan.meter.posts, 6);
});

test('a rate limit is never retried on that node: the same request goes to the next node at once, the limited node cools', async () => {
  let t = 1e12; const a = fakeNode('a', '429'), b = fakeNode('b'); const fan = fanOf([a, b], () => t);
  const r = await call(fan); assert.ok(r[0].result, 'answered by b in the same call'); assert.strictEqual(a.hits, 1, 'a was asked once, not 12 times');
  assert.strictEqual(fan.meter.failovers, 1);
  await call(fan); await call(fan); assert.strictEqual(a.hits, 1, 'a is cooling: skipped'); assert.strictEqual(b.hits, 3);
  t += 61000; await call(fan); await call(fan); assert.ok(a.hits >= 2, 'a is tried again once cooled');
  const st = fan.status(); assert.strictEqual(st[0].limited, 2);
});

test('a limit inside the JSON, a daily quota and a slow node all fail over; every node cooling is an ordinary error with a wait', async () => {
  const t = Date.UTC(2026, 10, 26, 20, 0, 0);
  const j = fakeNode('j', 'json-limit'), d = fakeNode('d', 'daily'), s = fakeNode('s', 'timeout'), ok = fakeNode('ok');
  const fan = fanOf([j, d, s, ok], () => t);
  const r = await call(fan); assert.ok(r[0].result);
  const st = Object.fromEntries(fan.status().map((x) => [x.key, x]));
  assert.strictEqual(st.d.why, 'daily quota spent'); assert.strictEqual(st.d.coolingS, 4 * 3600, 'cooled until the daily reset at 00:00 UTC');
  assert.strictEqual(st.s.why, 'slow (timeout)'); assert.strictEqual(st.j.why, 'rate limit');
  const all = fanOf([fakeNode('x', '429'), fakeNode('y', '429')], () => t);
  await assert.rejects(call(all), (e) => e.allCooling === true && e.waitMs > 0 && /every node is cooling down/.test(e.message));
});

test('the fan is a real ethers provider: getBlockNumber and chain id through it, requests spread', async () => {
  const ns = ['a', 'b'].map((k) => fakeNode(k)); const fan = fanOf(ns);
  const bn = await fan.getBlockNumber(); assert.ok(bn > 1000);
  const [x, y] = await Promise.all([fan.send('eth_blockNumber', []), fan.send('eth_chainId', [])]); assert.ok(x && y);
});

test('who is in the fan: plans that refuse past their limit; billing or unknown plans out unless you say all; your send lane out', () => {
  const get = (k) => ({ INFURA_PLAN: 'free', DRPC_PLAN: 'payg', SWIFTNODES_PLAN: 'free' })[k];
  const entries = [
    { key: 'ARB_RPC_URL', url: 'https://rpc.swiftnodes.io/rpc/arbitrum?key=K' },
    { key: 'ARB_RPC_URL_2', url: 'https://arbitrum-mainnet.infura.io/v3/K' },
    { key: 'DRPC_ARB_URL', url: 'https://lb.drpc.org/ogrpc?network=arbitrum&dkey=K' },
    { key: 'ALCHEMY_RPC_URL', url: 'https://arb-mainnet.g.alchemy.com/v2/K' },
    { key: 'GETBLOCK_ARB_URL', url: 'https://go.getblock.io/K/' },
  ];
  const m = FAN.members(entries, get, entries[0].url, 'free');
  assert.deepStrictEqual(m.members.map((e) => e.key), ['ARB_RPC_URL_2', 'GETBLOCK_ARB_URL']);
  const why = Object.fromEntries(m.out.map((o) => [o.key, o.why]));
  assert.match(why.DRPC_ARB_URL, /bills per request/); assert.match(why.ALCHEMY_RPC_URL, /plan unknown/); assert.match(why.ARB_RPC_URL, /kept for your trades/);
  const all = FAN.members(entries, get, entries[0].url, 'all');
  assert.strictEqual(all.members.length, 4, 'CHRONOS_BURST_NODES=all takes every node but the send lane');
  const one = FAN.members([entries[1]], get, entries[1].url, 'free');
  assert.strictEqual(one.members.length, 1, 'with a single node, it both scans and sends');
});

test('the real fast-fail client: one 429 is one attempt (ethers alone retries the same node up to 12 times), a hung node is dropped after the timeout', async () => {
  const http = require('http');
  let hits = 0;
  const srv = http.createServer((req, res) => { hits++; if (req.url === '/hang') return; res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '1' }); res.end('{"error":"Rate limited"}'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  try {
    const p = FAN.fastProvider(`http://127.0.0.1:${port}/rpc`, { timeoutMs: 400 });
    p._getConnection().allowInsecureAuthentication = true;
    const t0 = Date.now(); await assert.rejects(p._send({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }));
    assert.strictEqual(hits, 1, 'asked once'); assert.ok(Date.now() - t0 < 1500, 'and gave up at once');
    const h = FAN.fastProvider(`http://127.0.0.1:${port}/hang`, { timeoutMs: 300 });
    const t1 = Date.now(); await assert.rejects(h._send({ jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] })); assert.ok(Date.now() - t1 < 2000, 'a hung node costs the timeout, not 5 minutes');
  } finally { srv.closeAllConnections(); srv.close(); }
});
