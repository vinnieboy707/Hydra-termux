'use strict';
// 1inch and Etherscan API keys (2.9.13): set at a hidden prompt with chronos set, checked live, never saved when the
// service refuses them, saved as "not verified" when there is no connection. The services are played by fakeFetch
// (status and body); their real counterparts are api.1inch.dev and api.etherscan.io, checked by chronos verify-real
// (data-apis) with your real keys.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../lib/catalog.cjs');

function fakeFetch(status, body) { const seen = []; const f = async (url, opt) => { seen.push({ url, headers: (opt && opt.headers) || {} }); if (status === 'down') throw new Error('getaddrinfo ENOTFOUND'); return { status, ok: status >= 200 && status < 300, text: async () => body }; }; f.seen = seen; return f; }
const key = (k) => C.SECRETS.find((s) => s.key === k);

test('1inch key: Bearer header on a read-only Arbitrum call; refused key is not saved; offline saves unverified', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = fakeFetch(200, '{"baseFee":"10000000"}');
  const ok = await key('ONEINCH_API_KEY').test('abcdefghijklmnopqrstuvwx12');
  assert.strictEqual(ok.ok, true); assert.strictEqual(ok.level, 'verified');
  assert.strictEqual(globalThis.fetch.seen[0].url, 'https://api.1inch.com/gas-price/v1.6/42161', 'the documented gateway (business.1inch.com docs, 2026-11-26)'); assert.strictEqual(globalThis.fetch.seen[0].headers.Authorization, 'Bearer abcdefghijklmnopqrstuvwx12');
  globalThis.fetch = fakeFetch(401, '{"error":"Unauthorized"}');
  const no = await key('ONEINCH_API_KEY').test('abcdefghijklmnopqrstuvwx12'); assert.strictEqual(no.ok, false); assert.match(no.msg, /refused this key/);
  globalThis.fetch = fakeFetch(402, '{"error":"Payment Required"}');
  assert.strictEqual((await key('ONEINCH_API_KEY').test('abcdefghijklmnopqrstuvwx12')).ok, false, '402: the gateway did not take the key');
  globalThis.fetch = fakeFetch('down');
  const off = await key('ONEINCH_API_KEY').test('abcdefghijklmnopqrstuvwx12'); assert.strictEqual(off.ok, true); assert.match(off.msg, /not verified yet/);
  assert.strictEqual((await key('ONEINCH_API_KEY').test('https://api.1inch.dev/x')).ok, false, 'a url is not a key');
});

test('Etherscan key: V2 api with chainid 42161; an error body is not a pass; wrong shape refused before any call', async (t) => {
  const real = globalThis.fetch; t.after(() => { globalThis.fetch = real; });
  globalThis.fetch = fakeFetch(200, '{"jsonrpc":"2.0","id":83,"result":"0x18a6b3f1"}');
  const k = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678';
  const ok = await key('ETHERSCAN_API_KEY').test(k); assert.strictEqual(ok.ok, true, ok.msg);
  assert.match(globalThis.fetch.seen[0].url, /^https:\/\/api\.etherscan\.io\/v2\/api\?chainid=42161&module=proxy&action=eth_blockNumber&apikey=/);
  globalThis.fetch = fakeFetch(200, '{"status":"0","message":"NOTOK","result":"Invalid API Key"}');
  const bad = await key('ETHERSCAN_API_KEY').test(k); assert.strictEqual(bad.ok, false, 'Etherscan answers 200 with an error: still a refusal');
  const calls = fakeFetch(200, ''); globalThis.fetch = calls;
  assert.strictEqual((await key('ETHERSCAN_API_KEY').test('short')).ok, false); assert.strictEqual(calls.seen.length, 0, 'no call for a key of the wrong shape');
});
