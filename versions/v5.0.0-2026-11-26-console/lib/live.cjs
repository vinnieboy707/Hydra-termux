'use strict';
// Glue between the chain and the engine. Read-only: nothing here can sign or send.
const fs = require('fs');
const os = require('os');
const path = require('path');
const C = require('./chain.cjs');
const { Batcher, multicallAvailable, MULTICALL3 } = require('./batch.cjs');
const { ethers } = require('ethers');
const TK = require('./tokens.cjs');
const CY = require('./cycles.cjs');
const { clean } = require('./safety.cjs');

const ROOT = path.join(__dirname, '..');
// all runtime data (history, state, logs, reports) lives here; CHRONOS_DATA_DIR moves it (used by the tests)
const DATA = process.env.CHRONOS_DATA_DIR || path.join(ROOT, 'data');
// Mainnet defaults. The CHRONOS_* overrides exist so the console can be exercised against a local test chain.
const WETH = (process.env.CHRONOS_WETH || '0x82af49447d8a07e3bd95bd0d56f35241523fbab1').toLowerCase();
const AAVE = process.env.CHRONOS_AAVE_POOL || C.AAVE_POOL;
const VENUES_FILE = process.env.CHRONOS_VENUES_FILE || path.join(ROOT, 'venues.json');
// Balancer V2 vault on Arbitrum One (flash loans at the fee its ProtocolFeesCollector reports; read every scan)
const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
// Morpho Blue on Arbitrum One (fee-free flash loans; seen in profitable competitor trades, verified on Blockscout)
const MORPHO = process.env.CHRONOS_MORPHO === 'off' ? null : (process.env.CHRONOS_MORPHO || '0x6c247b1F6182318877311737BaC0844bAa518F5e');
// Uniswap V4's PoolManager: flash accounting, no fee; it can lend whatever it holds of a token (v2.3 contract)
const UNI_V4 = process.env.CHRONOS_UNI_V4 === 'off' ? null : (process.env.CHRONOS_UNI_V4 || '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32');
const IF = {
  erc20: new ethers.Interface(['function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function balanceOf(address) view returns (uint256)']),
  v3: new ethers.Interface(['function slot0() view returns (uint160)']),
  v2: new ethers.Interface(['function getReserves() view returns (uint112, uint112)']),
  v2r: new ethers.Interface(['function getAmountsOut(uint256,address[]) view returns (uint256[])']),
  vault: new ethers.Interface(['function getProtocolFeesCollector() view returns (address)']),
  coll: new ethers.Interface(['function getFlashLoanFeePercentage() view returns (uint256)']),
  curve: new ethers.Interface(['function get_dy(int128,int128,uint256) view returns (uint256)']),
};
const word = (data, i) => BigInt('0x' + (data.slice(2 + 64 * i, 66 + 64 * i) || '0'));

/** Where is the .env? First existing of: ENV_FILE, ./.env, <console>/.env, <console>/../.env, ~/workspaces/chronos-master-workspace/.env */
function findEnvFile() {
  const c = [process.env.ENV_FILE, path.join(process.cwd(), '.env'), path.join(ROOT, '.env'), path.join(ROOT, '..', '.env'),
    path.join(os.homedir(), 'workspaces', 'chronos-master-workspace', '.env')].filter(Boolean);
  return c.find((f) => { try { return fs.statSync(f).isFile(); } catch (_) { return false; } }) || null;
}

/** Where a new .env should go when none exists yet. */
function defaultEnvFile() {
  const found = findEnvFile(); if (found) return found;
  const ws = path.join(os.homedir(), 'workspaces', 'chronos-master-workspace');
  return fs.existsSync(ws) ? path.join(ws, '.env') : path.join(ROOT, '..', '.env');
}

/** Workspace root (for verified_mainnet_actions.json, src/registry.ts): folder that holds the .env, unless CHRONOS_WORKSPACE says otherwise. */
function workspaceDir(envFile) { return process.env.CHRONOS_WORKSPACE || (envFile ? path.dirname(envFile) : process.cwd()); }

async function init(cfg, step = () => {}) {
  step('rpc', 'run');
  const t0 = Date.now();
  const provider = await C.connect(cfg);
  step('rpc', 'ok', `chain 42161 · ${Date.now() - t0} ms`);
  const lim = C.limiter(cfg.CONCURRENCY);
  const multicall = await multicallAvailable(provider);
  const venuesCfg = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf8'));
  step('aave', 'run');
  step('venues', 'run');
  // Aave and the venue checks are independent: run them at the same time
  const [aave, venuesChecked] = await Promise.all([C.readAave(provider, lim, AAVE, new Batcher(provider, { blockTag: 'latest', multicall })), C.validateVenues(provider, venuesCfg, lim)]);
  const flash = aave.assets.filter((a) => a.flashEnabled).length;
  step('aave', 'ok', `${aave.assets.length} reserves · ${flash} flash-loanable · premium ${aave.premiumBps} bps`);
  const usable = aave.assets.filter((a) => a.decimals !== null && a.price8 > 0n);
  const { good, report } = venuesChecked;
  step('venues', good.length ? 'ok' : 'fail', `${good.length}/${report.length} passed on-chain checks`);
  if (!good.length) throw new Error('no venue passed its on-chain check');
  // tokens beyond Aave's reserves: nominated by the public token list, confirmed on-chain here
  const bs = process.env.CHRONOS_BLOCKSCOUT_URL === 'off' ? null : /^https:\/\//.test(process.env.CHRONOS_BLOCKSCOUT_URL || '') ? process.env.CHRONOS_BLOCKSCOUT_URL.replace(/\/+$/, '') : 'https://arbitrum.blockscout.com';
  const want = cfg.DISCOVER_TOKENS !== undefined ? cfg.DISCOVER_TOKENS : Number(process.env.CHRONOS_DISCOVER_TOKENS ?? 40);
  const known = new Set([...usable.map((a) => a.address), ...cfg.SCAN_EXTRA_TOKENS.map((x) => x.toLowerCase())]);
  const nominated = (await TK.discover({ url: bs, limit: want, cacheFile: path.join(DATA, 'tokens_cache.json'), log: (m) => step('discover', 'run', m) })).filter((t) => !known.has(t.address));
  const tokenInfo = new Map(aave.assets.filter((a) => a.decimals !== null).map((a) => [a.address, { symbol: a.symbol, decimals: a.decimals, source: 'aave' }]));
  const vb = new Batcher(provider, { blockTag: 'latest', multicall, size: 200 });
  const extra = [...cfg.SCAN_EXTRA_TOKENS.map((x) => ({ address: x.toLowerCase(), listedSymbol: '' })), ...nominated].filter((t) => !tokenInfo.has(t.address));
  await Promise.all(extra.map(async (t) => {
    const [d, sy] = await Promise.all([vb.call(t.address, IF.erc20.encodeFunctionData('decimals')), vb.call(t.address, IF.erc20.encodeFunctionData('symbol'))]);
    if (!d.ok) return; let dec; try { dec = Number(IF.erc20.decodeFunctionResult('decimals', d.data)[0]); } catch (_) { return; }
    let symbol = t.listedSymbol || t.address.slice(0, 8); if (sy.ok) { try { symbol = clean(IF.erc20.decodeFunctionResult('symbol', sy.data)[0], 12) || symbol; } catch (_) { /* keep */ } }
    tokenInfo.set(t.address, { symbol, decimals: dec, source: nominated.includes(t) ? 'token list, checked on-chain' : 'SCAN_EXTRA_TOKENS' });
  }));
  const tokens = [...new Set([...usable.map((a) => a.address), ...extra.filter((t) => tokenInfo.has(t.address)).map((t) => t.address)])];
  step('discover', 'run', `${tokens.length} tokens × ${good.length} venues`);
  const cacheMin = Number(process.env.MARKET_CACHE_MIN || 360);
  const dstats = { batches: 0, calls: 0, fallbacks: 0, rpc: 0 };
  const markets = await C.discoverMarkets(provider, good, tokens, lim, path.join(DATA, 'markets_cache.json'), cacheMin, new Batcher(provider, { blockTag: 'latest', multicall, stats: dstats, size: 400 }));
  step('discover', 'ok', `${tokens.length} tokens (${tokens.length - usable.length} beyond Aave) · ${markets.length} pools with liquidity · ${multicall ? `batched: ${dstats.calls} calls in ${dstats.rpc} requests` : 'no Multicall3: one request per call'}`);
  // a second flash-loan source, for comparison (your contract borrows from Aave; using this one needs a contract change you approve)
  let balancer = null;
  const bv = process.env.CHRONOS_BALANCER_VAULT === 'off' ? null : (process.env.CHRONOS_BALANCER_VAULT || BALANCER_VAULT);
  if (bv) {
    try {
      if ((await provider.getCode(bv)) !== '0x') {
        const r = await vb.call(bv, IF.vault.encodeFunctionData('getProtocolFeesCollector'));
        if (r.ok) balancer = { vault: bv, collector: IF.vault.decodeFunctionResult('getProtocolFeesCollector', r.data)[0] };
      }
    } catch (_) { balancer = null; }
  }
  return { provider, lim, aave, assets: aave.assets, usable, venueReport: report, markets, tokens, tokenInfo, balancer, multicall, multicallAddress: MULTICALL3 };
}

/** Fresh numbers for one scan: block, gas price, oracle prices. */
/** provider: the node this scan runs on (lib/nodepool.cjs staggers scans across all of yours); default the init node */
async function snapshot(cfg, st, provider = st.provider) {
  const { aave } = st;
  const counter = { n: 0, fail: 0, cached: 0 };
  const t0 = Date.now();
  const [block, gp] = await Promise.all([provider.getBlock('latest'), provider.send('eth_gasPrice', [])]);
  // every quote in this scan is pinned to this block
  const stats = { batches: 0, calls: 0, fallbacks: 0, rpc: 0 };
  // calls per Multicall3 eth_call, learned per node: grows while the node accepts full batches (each eth_call is billed,
  // its size is not), shrinks when it refuses one (gas cap, response size)
  if (!st.batchSizes) st.batchSizes = new WeakMap();
  const learned = st.batchSizes.get(provider) || {};
  const base = Number(process.env.QUOTE_BATCH || 100); const maxQ = Number(process.env.QUOTE_BATCH_MAX || 500);
  const batcher = new Batcher(provider, { blockTag: block.number, multicall: st.multicall !== false, stats, size: learned.q || base, maxSize: Math.max(base, maxQ), onSize: (n) => { learned.q = n; } });
  st.batchSizes.set(provider, learned);
  const keep = () => { learned.q = batcher.size; st.batchSize = batcher.size; };
  const rpcMs = Date.now() - t0;
  // oracle prices at the same block as the quotes
  const oi = new (require('ethers').Interface)(C.ABI.oracle);
  const oAddr = aave.oracle.target;
  await Promise.all(st.assets.map(async (a) => {
    if (a.decimals === null) return;
    const r = await batcher.call(oAddr, oi.encodeFunctionData('getAssetPrice', [a.address]));
    try { a.price8 = r.ok ? BigInt(oi.decodeFunctionResult('getAssetPrice', r.data)[0]) : 0n; } catch (_) { a.price8 = 0n; }
  }));
  const weth = st.assets.find((a) => a.address === WETH);
  if (!weth || !weth.price8) throw new Error('no oracle price for WETH; cannot convert gas to USD (fail-closed)');
  // every pool's price at this block (one batched read): the cycle finder's free screen and the indicators
  const sb = new Batcher(provider, { blockTag: block.number, multicall: st.multicall !== false, stats, size: learned.s || 400, maxSize: 2000, onSize: (n) => { learned.s = n; } });
  const states = new Map();
  await Promise.all(st.markets.map(async (m) => {
    if (m.kind === 'curve') {
      // both directions of a tiny trade (dx = 0.01% of the pool's balance, set at discovery), fee included
      const [a, b] = await Promise.all([0, 1].map((i) => sb.call(m.address, IF.curve.encodeFunctionData('get_dy', [i, 1 - i, BigInt(m.dx[i])]))));
      if (a.ok && b.ok && a.data.length >= 66 && b.data.length >= 66) states.set(m.id, { q01: Number(word(a.data, 0)) / Number(m.dx[0]), q10: Number(word(b.data, 0)) / Number(m.dx[1]) });
      return;
    }
    if (m.kind === 'v3') { const r = await sb.call(m.address, IF.v3.encodeFunctionData('slot0')); if (r.ok && r.data.length >= 66) states.set(m.id, { sqrtPriceX96: word(r.data, 0) & ((1n << 160n) - 1n) }); }
    else { const r = await sb.call(m.address, IF.v2.encodeFunctionData('getReserves')); if (r.ok && r.data.length >= 130) states.set(m.id, { r0: word(r.data, 0), r1: word(r.data, 1) }); }
  }));
  // each V2-style venue's swap fee, derived once from a real quote against real reserves (same block)
  if (!st.v2Fees) {
    const fees = {};
    for (const v of [...new Set(st.markets.filter((m) => m.kind === 'v2').map((m) => m.venueId))]) {
      const m = st.markets.find((x) => x.venueId === v && states.get(x.id) && states.get(x.id).r0 > 1000000n);
      if (!m) continue;
      const s0 = states.get(m.id); const [a, b] = m.pair; const t0 = a < b ? a : b; const t1 = a < b ? b : a;
      const amountIn = s0.r0 / 1000000n;
      const r = await sb.call(m.router, IF.v2r.encodeFunctionData('getAmountsOut', [amountIn, [t0, t1]]));
      if (!r.ok) continue;
      try { const outs = IF.v2r.decodeFunctionResult('getAmountsOut', r.data)[0]; const f = CY.v2FeeFromQuote({ amountIn, amountOut: BigInt(outs[outs.length - 1]), reserveIn: s0.r0, reserveOut: s0.r1 }); if (f !== null) fees[v] = f; } catch (_) { /* unknown: bound stays an upper bound */ }
    }
    st.v2Fees = fees;
  }
  // Balancer: its flash fee and what it holds of each flash-loanable asset, at this block
  let altFlash = null;
  if (st.balancer) {
    const fr = await sb.call(st.balancer.collector, IF.coll.encodeFunctionData('getFlashLoanFeePercentage'));
    if (fr.ok) {
      const pct = BigInt(IF.coll.decodeFunctionResult('getFlashLoanFeePercentage', fr.data)[0]); // 1e18 = 100 %
      const feeBps = Number((pct * 10000n + 10n ** 18n - 1n) / 10n ** 18n); // rounded up
      const available = new Map();
      await Promise.all(st.assets.filter((a) => a.flashEnabled && a.decimals !== null).map(async (a) => {
        const r = await sb.call(a.address, IF.erc20.encodeFunctionData('balanceOf', [st.balancer.vault]));
        if (r.ok) { try { available.set(a.address, BigInt(IF.erc20.decodeFunctionResult('balanceOf', r.data)[0])); } catch (_) { /* unknown */ } }
      }));
      altFlash = { id: 'balancer_v2', feeBps, available, vault: String(st.balancer.vault).toLowerCase() };
    }
  }
  // Morpho Blue: no flash fee; it can lend whatever it holds of a token (docs.morpho.org/learn/concepts/flashloans)
  let morphoFlash = null;
  if (MORPHO) {
    const available = new Map();
    await Promise.all(st.assets.filter((a) => a.flashEnabled && a.decimals !== null).map(async (a) => {
      const r = await sb.call(a.address, IF.erc20.encodeFunctionData('balanceOf', [MORPHO]));
      if (r.ok) { try { available.set(a.address, BigInt(IF.erc20.decodeFunctionResult('balanceOf', r.data)[0])); } catch (_) { /* unknown */ } }
    }));
    morphoFlash = { id: 'morpho_blue', feeBps: 0, available, vault: MORPHO.toLowerCase() };
  }
  let v4Flash = null;
  if (UNI_V4) {
    const available = new Map();
    await Promise.all(st.assets.filter((a) => a.flashEnabled && a.decimals !== null).map(async (a) => {
      const r = await sb.call(a.address, IF.erc20.encodeFunctionData('balanceOf', [UNI_V4]));
      if (r.ok) { try { available.set(a.address, BigInt(IF.erc20.decodeFunctionResult('balanceOf', r.data)[0])); } catch (_) { /* unknown */ } }
    }));
    v4Flash = { id: 'uniswap_v4', feeBps: 0, available, vault: UNI_V4.toLowerCase() };
  }
  const prevStates = st.lastStates || null; st.lastStates = states;
  return {
    assets: st.assets, ethUsd: Number(weth.price8) / 1e8, gasPriceWei: BigInt(gp), premiumBps: aave.premiumBps,
    markets: st.markets, quote: C.makeQuoter(provider, counter, batcher), counter, rpcMs, batchStats: stats, done: keep,
    blockNumber: block.number, nowSec: block.timestamp,
    states, prevStates, v2Fees: st.v2Fees, altFlash, morphoFlash, v4Flash, deadPools: st.deadPools || (st.deadPools = loadBench()), saveBench, tokenInfo: st.tokenInfo || new Map(),
  };
}

// the depth bench outlives restarts (2.9.12): it was kept in memory only, and every crash or update put the same dead
// pools back on the shortlist. data/live/deadpools.json; expired entries are dropped on load.
const BENCH_FILE = () => path.join(DATA, 'live', 'deadpools.json');
function loadBench() {
  const m = new Map(); const now = Date.now();
  try { for (const [id, b] of Object.entries(JSON.parse(fs.readFileSync(BENCH_FILE(), 'utf8')))) if (b && b.until > now) m.set(id, b); } catch (_) { /* none yet */ }
  return m;
}
function saveBench(m) {
  if (!(m instanceof Map)) return;
  try { fs.mkdirSync(path.dirname(BENCH_FILE()), { recursive: true }); const tmp = BENCH_FILE() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(m)), { mode: 0o600 }); fs.renameSync(tmp, BENCH_FILE()); } catch (_) { /* best effort: the bench still works in memory */ }
}

module.exports = { loadBench, saveBench, BENCH_FILE, init, snapshot, findEnvFile, defaultEnvFile, workspaceDir, ROOT, DATA, WETH, AAVE, VENUES_FILE, BALANCER_VAULT, MORPHO, UNI_V4 };
