'use strict';
// Websocket block feed against a real websocket node (a local chain on chain id 42161 serving ws://), plus a wrong-chain
// feed and a dropped connection. Nothing here touches mainnet.
const test = require('node:test');
const assert = require('node:assert');
const ganache = require('ganache');
const { BlockFeed, wssUrls } = require('../lib/blockfeed.cjs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function node(chainId, port) {
  const s = ganache.server({ logging: { quiet: true }, chain: { chainId }, wallet: { deterministic: true, totalAccounts: 1 } });
  await new Promise((r) => s.listen(port, r));
  const mine = () => s.provider.request({ method: 'evm_mine', params: [] });
  return { s, mine, url: `ws://127.0.0.1:${port}` };
}

test('only wss:// urls are used, each once', () => {
  const env = { ARBITRUM_WSS_URL: 'wss://a.example/x', ARB_WSS_URL: 'wss://a.example/x', ALCHEMY_WSS_URL: 'https://not-a-socket', ARBITRUM_WSS_URL_2: 'wss://b.example/y' };
  assert.deepStrictEqual(wssUrls((k) => env[k]), ['wss://a.example/x', 'wss://b.example/y']);
});

test('block feed: every new block once, from whichever feed is first; a wrong chain is ignored; a dropped feed reconnects', async () => {
  const good = await node(42161, 18561), other = await node(42161, 18562), wrong = await node(1, 18563);
  const seen = []; const logs = [];
  const f = new BlockFeed({ urls: [good.url, other.url, wrong.url], onBlock: (n) => seen.push(n), log: (m) => logs.push(m), maxBackoffMs: 500 }).start();
  try {
    for (let i = 0; i < 60 && f.status().up < 2; i++) await wait(100);
    assert.strictEqual(f.status().up, 2, 'both Arbitrum feeds connected');
    assert.ok(logs.some((m) => /feed 3 is chain 1, not Arbitrum One/.test(m)), 'the chain-1 feed is refused');
    for (let i = 0; i < 4; i++) { await good.mine(); await other.mine(); await wait(1200); }
    assert.ok(seen.length >= 3, `blocks announced (${seen.length})`);
    assert.deepStrictEqual(seen, [...new Set(seen)].sort((a, b) => a - b), 'each block number once, in order');
    // one feed drops: the other keeps announcing, and the dropped one reconnects by itself
    f.conns[0].p.websocket.close();
    const before = seen.length;
    for (let i = 0; i < 3; i++) { await other.mine(); await wait(1200); }
    assert.ok(seen.length > before, 'blocks keep coming from the other feed');
    assert.ok(logs.some((m) => /feed 1 down/.test(m)));
    for (let i = 0; i < 50 && f.status().up < 2; i++) await wait(100);
    assert.strictEqual(f.status().up, 2, 'the dropped feed reconnected');
    assert.ok(!logs.some((m) => /127\.0\.0\.1/.test(m)), 'urls are never logged');
  } finally { f.stop(); await wait(200); for (const n of [good, other, wrong]) await Promise.race([n.s.close(), wait(2000)]); }
});

test('a feed that fails or is closed while still connecting never ends the engine (the crash of 2026-11-26)', async () => {
  const net = require('net');
  const socks = new Set();
  const hang = net.createServer((sock) => { socks.add(sock); sock.on('error', () => {}); }); // accepts, never answers the handshake
  await new Promise((r) => hang.listen(18564, r));
  const crashes = []; const h = (e) => crashes.push(e);
  process.on('uncaughtException', h); process.on('unhandledRejection', h);
  const logs = [];
  const f = new BlockFeed({ urls: ['ws://127.0.0.1:18564', 'ws://127.0.0.1:18565'], onBlock: () => {}, log: (m) => logs.push(m), maxBackoffMs: 300 }).start();
  try {
    await wait(150); f.restart(); // closes a socket that is still connecting: "closed before the connection was established"
    await wait(900); f.restart(); await wait(600);
    assert.deepStrictEqual(crashes.map((e) => String(e && e.message)), [], 'nothing escaped: the engine keeps running');
    assert.ok(logs.some((m) => /feed 2 down/.test(m)), 'a refused feed is retried, not fatal');
  } finally { f.stop(); await wait(300); process.off('uncaughtException', h); process.off('unhandledRejection', h); for (const x of socks) x.destroy(); hang.close(); }
});

test('leftovers of a closed connection are ignored; anything else, or a flood of them, is still fatal', () => {
  const { benignNetworkError } = require('../lib/safety.cjs');
  const t0 = 1e12;
  assert.strictEqual(benignNetworkError(new Error('provider destroyed; cancelled request (operation="eth_subscribe", code=UNSUPPORTED_OPERATION, version=6.17.0)'), t0), true);
  assert.strictEqual(benignNetworkError(new Error('WebSocket was closed before the connection was established'), t0), true);
  assert.strictEqual(benignNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"), t0), false, 'a real bug stays fatal');
  assert.strictEqual(benignNetworkError(new Error('exceeded maximum retry limit'), t0), false);
  let last = true; for (let i = 0; i < 60; i++) last = benignNetworkError(new Error('WebSocket was closed before the connection was established'), t0 + i);
  assert.strictEqual(last, false, 'more than 50 in 10 minutes: a loop is never hidden');
  assert.strictEqual(benignNetworkError(new Error('WebSocket was closed before the connection was established'), t0 + 700000), true, 'the window moves on');
});
