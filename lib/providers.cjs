'use strict';
// What each node provider can do for Chronos, from its own documentation (sources below, checked 2026-11-25), so the
// engine uses every capability a plan has and never runs a plan past its limits. A free plan that is run past its
// limit cuts the key off (Infura severs websockets and refuses calls once the day's credits are spent; SwiftNodes
// stops at 250,000 requests a month), which would silence the engine for hours: the limits are applied before that.
//
// Your plan is read from INFURA_PLAN / SWIFTNODES_PLAN (default free, the safe assumption). Arbitrum One makes a block
// about every 250 ms (docs.arbitrum.io; SwiftNodes measures the same), about 345,600 blocks a day.
const BLOCKS_PER_DAY = 345600;
const HEADROOM = 0.8; // never plan to use more than 80% of a limit: the rest absorbs retries, balance checks, sends

const SOURCES = {
  infura: [
    'https://docs.infura.io/reference/arbitrum.md (endpoints)',
    'https://docs.infura.io/reference/arbitrum/json-rpc-methods.md (standard Ethereum methods supported)',
    'https://docs.infura.io/get-started/pricing.md (plans: credits per day and per second)',
    'https://docs.infura.io/get-started/pricing/credit-cost/ (credits per method and per subscription event)',
    'https://docs.metamask.io/services/reference/linea/json-rpc-methods/eth_getlogs (eth_getLogs: 10,000 results, 10 s)',
  ],
  swiftnodes: [
    'https://swiftnodes.io/arbitrum-rpc (endpoints, chain 42161)',
    'https://swiftnodes.io/docs/method-support (Arbitrum method matrix, tested 2026-11-01)',
    'http://swiftnodes.io/docs/rate-limits (plans, 429 behaviour, batch and eth_getLogs limits)',
    'https://swiftnodes.io/docs/websocket (connections, messages per second, 30-minute idle close)',
    'https://swiftnodes.io/arbitrum-rpc/websocket (subscriptions: newHeads, logs; free = newHeads only)',
    'https://swiftnodes.io/docs/methods/batch (a batch counts as one request)',
    'https://swiftnodes.io/arbitrum-rpc/archive (historical block tags on the same endpoint; paid plans)',
  ],
  drpc: [
    'https://drpc.org/chainlist/arbitrum-mainnet-rpc (public endpoint https://arbitrum.drpc.org)',
    'https://drpc.org/docs/howitworks/ratelimiting (free 25 RPS, 50M CU / 30 days, batch ≤ 3, 2 s timeout, 10,000 logs; paid 100/300/600 RPS)',
  ],
  ankr: [
    'https://www.ankr.com/rpc/ (Arbitrum: public, freemium, premium)',
    'https://www.ankr.com/docs/rpc-service/service-plans/ (≈1,800 req/min public and freemium, ≈1.5k req/s premium; batch 10/100/1000; eth_getLogs 1,000/3,000/10,000 blocks; websocket premium only; 200 credits per EVM call, freemium 200M credits a month)',
  ],
  getblock: [
    'https://docs.getblock.io/rpc-endpoint/how-to-get-an-arbitrum-rpc-endpoint (https://shared.<region>.getblock.io/<TOKEN>/; regions eu-central-1, us-east-1, ap-southeast-1)',
    'https://docs.getblock.io/getting-started/plans-and-limits/cu-and-rate-limits (Free 50,000 CU a day and 20 RPS; Starter 90M CU a month and 250 RPS … Premium 1.6B and 800)',
    'https://docs.getblock.io/getting-started/plans-and-limits/what-counts-as-a-cu (CU = chain multiplier × method multiplier × archive modifier; Arbitrum 20; eth_blockNumber 20 CU; archive endpoints ×2)',
  ],
  chainstack: [
    'https://chainstack.com/build-better-with-arbitrum/ (Arbitrum nodes)',
    'https://docs.chainstack.com/docs/limits (eth_getLogs: Developer 100 blocks, paid 10,000)',
    'https://docs.chainstack.com/docs/rps-plan-limits (Developer 25 RPS, Growth 250, Business 600)',
  ],
};

const P = {
  infura: {
    name: 'Infura', planKey: 'INFURA_PLAN', host: (h) => /(^|\.)infura\.io$/.test(h),
    http: 'https://arbitrum-mainnet.infura.io/v3/<KEY>', wss: 'wss://arbitrum-mainnet.infura.io/ws/v3/<KEY>',
    metered: 'credits',
    plans: { free: { perDay: 3e6, perSec: 500 }, developer: { perDay: 15e6, perSec: 4000 }, team: { perDay: 75e6, perSec: 40000 }, custom: { perDay: Infinity, perSec: Infinity } },
    cost: { eth_call: 80, eth_blockNumber: 80, eth_getLogs: 255, eth_estimateGas: 300, eth_sendRawTransaction: 80, eth_getBalance: 80, eth_chainId: 5, eth_gasPrice: 80, eth_feeHistory: 80, eth_getTransactionReceipt: 80, eth_subscribe: 5, debug_traceCall: 1000, trace: 300 },
    ws: { newHeadsPerBlock: 50, logsPerBlock: 300 },
    getLogs: { maxResults: 10000, maxSeconds: 10, maxBlocks: null },
    batchMax: null,
    methods: { debug_traceCall: true, trace: true, archive: true, eth_getBlockReceipts: true },
    onLimit: 'websockets are severed and calls refused once the day\'s credits are spent (until the daily reset)',
    failover: 'Infura\'s own failover is on Growth/Custom plans only (mainnet)',
  },
  swiftnodes: {
    name: 'SwiftNodes', planKey: 'SWIFTNODES_PLAN', host: (h) => h === 'rpc.swiftnodes.io',
    http: 'https://rpc.swiftnodes.io/rpc/arbitrum?key=<KEY>', wss: 'wss://rpc.swiftnodes.io/ws/arbitrum?key=<KEY>',
    metered: 'requests',
    plans: {
      free: { perSec: 20, perMonth: 250000, wsMsgPerSec: 1, wsConns: 1, wsLogs: false, batchMax: 20, getLogsBlocks: 100, debug: false, archive: false, burst: false },
      starter: { perSec: 70, perMonth: Infinity, wsMsgPerSec: 25, wsConns: 20, wsLogs: true, batchMax: null, getLogsBlocks: null, debug: true, archive: true, burst: true },
      growth: { perSec: 150, perMonth: Infinity, wsMsgPerSec: 75, wsConns: 50, wsLogs: true, batchMax: null, getLogsBlocks: null, debug: true, archive: true, burst: true },
      scale: { perSec: 300, perMonth: Infinity, wsMsgPerSec: 150, wsConns: 100, wsLogs: true, batchMax: null, getLogsBlocks: null, debug: true, archive: true, burst: true },
      pro: { perSec: 600, perMonth: Infinity, wsMsgPerSec: 250, wsConns: 200, wsLogs: true, batchMax: null, getLogsBlocks: null, debug: true, archive: true, burst: true },
      custom: { perSec: 600, perMonth: Infinity, wsMsgPerSec: Infinity, wsConns: Infinity, wsLogs: true, batchMax: null, getLogsBlocks: null, debug: true, archive: true, burst: true },
    },
    // Arbitrum matrix: served ✓ eth_getBlockReceipts, eth_feeHistory, eth_getProof, eth_createAccessList, debug_traceCall,
    // txpool_status, eth_getLogs, JSON-RPC batch, archive · unavailable ✗ trace_block, trace_filter, trace_transaction
    methods: { debug_traceCall: true, trace: false, archive: true, eth_getBlockReceipts: true, txpool_status: true },
    onLimit: 'HTTP 429 with Retry-After: 1 and {"error":"Rate limited"}; refused requests are not queued or billed; free keys stop at 250,000 a month',
    wsIdleCloseMin: 30,
  },
  alchemy: { name: 'Alchemy', host: (h) => /\.g\.alchemy\.com$/.test(h) },
  quicknode: { name: 'QuickNode', host: (h) => /\.quiknode\.pro$/.test(h) },
  chainstack: {
    name: 'Chainstack', planKey: 'CHAINSTACK_PLAN', host: (h) => /\.core\.chainstack\.com$/.test(h), metered: 'requests',
    plans: { developer: { perSec: 25, perMonth: Infinity, getLogsBlocks: 100, batchMax: null }, growth: { perSec: 250, perMonth: Infinity, getLogsBlocks: 10000, batchMax: null }, business: { perSec: 600, perMonth: Infinity, getLogsBlocks: 10000, batchMax: null } },
    freePlan: 'developer', onLimit: 'HTTP 429 above the plan\'s requests per second; -32602 "Block range limit exceeded" over the eth_getLogs range',
  },
  drpc: {
    name: 'dRPC', planKey: 'DRPC_PLAN', host: (h) => h === 'lb.drpc.org' || h === 'arbitrum.drpc.org' || /\.drpc\.(org|live)$/.test(h), metered: 'requests',
    plans: { free: { perSec: 25, perMonth: Infinity, batchMax: 3, getLogsBlocks: null, maxLogs: 10000, timeoutS: 2 }, payg: { perSec: 100, perMonth: Infinity, batchMax: null, getLogsBlocks: null }, pro: { perSec: 300, perMonth: Infinity, batchMax: null, getLogsBlocks: null }, scale: { perSec: 600, perMonth: Infinity, batchMax: null, getLogsBlocks: null } },
    onLimit: 'free nodes: 25 requests a second, 50M compute units per 30 days, 2-second timeout, batches of 3 at most, filter methods off',
  },
  ankr: {
    name: 'Ankr', planKey: 'ANKR_PLAN', host: (h) => h === 'rpc.ankr.com', metered: 'requests', noWssBelow: 'premium',
    // 1,800 requests a minute = 30 a second; freemium: 200M API credits a month at 200 per EVM call = 1,000,000 calls
    plans: { public: { perSec: 30, perMonth: Infinity, batchMax: 10, getLogsBlocks: 1000, ws: false }, freemium: { perSec: 30, perMonth: 1000000, batchMax: 100, getLogsBlocks: 3000, ws: false }, premium: { perSec: 1500, perMonth: Infinity, batchMax: 1000, getLogsBlocks: 10000, ws: true } },
    freePlan: 'public', onLimit: 'requests above about 1,800 a minute (public, freemium) may be refused; websocket only on premium',
  },
  getblock: {
    name: 'GetBlock', planKey: 'GETBLOCK_PLAN', host: (h) => /(^|\.)getblock\.io$/.test(h), metered: 'cu',
    http: 'https://shared.us-east-1.getblock.io/<TOKEN>/', wss: 'wss://shared.us-east-1.getblock.io/<TOKEN>/',
    // CU = chain multiplier (Arbitrum 20) × method multiplier (1 for eth_call, eth_blockNumber, receipts) × archive (2)
    cuPerCall: 20, cuPerCallArchive: 40,
    plans: {
      free: { perDay: 50000, perSec: 20 }, starter: { perDay: 90e6 / 31, perSec: 250 }, growth: { perDay: 185e6 / 31, perSec: 300 },
      advanced: { perDay: 385e6 / 31, perSec: 450 }, scale: { perDay: 700e6 / 31, perSec: 600 }, pro: { perDay: 1e9 / 31, perSec: 800 },
      premium: { perDay: 1.6e9 / 31, perSec: 800 }, dedicated: { perDay: Infinity, perSec: Infinity },
    },
    onLimit: 'requests over the plan\'s RPS or past its CU allowance are refused (the docs give no status code; 429 is treated as the limit)',
    note: 'GetBlock does not publish what a websocket subscription message costs: Chronos counts 20 CU per message, so a block feed (about 345,600 blocks a day) is used only on plans that can carry it',
  },
  public: { name: 'Arbitrum public RPC', host: (h) => /(^|\.)arbitrum\.io$/.test(h), noWss: true, note: 'rate-limited, no websocket, no txpool (docs.arbitrum.io)' },
};

/** which provider a url belongs to: { id, name } (id 'other' when unknown; never the url) */
function identify(url) {
  let h; try { h = new URL(String(url || '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')).hostname; } catch (_) { return { id: 'none', name: 'not a url' }; }
  for (const [id, p] of Object.entries(P)) if (p.host(h)) return { id, name: p.name };
  return { id: 'other', name: h.replace(/^([^.]+\.)?(?=[^.]+\.[^.]+$)/, '') };
}

/** the plan you set for that provider (INFURA_PLAN / SWIFTNODES_PLAN), else free */
function planOf(id, get = () => undefined) {
  const p = P[id]; if (!p || !p.plans) return null;
  const v = String(get(p.planKey) || '').trim().toLowerCase();
  return p.plans[v] ? v : (p.freePlan || 'free');
}

/** facts for one url: provider, plan, limits; unknown providers get null limits (nothing is assumed) */
function profile(url, get) {
  const who = identify(url); const p = P[who.id] || {}; const plan = planOf(who.id, get);
  return { ...who, plan, limits: plan ? p.plans[plan] : null, metered: p.metered || null, onLimit: p.onLimit || null, methods: p.methods || null };
}

/**
 * Shortest scan interval (seconds) that keeps one url's daily use inside its plan, for a scan that makes `requests`
 * node requests (mostly eth_call through Multicall3). null when the provider publishes no limit we know.
 */
function minScanInterval(url, get, usage) {
  // usage: a number of requests, or a measured { posts, calls, credits } (chain.meter): what the provider really bills
  const u = typeof usage === 'object' && usage ? usage : { calls: usage };
  const requests = f0(u.posts) || f0(u.calls);
  const f = profile(url, get); if (!f.limits || !(requests > 0)) return null;
  if (f.id === 'getblock') {
    // every call is billed (a batch is counted call by call: GetBlock does not say a batch is cheaper)
    const cu = f0(u.calls || u.posts) * (/archive/i.test(url) ? P.getblock.cuPerCallArchive : P.getblock.cuPerCall);
    const byDay = Number.isFinite(f.limits.perDay) ? (86400 * cu) / (f.limits.perDay * HEADROOM) : 0;
    const bySec = Number.isFinite(f.limits.perSec) ? f0(u.calls || u.posts) / (f.limits.perSec * HEADROOM) : 0;
    return Math.ceil(Math.max(byDay, bySec, 0));
  }
  if (f.id === 'infura') {
    const credits = f0(u.credits) || f0(u.calls) * P.infura.cost.eth_call;
    const byDay = (86400 * credits) / (f.limits.perDay * HEADROOM);
    const bySec = credits / (f.limits.perSec * HEADROOM); // a scan's requests, spread at the per-second rate
    return Math.ceil(Math.max(byDay, bySec, 0));
  }
  if (['swiftnodes', 'drpc', 'ankr', 'chainstack'].includes(f.id)) {
    const perDay = Number.isFinite(f.limits.perMonth) ? f.limits.perMonth / 31 : f.limits.perSec * 86400;
    const byDay = (86400 * requests) / (perDay * HEADROOM);
    const bySec = requests / (f.limits.perSec * HEADROOM);
    return Math.ceil(Math.max(byDay, bySec, 0));
  }
  return null;
}

/** largest JSON-RPC batch the plan accepts (ethers batches calls made together; its default is 100) */
function batchMax(url, get) { const f = profile(url, get); return f.limits && f.limits.batchMax ? f.limits.batchMax : null; }

/** largest eth_getLogs block range the plan accepts (null = no published block cap) */
function logsMaxBlocks(url, get) { const f = profile(url, get); return f.limits && f.limits.getLogsBlocks ? f.limits.getLogsBlocks : null; }

/**
 * Should the live block feed use this websocket, and may it stream Swap logs on it?
 * → { use, logs, why }. Cost is per block on Arbitrum (~345,600 a day), so a metered plan is checked against its
 * daily allowance before the feed connects: a feed that spends the key's credits would also stop its HTTP calls.
 */
function feedPolicy(url, get) {
  const f = profile(url, get);
  if (f.id === 'public') return { use: false, logs: false, why: 'Arbitrum\'s public RPC has no websocket' };
  if (f.id === 'infura') {
    const heads = P.infura.ws.newHeadsPerBlock * BLOCKS_PER_DAY; const logs = P.infura.ws.logsPerBlock * BLOCKS_PER_DAY;
    const cap = f.limits.perDay * HEADROOM;
    if (heads > cap) return { use: false, logs: false, why: `Infura ${f.plan}: new blocks alone cost ${(heads / 1e6).toFixed(1)}M credits a day on Arbitrum (50 per block) against ${fmtM(f.limits.perDay)} a day: it would cut off this key, HTTP included. Not used for the feed (set INFURA_PLAN if you are on a bigger plan)` };
    return { use: true, logs: heads + logs <= cap, why: heads + logs <= cap ? `Infura ${f.plan}: blocks and swaps fit the plan` : `Infura ${f.plan}: blocks only (swap logs would cost ${((heads + logs) / 1e6).toFixed(0)}M credits a day)` };
  }
  if (f.id === 'getblock') {
    const perDay = BLOCKS_PER_DAY * P.getblock.cuPerCall; const cap = f.limits.perDay * HEADROOM;
    if (perDay > cap) return { use: false, logs: false, why: `GetBlock ${f.plan}: a block feed would cost about ${(perDay / 1e6).toFixed(1)}M CU a day (20 per block, assumed: GetBlock does not publish it) against ${fmtM(f.limits.perDay)} a day; blocks are polled instead` };
    return { use: true, logs: false, why: `GetBlock ${f.plan}: new blocks (swap streams off: their cost is not published)` };
  }
  if (f.id === 'ankr' && !f.limits.ws) return { use: false, logs: false, why: `Ankr ${f.plan}: websocket is premium only (set ANKR_PLAN=premium if you have it)` };
  if (f.id === 'swiftnodes') {
    if (!f.limits.wsLogs) return { use: true, logs: false, why: `SwiftNodes ${f.plan}: one connection, 1 message a second, new blocks only (swap streams need a paid plan)` };
    return { use: true, logs: true, why: `SwiftNodes ${f.plan}: blocks and swaps (${f.limits.wsMsgPerSec} messages a second)` };
  }
  if (f.limits) return { use: true, logs: true, why: `${f.name} ${f.plan}: websocket used (its message limits are not published; ${f.limits.perSec} req/s applies)` };
  return { use: true, logs: true, why: `${f.name}: no published limit known to Chronos` };
}
const f0 = (n) => (Number.isFinite(n) && n > 0 ? n : 0);
const fmtM = (n) => (Number.isFinite(n) ? (n / 1e6).toFixed(0) + 'M' : 'unlimited');

/**
 * Rank node urls for the scanning role (the busiest one): unmetered or unknown first, then the biggest paid plan,
 * free plans last, the public RPC very last. → [{ key, url, rank, profile }] best first (stable for equal ranks).
 */
function rankForScanning(entries, get) {
  const score = (url) => {
    const f = profile(url, get);
    if (f.id === 'public') return 0;
    if (!f.limits) return 100; // Alchemy, QuickNode, Chainstack, dRPC, your own node: no limit known here
    if (f.id === 'infura') return Math.min(90, 10 + Math.log10(f.limits.perDay) * 5);
    if (f.id === 'getblock') return Number.isFinite(f.limits.perDay) ? Math.min(90, 10 + Math.log10(f.limits.perDay / P.getblock.cuPerCall) * 5) : 100;
    if (['swiftnodes', 'drpc', 'ankr', 'chainstack'].includes(f.id)) return Math.min(90, 10 + Math.log10(Number.isFinite(f.limits.perMonth) ? f.limits.perMonth / 31 : f.limits.perSec * 86400) * 5);
    return 50;
  };
  return entries.map((e, i) => ({ ...e, i, rank: score(e.url), profile: profile(e.url, get) })).sort((a, b) => b.rank - a.rank || a.i - b.i);
}

/** recognise a provider's "limit reached" answer (so it is paced, not treated as a dead node) */
function isLimitError(msg) { return /\b429\b|rate.?limit|too many requests|-32005|request rate exceeded|daily request count exceeded|credits? (limit|exceeded)/i.test(String(msg || '')); }

const SCAN_NODE_KEYS = ['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL', 'ARB_RPC_URL_2', 'ARB_RPC_URL_3', 'ARB_RPC_URL_4', 'ARB_RPC_URL_5', 'DRPC_ARB_URL', 'ANKR_ARB_URL', 'CHAINSTACK_ARB_URL', 'GETBLOCK_ARB_URL'];
// a bare provider API key is a node too: its documented Arbitrum One endpoint
const KEY_URLS = {
  ALCHEMY_API_KEY: (k) => `https://arb-mainnet.g.alchemy.com/v2/${k}`,
  INFURA_API_KEY: (k) => `https://arbitrum-mainnet.infura.io/v3/${k}`,
  SWIFTNODES_API_KEY: (k) => `https://rpc.swiftnodes.io/rpc/arbitrum?key=${encodeURIComponent(k)}`,
  // GetBlock's API key is the access token of your Arbitrum One endpoint, in the path, at the region you picked
  GETBLOCK_API_KEY: (k, get = () => undefined) => `https://shared.${getblockRegion(get)}.getblock.io/${encodeURIComponent(k)}/`,
};
const GETBLOCK_REGIONS = ['us-east-1', 'eu-central-1', 'ap-southeast-1'];
/** GETBLOCK_REGION (where you created the endpoint), default us-east-1 (New York) */
function getblockRegion(get) { const r = String(get('GETBLOCK_REGION') || '').trim().toLowerCase(); return GETBLOCK_REGIONS.includes(r) ? r : 'us-east-1'; }
// keyless public endpoints you can switch on (CHRONOS_PUBLIC_NODES=on): extra failover, each paced inside its free plan
const PUBLIC_NODES = { DRPC_PUBLIC: 'https://arbitrum.drpc.org' };
/** every https Arbitrum node you set (urls, then bare API keys), one entry per distinct url, in .env priority order */
function nodeEntries(get) {
  const seen = new Set();
  const all = [...SCAN_NODE_KEYS.map((key) => ({ key, url: get(key) })), ...Object.entries(KEY_URLS).map(([key, f]) => ({ key, url: /^[A-Za-z0-9_-]{8,128}$/.test(String(get(key) || '')) ? f(get(key), get) : null })),
    ...(String(get('CHRONOS_PUBLIC_NODES') || '').toLowerCase() === 'on' ? Object.entries(PUBLIC_NODES).map(([key, url]) => ({ key, url })) : [])];
  return all.filter((e) => /^https:\/\//.test(e.url || '') && !seen.has(e.url) && seen.add(e.url));
}

/** the provider's websocket url for an https Arbitrum url, or null when the provider has none (the public RPC) */
function wssFromRpc(url) {
  let u; try { u = new URL(String(url || '')); } catch (_) { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname;
  if (/(^|\.)arbitrum\.io$/.test(h)) return null; // the public RPC: no websocket (docs.arbitrum.io)
  if (/\.g\.alchemy\.com$/.test(h)) return 'wss://' + h + u.pathname + u.search;
  if (/\.infura\.io$/.test(h)) return u.pathname.startsWith('/v3/') ? 'wss://' + h + '/ws' + u.pathname : null;
  if (/\.quiknode\.pro$/.test(h) || /\.core\.chainstack\.com$/.test(h)) return 'wss://' + h + u.pathname + u.search;
  if (h === 'lb.drpc.org' && u.pathname === '/ogrpc') return 'wss://' + h + '/ogws' + u.search;
  if (h === 'rpc.swiftnodes.io' && /^\/rpc\/arbitrum\/?$/.test(u.pathname)) return 'wss://' + h + '/ws/arbitrum' + u.search;
  if (/^shared\.[a-z0-9-]+\.getblock\.io$/.test(h)) return 'wss://' + h + u.pathname; // same access token (docs.getblock.io)
  return null;
}

/** lines for `chronos nodes` and the System tab */
function lines(entries, get, requestsPerScan = null) {
  const out = [];
  for (const e of entries) {
    const f = profile(e.url, get);
    const fp = /^wss:/.test(e.url) ? feedPolicy(e.url, get) : null;
    const plan = f.plan ? ` · plan ${f.plan}` : '';
    let lim = '';
    if (f.id === 'infura') lim = ` · ${fmtM(f.limits.perDay)} credits/day, ${f.limits.perSec} credits/s`;
    if (['swiftnodes', 'drpc', 'ankr', 'chainstack'].includes(f.id)) lim = ` · ${f.limits.perSec} req/s${Number.isFinite(f.limits.perMonth) ? `, ${f.limits.perMonth.toLocaleString('en-US')} req/month` : ''}${f.limits.batchMax ? `, batch ≤ ${f.limits.batchMax}` : ''}${f.limits.getLogsBlocks ? `, logs ≤ ${f.limits.getLogsBlocks} blocks` : ''}`;
    const iv = !fp && requestsPerScan ? minScanInterval(e.url, get, requestsPerScan) : null;
    out.push(`${e.key}: ${f.name}${plan}${lim}${fp ? ` · feed: ${fp.use ? (fp.logs ? 'blocks + swaps' : 'blocks only') : 'not used'} (${fp.why})` : ''}${iv ? ` · as the scanning node: one scan every ${iv} s at most (${requestsPerScan} requests a scan)` : ''}`);
  }
  return out;
}

module.exports = { SCAN_NODE_KEYS, KEY_URLS, GETBLOCK_REGIONS, getblockRegion, PUBLIC_NODES, nodeEntries, wssFromRpc, P, SOURCES, BLOCKS_PER_DAY, HEADROOM, identify, planOf, profile, minScanInterval, batchMax, logsMaxBlocks, feedPolicy, rankForScanning, isLimitError, lines };
