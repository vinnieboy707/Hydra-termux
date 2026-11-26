'use strict';
// Node providers: each plan's documented limits (Infura and SwiftNodes docs, sources in lib/providers.cjs and
// docs/PROVIDERS.md) turned into what the engine does: which node scans, how often, which websocket feeds blocks and
// swaps, the JSON-RPC batch and eth_getLogs sizes. Real counterpart: chronos verify-real 'node-plans' sends a real batch
// to every node you set and reports its provider, plan and the scanning node's pacing; 'wss-feed' the live feed.
const test = require('node:test');
const assert = require('node:assert');
const PR = require('../lib/providers.cjs');
const DM = require('../lib/daemon.cjs');

const INF = 'https://arbitrum-mainnet.infura.io/v3/abc123';
const INF_WS = 'wss://arbitrum-mainnet.infura.io/ws/v3/abc123';
const SW = 'https://rpc.swiftnodes.io/rpc/arbitrum?key=k1';
const SW_WS = 'wss://rpc.swiftnodes.io/ws/arbitrum?key=k1';
const AL = 'https://arb-mainnet.g.alchemy.com/v2/k2';
const PUB = 'https://arb1.arbitrum.io/rpc';
const env = (o) => (k) => o[k];

test('providers are recognised from the url (http and websocket), never by guessing', () => {
  assert.strictEqual(PR.identify(INF).id, 'infura'); assert.strictEqual(PR.identify(INF_WS).id, 'infura');
  assert.strictEqual(PR.identify(SW).id, 'swiftnodes'); assert.strictEqual(PR.identify(SW_WS).id, 'swiftnodes');
  assert.strictEqual(PR.identify(AL).id, 'alchemy'); assert.strictEqual(PR.identify(PUB).id, 'public');
  assert.strictEqual(PR.identify('https://evil-infura.io.example.com/v3/x').id, 'other', 'look-alike host is not Infura');
  assert.strictEqual(PR.identify('not a url').id, 'none');
});

test('plans default to free (the safe assumption) and follow INFURA_PLAN / SWIFTNODES_PLAN', () => {
  assert.strictEqual(PR.planOf('infura', env({})), 'free');
  assert.strictEqual(PR.planOf('infura', env({ INFURA_PLAN: 'Team' })), 'team');
  assert.strictEqual(PR.planOf('swiftnodes', env({ SWIFTNODES_PLAN: 'nonsense' })), 'free');
  assert.strictEqual(PR.planOf('alchemy', env({})), null, 'no published plan data: nothing assumed');
});

test('the documented numbers are the ones used', () => {
  assert.deepStrictEqual(PR.P.infura.plans.free, { perDay: 3e6, perSec: 500 });
  assert.strictEqual(PR.P.infura.cost.eth_call, 80); assert.strictEqual(PR.P.infura.ws.newHeadsPerBlock, 50); assert.strictEqual(PR.P.infura.ws.logsPerBlock, 300);
  const f = PR.P.swiftnodes.plans.free;
  assert.deepStrictEqual([f.perSec, f.perMonth, f.wsMsgPerSec, f.wsConns, f.wsLogs, f.batchMax, f.getLogsBlocks], [20, 250000, 1, 1, false, 20, 100]);
  assert.deepStrictEqual([PR.P.swiftnodes.plans.pro.perSec, PR.P.swiftnodes.plans.pro.wsMsgPerSec], [600, 250]);
  assert.strictEqual(PR.P.swiftnodes.methods.trace, false, 'trace_* is unavailable on SwiftNodes Arbitrum (matrix)');
  assert.ok(PR.SOURCES.infura.length >= 4 && PR.SOURCES.swiftnodes.length >= 6);
});

test('scan pacing: a scan of N requests fits each plan', () => {
  // Infura free: 236 × 80 credits = 18,880 a scan; 3M a day at 80% → one scan every 680 s
  assert.strictEqual(PR.minScanInterval(INF, env({}), 236), 680);
  assert.strictEqual(PR.minScanInterval(INF, env({ INFURA_PLAN: 'team' }), 236), Math.ceil((86400 * 236 * 80) / (75e6 * 0.8)));
  // SwiftNodes free: 250,000 a month (/31 days) at 80%
  assert.strictEqual(PR.minScanInterval(SW, env({}), 236), Math.ceil((86400 * 236) / ((250000 / 31) * 0.8)));
  // paid SwiftNodes has no monthly cap: only the per-second rate binds
  assert.strictEqual(PR.minScanInterval(SW, env({ SWIFTNODES_PLAN: 'growth' }), 236), Math.ceil(Math.max((86400 * 236) / (150 * 86400 * 0.8), 236 / (150 * 0.8))));
  assert.strictEqual(PR.minScanInterval(AL, env({}), 236), null, 'unknown limits: no pacing invented');
  assert.strictEqual(PR.minScanInterval(INF, env({}), 0), null);
});

test('the engine governor raises the interval only when the plan needs it', () => {
  assert.strictEqual(DM.governInterval(INF, env({}), 236, 900), null, 'already slow enough');
  const g = DM.governInterval(INF, env({}), 236, 12);
  assert.strictEqual(g.interval, 680); assert.match(g.why, /Infura free allows one scan of 236 requests every 680 s/); assert.match(g.why, /INFURA_PLAN/);
  assert.strictEqual(DM.governInterval(AL, env({}), 236, 12), null);
});

test('websocket feed policy per plan', () => {
  const inf = PR.feedPolicy(INF_WS, env({}));
  assert.strictEqual(inf.use, false, 'Infura free: 17.3M credits a day for new blocks alone > 3M: never connected'); assert.match(inf.why, /17\.3M credits a day/);
  assert.strictEqual(PR.feedPolicy(INF_WS, env({ INFURA_PLAN: 'developer' })).use, false, 'developer 15M is still below 17.3M');
  const team = PR.feedPolicy(INF_WS, env({ INFURA_PLAN: 'team' }));
  assert.deepStrictEqual([team.use, team.logs], [true, false], 'team: blocks fit, swap logs (300/block) do not');
  assert.deepStrictEqual([PR.feedPolicy(INF_WS, env({ INFURA_PLAN: 'custom' })).use, PR.feedPolicy(INF_WS, env({ INFURA_PLAN: 'custom' })).logs], [true, true]);
  const sw = PR.feedPolicy(SW_WS, env({}));
  assert.deepStrictEqual([sw.use, sw.logs], [true, false], 'SwiftNodes free: newHeads only');
  assert.deepStrictEqual([PR.feedPolicy(SW_WS, env({ SWIFTNODES_PLAN: 'starter' })).logs], [true]);
  assert.strictEqual(PR.feedPolicy('wss://arb-mainnet.g.alchemy.com/v2/k', env({})).use, true);
});

test('batch and eth_getLogs caps come from the plan', () => {
  assert.strictEqual(PR.batchMax(SW, env({})), 20); assert.strictEqual(PR.batchMax(SW, env({ SWIFTNODES_PLAN: 'pro' })), null);
  assert.strictEqual(PR.batchMax(INF, env({})), null);
  assert.strictEqual(PR.logsMaxBlocks(SW, env({})), 100); assert.strictEqual(PR.logsMaxBlocks(AL, env({})), null);
  const { loadConfig } = require('../lib/config.cjs');
  const cfg = loadConfig('/nonexistent/.env', { ARB_RPC_URL: SW, SWIFTNODES_PLAN: 'free' });
  assert.strictEqual(cfg.rpcBatchMax, 20, 'the scanning provider is built with the plan\'s batch cap');
});

test('scanning node: most room first; free metered plans become backups; CHRONOS_PRIMARY_NODE overrides', () => {
  const e = { ARB_RPC_URL: INF, ARB_RPC_URL_2: SW, ARB_RPC_URL_3: AL };
  const r = PR.rankForScanning(PR.nodeEntries(env(e)), env(e));
  assert.deepStrictEqual(r.map((x) => x.key), ['ARB_RPC_URL_3', 'ARB_RPC_URL', 'ARB_RPC_URL_2']);
  const pick = DM.choosePrimary(env(e), { rpcUrl: INF });
  assert.strictEqual(pick.key, 'ARB_RPC_URL_3'); assert.match(pick.why, /ARB_RPC_URL is Infura free/);
  assert.strictEqual(DM.choosePrimary(env(e), { rpcUrl: AL }), null, 'already the best');
  assert.strictEqual(DM.choosePrimary(env({ ...e, CHRONOS_PRIMARY_NODE: 'ARB_RPC_URL_2' }), { rpcUrl: INF }).key, 'ARB_RPC_URL_2');
  assert.strictEqual(DM.choosePrimary(env({ ARB_RPC_URL: INF }), { rpcUrl: INF }), null, 'one node: nothing to switch');
  assert.strictEqual(PR.rankForScanning(PR.nodeEntries(env({ ARB_RPC_URL: PUB, ARB_RPC_URL_2: INF })), env({}))[0].key, 'ARB_RPC_URL_2', 'the public RPC scans last');
  assert.strictEqual(PR.nodeEntries(env({ ARB_RPC_URL: INF, ARB_RPC_URL_2: INF })).length, 1, 'the same url counts once');
});

test('limit answers are recognised as limits (paced, not a dead node)', () => {
  for (const m of ['HTTP 429', '{"error":"Rate limited","limit":20,"plan":"free"}', 'daily request count exceeded, request rate limited', 'code -32005'])
    assert.ok(PR.isLimitError(m), m);
  assert.ok(!PR.isLimitError('execution reverted'));
  const R = require('../lib/resolver.cjs');
  if (R.classify) assert.strictEqual(R.classify('daily request count exceeded'), 'rpc-rate-limit');
});

test('chronos nodes lines: provider, plan, limits, feed role; never a key or url', () => {
  const ls = PR.lines([{ key: 'ARB_RPC_URL', url: INF }, { key: 'ARB_RPC_URL_2', url: SW }, { key: 'ARBITRUM_WSS_URL', url: INF_WS }], env({}), 236).join('\n');
  assert.match(ls, /ARB_RPC_URL: Infura · plan free · 3M credits\/day, 500 credits\/s · as the scanning node: one scan every 680 s/);
  assert.match(ls, /SwiftNodes · plan free · 20 req\/s, 250,000 req\/month, batch ≤ 20, logs ≤ 100 blocks/);
  assert.match(ls, /ARBITRUM_WSS_URL: Infura · plan free · .*feed: not used/);
  assert.ok(!/abc123|k1/.test(ls), 'no secret in the output');
});

test('the block feed skips a websocket its plan cannot carry, and streams no swaps where logs are not allowed', () => {
  const { BlockFeed } = require('../lib/blockfeed.cjs');
  const logs = [];
  const f = new BlockFeed({ urls: [INF_WS, SW_WS], onBlock: () => {}, onSwap: () => {}, pools: ['0x' + '1'.repeat(40)], log: (m) => logs.push(m), connect: () => { throw new Error('not connected in this test'); }, policy: (u) => PR.feedPolicy(u, env({})) });
  assert.strictEqual(f.conns.length, 1, 'only the SwiftNodes feed is kept'); assert.strictEqual(f.conns[0].logs, false);
  assert.ok(logs.some((m) => /not used: Infura free/.test(m)));
  assert.strictEqual(f.status().skipped.length, 1);
  // _subscribe never asks a no-logs feed for swap events
  let asked = false; f.conns[0].p = { on: () => { asked = true; }, off: () => {} }; f._subscribe(f.conns[0]); assert.strictEqual(asked, false);
});

test('node pool: every key takes its turn, each inside its plan; a limit cools a node and the next one scans', async () => {
  const { NodePool } = require('../lib/nodepool.cjs');
  let t = 1_000_000; const logs = [];
  const fake = (url) => ({ url, meter: { posts: 0, calls: 0, credits: 0 } });
  const e = { ARB_RPC_URL: INF, ARB_RPC_URL_2: SW, ARB_RPC_URL_3: AL };
  const pool = new NodePool({ entries: PR.nodeEntries(env(e)), get: env(e), connect: async (u) => fake(u), now: () => t, log: (m) => logs.push(m) });
  const scan = async () => { const p = pool.pick(); if (p.wait) return { wait: p.wait }; const pr = await pool.provider(p.node); const b = pool.snap(p.node); pr.meter.posts += 12; pr.meter.calls += 236; pr.meter.credits += pr.url === INF ? 236 * 80 : 0; pool.done(p.node, b); return p.node.key; };
  const order = []; for (let i = 0; i < 3; i++) { order.push(await scan()); t += 1000; }
  assert.deepStrictEqual(order.sort(), ['ARB_RPC_URL', 'ARB_RPC_URL_2', 'ARB_RPC_URL_3'], 'all three keys used');
  const inf = pool.nodes.find((n) => n.key === 'ARB_RPC_URL'); const sw = pool.nodes.find((n) => n.key === 'ARB_RPC_URL_2');
  assert.strictEqual(inf.paceS, 680, 'Infura free paced from its measured credits');
  assert.strictEqual(sw.paceS, PR.minScanInterval(SW, env(e), { posts: 12, calls: 236 }), 'SwiftNodes paced from HTTP posts (a batch is one request)');
  assert.ok(sw.paceS < PR.minScanInterval(SW, env(e), 236), 'batching makes SwiftNodes 236/12 times cheaper');
  // while the metered ones rest, the unmetered one keeps scanning
  for (let i = 0; i < 5; i++) { assert.strictEqual(await scan(), 'ARB_RPC_URL_3'); t += 1000; }
  // a limit answer cools the node, the next pick is another node
  const al = pool.nodes.find((n) => n.key === 'ARB_RPC_URL_3');
  const ms = pool.failed(al, new Error('HTTP 429 Too Many Requests')); assert.ok(ms >= 1000 && ms <= 60000);
  const p = pool.pick(); assert.ok(p.wait > 0, 'Infura and SwiftNodes still resting, Alchemy cooling: wait, never hammer');
  t += ms; assert.strictEqual(pool.pick().node.key, 'ARB_RPC_URL_3');
  // Infura's daily credits: rest until 00:00 UTC
  const dms = pool.failed(inf, new Error('daily request count exceeded, request rate limited'));
  const d = new Date(t); assert.strictEqual(t + dms, Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  assert.ok(pool.status().every((s) => !('url' in s)), 'status carries no url');
});

test('multicall packing grows while full batches pass and halves (still batched) when refused', async () => {
  const { Batcher } = require('../lib/batch.cjs');
  const { ethers } = require('ethers');
  const MC = new ethers.Interface(['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)']);
  let cap = 1000; const sizes = []; let single = 0;
  const p = { call: async ({ to, data }) => {
    if (to !== '0x' + 'c'.repeat(40)) { single++; return '0x01'; } // a call sent on its own, not through Multicall3
    const calls = MC.decodeFunctionData('aggregate3', data)[0]; sizes.push(calls.length);
    if (calls.length > cap) throw new Error('out of gas: gas cap');
    return MC.encodeFunctionResult('aggregate3', [calls.map(() => [true, '0x01'])]);
  } };
  const b = new Batcher(p, { size: 100, maxSize: 400, address: '0x' + 'c'.repeat(40) });
  const run = (n) => Promise.all(Array.from({ length: n }, () => b.call('0x' + '1'.repeat(40), '0x')));
  for (let i = 0; i < 12; i++) await run(400);
  assert.strictEqual(b.size, 400, 'grew to the most calls per eth_call');
  cap = 150; sizes.length = 0; await run(400);
  assert.ok(b.size <= 200 && single === 0, `refused batches are halved and stay multicalls (size ${b.size}, single calls ${single})`);
});

test('registry audit: checksum casing is read anyway, entries without a literal address are skipped (not mismatches)', async () => {
  const { parseRegistry, auditRegistry } = require('../lib/audit.cjs');
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const good = '0x' + 'aB'.repeat(20); // mixed case that is not a valid checksum
  const src = `export const R = [\n { exchange: "UniswapV3", pair: "WETH/USDC", address: "${good}", feeTier: 500 },\n { exchange: 'Sushi', pair: 'X/Y', pool: POOL_CONST, feeTier: 3000 },\n { "exchange": "Pancake", "pair": "A/B", "poolAddress": \`${'0x' + '1'.repeat(40)}\`, feeTier: 100 }\n];`;
  const parsed = parseRegistry(src);
  assert.strictEqual(parsed.length, 3); assert.strictEqual(parsed[2].address, '0x' + '1'.repeat(40), 'backticks and quoted keys parsed');
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), 'registry.ts'); fs.writeFileSync(f, src);
  // a pool read through a stand-in contract runner; real counterpart: chronos audit against Arbitrum One
  const { ethers } = require('ethers'); const C = require('../lib/chain.cjs');
  const iface = new ethers.Interface(C.ABI.v3Pool); const T0 = '0x' + '2'.repeat(40), T1 = '0x' + '3'.repeat(40), FAC = '0x' + '4'.repeat(40);
  const provider = { call: async (tx) => { const fn = iface.parseTransaction({ data: tx.data }); if (!fn) throw new Error('no'); const v = { factory: [FAC], token0: [T0], token1: [T1], fee: [500], liquidity: [10n ** 18n] }[fn.name]; if (!v) return '0x'; return iface.encodeFunctionResult(fn.name, v); }, getNetwork: async () => ({ chainId: 42161n }) };
  provider.provider = provider;
  const rs = await auditRegistry({ ...provider, call: provider.call, resolveName: async (n) => n, _isProvider: true }, f, [{ id: 'uniswapv3', factory: FAC }]).catch((e) => { throw e; });
  assert.strictEqual(rs[1].skipped && /not a literal 0x/.test(rs[1].skipped), true, 'a constant is not a pool to check');
  assert.ok(!rs[0].problems.some((p) => /checksum|not readable/.test(p)), `casing does not make a mismatch (${rs[0].problems.join('; ')})`);
  assert.match(rs[0].notes.join(' '), /correct form 0x/);
});

test('GetBlock: recognised from its endpoint, paced inside its plan (20 CU per Arbitrum call), feed only on plans that carry it', () => {
  const PR = require('../lib/providers.cjs');
  const u = 'https://shared.us-east-1.getblock.io/abcdefgh1234/';
  assert.strictEqual(PR.identify(u).id, 'getblock'); assert.strictEqual(PR.identify('https://go.getblock.io/abcdefgh1234/').id, 'getblock');
  const plan = (p) => (k) => (k === 'GETBLOCK_PLAN' ? p : undefined);
  assert.strictEqual(PR.planOf('getblock', () => undefined), 'free', 'no plan set: the free plan is assumed');
  // free: 50,000 CU a day = 2,500 calls; a 120-call scan fits about 20 times a day at 80% headroom → one per 5,184 s
  assert.strictEqual(PR.minScanInterval(u, plan('free'), 120), Math.ceil((86400 * 120 * 20) / (50000 * PR.HEADROOM)));
  assert.ok(PR.minScanInterval(u, plan('starter'), 120) < 120, 'starter scans about every 90 s');
  assert.ok(PR.minScanInterval(u.replace('shared', 'archive'), plan('starter'), 120) > PR.minScanInterval(u, plan('starter'), 120), 'archive endpoints cost twice');
  assert.strictEqual(PR.feedPolicy(u, plan('free')).use, false, 'a free key cannot carry a block feed (345,600 blocks a day)');
  assert.strictEqual(PR.feedPolicy(u, plan('pro')).use, true);
  const ranked = PR.rankForScanning([{ key: 'GETBLOCK_ARB_URL', url: u }, { key: 'ALCHEMY_RPC_URL', url: 'https://arb-mainnet.g.alchemy.com/v2/x' }], plan('free'));
  assert.strictEqual(ranked[0].key, 'ALCHEMY_RPC_URL', 'a free GetBlock key never becomes the main scanning node over a bigger one');
  assert.ok(PR.SCAN_NODE_KEYS.includes('GETBLOCK_ARB_URL'), 'GETBLOCK_ARB_URL is a node the engine uses');
});

test('a bare GetBlock API key becomes its Arbitrum One endpoint (region from GETBLOCK_REGION) with its websocket', () => {
  const PR = require('../lib/providers.cjs');
  const env = { GETBLOCK_API_KEY: 'abc123DEF456ghi789', GETBLOCK_PLAN: 'starter' };
  const e = PR.nodeEntries((k) => env[k]).find((x) => x.key === 'GETBLOCK_API_KEY');
  assert.strictEqual(e.url, 'https://shared.us-east-1.getblock.io/abc123DEF456ghi789/', 'New York by default');
  assert.strictEqual(PR.identify(e.url).id, 'getblock'); assert.strictEqual(PR.planOf('getblock', (k) => env[k]), 'starter');
  env.GETBLOCK_REGION = 'eu-central-1';
  assert.strictEqual(PR.nodeEntries((k) => env[k]).find((x) => x.key === 'GETBLOCK_API_KEY').url, 'https://shared.eu-central-1.getblock.io/abc123DEF456ghi789/');
  assert.strictEqual(PR.wssFromRpc('https://shared.eu-central-1.getblock.io/abc123DEF456ghi789/'), 'wss://shared.eu-central-1.getblock.io/abc123DEF456ghi789/');
  env.GETBLOCK_REGION = 'mars-1'; assert.match(PR.nodeEntries((k) => env[k]).find((x) => x.key === 'GETBLOCK_API_KEY').url, /us-east-1/, 'an unknown region falls back to New York');
  assert.ok(!PR.nodeEntries((k) => ({ GETBLOCK_API_KEY: 'https://x' })[k]).some((x) => x.key === 'GETBLOCK_API_KEY'), 'a url typed as the key is not used as a key');
});

test('registry audit (2.9.12): a venue with no factory (Curve) no longer makes every pool a mismatch; V2, Algebra and name spellings are read right', async () => {
  const { auditRegistry } = require('../lib/audit.cjs');
  const fs = require('fs'); const os = require('os'); const path = require('path'); const { ethers } = require('ethers');
  const A = (c) => '0x' + c.repeat(40); const UNI = A('a'), SUSHI2 = A('b'), CAMELOT = A('c'), OTHER = A('d'), T0 = A('2'), T1 = A('3');
  const iface = new ethers.Interface(['function factory() view returns (address)', 'function token0() view returns (address)', 'function token1() view returns (address)', 'function fee() view returns (uint24)', 'function liquidity() view returns (uint128)', 'function getReserves() view returns (uint112, uint112, uint32)', 'function globalState() view returns (uint160, int24, uint16, uint16, uint8, uint8, bool)']);
  // each pool answers only what its kind has (a V2 pair has no fee(); an Algebra pool has globalState(), no fee())
  const pools = {
    [A('5')]: { factory: [UNI], token0: [T0], token1: [T1], fee: [500], liquidity: [10n ** 18n] },
    [A('6')]: { factory: [SUSHI2], token0: [T0], token1: [T1], getReserves: [10n ** 20n, 10n ** 20n, 1] },
    [A('7')]: { factory: [CAMELOT], token0: [T0], token1: [T1], globalState: [1n, 0, 300, 0, 0, 0, true], liquidity: [5n] },
    [A('8')]: { factory: [UNI], token0: [T0], token1: [T1], fee: [3000], liquidity: [0n] },
    [A('9')]: { factory: [OTHER], token0: [T0], token1: [T1], getReserves: [1n, 1n, 1] },
  };
  const call = async (tx) => { const fn = iface.parseTransaction({ data: tx.data }); const v = (pools[tx.to.toLowerCase()] || {})[fn.name]; if (!v) throw Object.assign(new Error('execution reverted'), { code: 'CALL_EXCEPTION' }); return iface.encodeFunctionResult(fn.name, v); };
  const src = `export const R = [
 { exchange: "Uniswap", pair: "A/B", address: "${A('5')}", feeTier: 500 },
 { exchange: "SushiSwap", pair: "A/B", address: "${A('6')}", feeTier: 3000 },
 { exchange: "Camelot V3", pair: "A/B", address: "${A('7')}", feeTier: 100 },
 { exchange: "UniswapV3", pair: "A/B", address: "${A('8')}", feeTier: 500 },
 { exchange: "Ramses", pair: "A/B", address: "${A('9')}" },
 { exchange: "PancakeSwap", pair: "A/B", address: "${A('5')}", feeTier: 500 }
];`;
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), 'registry.ts'); fs.writeFileSync(f, src);
  const venues = [{ id: 'uniswap_v3', factory: UNI }, { id: 'sushi_v2', factory: SUSHI2 }, { id: 'camelot_v3', factory: CAMELOT }, { id: 'curve_stable', kind: 'curve', pools: [{ address: A('e') }] }];
  const rs = await auditRegistry({ call, resolveName: async (n) => n, getNetwork: async () => ({ chainId: 42161n }), _isProvider: true }, f, venues);
  const by = rs.map((r) => r.problems);
  assert.deepStrictEqual(by[0], [], 'Uniswap = uniswap_v3; the Curve venue (no factory) no longer breaks the check');
  assert.deepStrictEqual(by[1], [], 'a V2 pair: read with getReserves, no fee tier to compare');
  assert.deepStrictEqual(by[2], [], 'an Algebra pool: dynamic fee, not a mismatch');
  assert.deepStrictEqual(by[3], ['fee labelled 500, on-chain 3000', 'zero liquidity'], 'real problems are still reported');
  assert.deepStrictEqual(by[4], [], 'a factory Chronos does not trade is a note, not a mismatch'); assert.match(rs[4].notes.join(' '), /does not trade/);
  assert.deepStrictEqual(by[5], ['labelled PancakeSwap, pool belongs to uniswap_v3'], 'a wrong exchange label is still caught');
  assert.strictEqual(rs[1].onchain.kind, 'v2'); assert.strictEqual(rs[2].onchain.kind, 'algebra');
});

test('registry audit (2.9.18): the right pool is looked up from the venue factory; a non-pool address is named as such; --fix writes a corrected copy', async () => {
  const { auditRegistry, corrected } = require('../lib/audit.cjs');
  const fs = require('fs'); const os = require('os'); const path = require('path'); const { ethers } = require('ethers');
  const A = (c) => '0x' + c.repeat(40); const UNI = A('a'), WETH = A('2'), USDCE = A('3'), USDC = A('4'), TOKEN = A('6');
  const iface = new ethers.Interface(['function factory() view returns (address)', 'function token0() view returns (address)', 'function token1() view returns (address)', 'function fee() view returns (uint24)', 'function liquidity() view returns (uint128)', 'function getReserves() view returns (uint112, uint112, uint32)', 'function globalState() view returns (uint160, int24, uint16, uint16, uint8, uint8, bool)', 'function getPool(address,address,uint24) view returns (address)', 'function symbol() view returns (string)']);
  const REAL_USDCE_POOL = A('7');
  const answers = {
    [A('5')]: { factory: [UNI], token0: [WETH], token1: [USDC], fee: [500], liquidity: [10n ** 18n] }, // a WETH/USDC (native) pool
    [TOKEN]: { symbol: ['WBTC'] }, // a token, not a pool
  };
  const call = async (tx) => {
    const fn = iface.parseTransaction({ data: tx.data }); const to = tx.to.toLowerCase();
    if (to === UNI && fn.name === 'getPool') { const [a, b, fee] = fn.args.map(String); const k = [a.toLowerCase(), b.toLowerCase()].sort().join() + fee; return iface.encodeFunctionResult('getPool', [k === [WETH, USDCE].sort().join() + '500' ? REAL_USDCE_POOL : ethers.ZeroAddress]); }
    const v = (answers[to] || {})[fn.name]; if (!v) throw Object.assign(new Error('could not decode result data'), { code: 'BAD_DATA' }); return iface.encodeFunctionResult(fn.name, v);
  };
  const src = `export const R = [
 { exchange: "UniswapV3", pair: "WETH/USDC", address: "${A('5')}", token0: "${WETH}", token1: "${USDCE}", feeTier: 500 },
 { exchange: "UniswapV3", pair: "WBTC/WETH", address: "${TOKEN}", feeTier: 500 },
 { exchange: "UniswapV3", pair: "X/Y", address: "${A('9')}", feeTier: 500 }
];`;
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), 'registry.ts'); fs.writeFileSync(f, src);
  const provider = { call, resolveName: async (n) => n, getNetwork: async () => ({ chainId: 42161n }), getCode: async (a) => (a.toLowerCase() === A('9') ? '0x' : '0x6080'), _isProvider: true };
  const rs = await auditRegistry(provider, f, [{ id: 'uniswap_v3', kind: 'v3', factory: UNI }, { id: 'curve_stable', kind: 'curve', pools: [] }]);
  assert.match(rs[0].problems[0], /token 0x33333333… not in this pool/);
  assert.strictEqual(rs[0].suggest.address, ethers.getAddress(REAL_USDCE_POOL), 'the WETH/USDC.e pool at fee 500, from the factory'); assert.match(rs[0].suggest.why, /is a .*\/.* pool/);
  assert.deepStrictEqual(rs[1].problems, ['this address is a contract but not a pool (a token or router?)']); assert.match(rs[1].suggest.why, /add token0 and token1/);
  assert.deepStrictEqual(rs[2].problems, ['nothing is deployed at this address (wrong address?)']);
  const c = corrected(src, rs); assert.strictEqual(c.changed, 1); assert.ok(c.text.includes(ethers.getAddress(REAL_USDCE_POOL)) && !c.text.includes(A('5')));
  assert.strictEqual(fs.readFileSync(f, 'utf8'), src, 'your file is never changed');
});
