'use strict';
// Read-only chain access. Nothing in this file can sign or send a transaction.
// If any check fails the scanner reports it and skips that venue/asset. It never substitutes a made-up number.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { clean, redact } = require('./safety.cjs');
const { Batcher } = require('./batch.cjs');

const AAVE_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
const ZERO = ethers.ZeroAddress;

const ABI = {
  erc20: ['function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function balanceOf(address) view returns (uint256)'],
  aavePool: [
    'function FLASHLOAN_PREMIUM_TOTAL() view returns (uint128)',
    'function ADDRESSES_PROVIDER() view returns (address)',
    'function getReservesList() view returns (address[])',
    'function getConfiguration(address) view returns (tuple(uint256 data))',
    'function getReserveData(address) view returns (tuple(tuple(uint256 data) configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
  ],
  provider: ['function getPriceOracle() view returns (address)'],
  oracle: ['function getAssetPrice(address) view returns (uint256)', 'function BASE_CURRENCY_UNIT() view returns (uint256)'],
  v3Factory: ['function getPool(address,address,uint24) view returns (address)', 'function feeAmountTickSpacing(uint24) view returns (int24)'],
  v3Pool: ['function liquidity() view returns (uint128)', 'function factory() view returns (address)', 'function token0() view returns (address)', 'function token1() view returns (address)', 'function fee() view returns (uint24)'],
  quoterV2: ['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)', 'function factory() view returns (address)'],
  hasFactory: ['function factory() view returns (address)'],
  v2Factory: ['function getPair(address,address) view returns (address)'],
  v2Router: ['function factory() view returns (address)', 'function getAmountsOut(uint256,address[]) view returns (uint256[])'],
  // Curve stable pools (StableSwap-NG and legacy plain 2-coin pools): int128 coin indexes; get_dy includes the pool fee
  curve: ['function coins(uint256) view returns (address)', 'function balances(uint256) view returns (uint256)', 'function get_dy(int128,int128,uint256) view returns (uint256)'],
};

function limiter(n) {
  let active = 0; const q = [];
  const next = () => { if (active >= n || !q.length) return; active++; const { fn, res, rej } = q.shift(); fn().then(res, rej).finally(() => { active--; next(); }); };
  return (fn) => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}

async function retry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const m = String(e && (e.shortMessage || e.message));
      if (/CALL_EXCEPTION|execution reverted|missing revert data/i.test(m)) throw e; // a revert is an answer, not a glitch
      await new Promise((r) => setTimeout(r, 300 * (i + 1) ** 2));
    }
  }
  throw last;
}

/**
 * Count what a node really bills: HTTP posts (SwiftNodes bills one per post, a JSON-RPC batch included), calls, and
 * Infura credits by method. provider.meter = { posts, calls, credits } (read before/after a scan for its usage).
 */
function meter(provider, url, get) {
  const PR = require('./providers.cjs'); const id = PR.identify(url).id; const cost = PR.P.infura.cost;
  const m = provider.meter = { posts: 0, calls: 0, credits: 0 };
  const send = provider._send.bind(provider);
  provider._send = async (payload) => {
    const list = Array.isArray(payload) ? payload : [payload];
    m.posts++; m.calls += list.length;
    if (id === 'infura') for (const p of list) m.credits += cost[p.method] || (/^trace_/.test(p.method) ? cost.trace : 80);
    return send(payload);
  };
  return provider;
}

async function connect(cfg) {
  // the plan's JSON-RPC batch cap (SwiftNodes free: 20 calls; ethers batches up to 100 by default)
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl, 42161, { staticNetwork: ethers.Network.from(42161), ...(cfg.rpcBatchMax ? { batchMaxCount: cfg.rpcBatchMax } : {}) });
  meter(provider, cfg.rpcUrl, cfg.envGet);
  const cid = BigInt(await retry(() => provider.send('eth_chainId', [])));
  if (cid !== 42161n) throw new Error(`RPC reports chain ${cid}, not Arbitrum One (42161). Refusing to continue.`);
  return provider;
}

/** Aave V3: flash premium, which reserves are flash-loanable, available liquidity, oracle prices. */
/**
 * Aave V3: flash premium, which reserves are flash-loanable, available liquidity, oracle prices.
 * Batched: every per-asset read goes out in a few Multicall3 requests instead of ~6 requests per asset.
 */
async function readAave(provider, lim, poolAddress = AAVE_POOL, batcher) {
  if ((await provider.getCode(poolAddress)) === '0x') throw new Error('no code at the Aave pool address');
  const b = batcher || new Batcher(provider, { blockTag: 'latest', multicall: false });
  const P = new ethers.Interface(ABI.aavePool), ER = new ethers.Interface(ABI.erc20), AP = new ethers.Interface(ABI.provider), OR = new ethers.Interface(ABI.oracle);
  const need = async (to, iface, fn, args = []) => {
    const r = await b.call(to, iface.encodeFunctionData(fn, args));
    if (!r.ok) throw new Error(`Aave read ${fn} failed`);
    return iface.decodeFunctionResult(fn, r.data);
  };
  const [prem, ap, listR] = await Promise.all([need(poolAddress, P, 'FLASHLOAN_PREMIUM_TOTAL'), need(poolAddress, P, 'ADDRESSES_PROVIDER'), need(poolAddress, P, 'getReservesList')]);
  const premiumBps = Number(prem[0]);
  const oracleAddr = (await need(ap[0], AP, 'getPriceOracle'))[0];
  const oracle = new ethers.Contract(oracleAddr, ABI.oracle, provider);
  const list = listR[0];
  const [unitR] = await Promise.all([need(oracleAddr, OR, 'BASE_CURRENCY_UNIT')]);
  if (unitR[0] !== 100000000n) throw new Error('Aave oracle base unit is not 1e8; sizing math would be wrong. Stopping.');
  const get = async (to, iface, fn, args) => { const r = await b.call(to, iface.encodeFunctionData(fn, args)); if (!r.ok) return null; try { return iface.decodeFunctionResult(fn, r.data); } catch (_) { return null; } };
  const sym = async (addr) => {
    const r = await b.call(addr, ER.encodeFunctionData('symbol'));
    if (!r.ok) return null;
    try { return ER.decodeFunctionResult('symbol', r.data)[0]; } catch (_) { /* bytes32 symbol (older tokens) */ }
    try { return ethers.decodeBytes32String(r.data.slice(0, 66)); } catch (_) { return null; }
  };
  const assets = await Promise.all(list.map(async (addr) => {
    const out = { address: addr.toLowerCase(), symbol: addr.slice(0, 8), decimals: null, flashEnabled: false, price8: 0n, available: null, notes: [] };
    const [dec, s, conf, price, rd] = await Promise.all([get(addr, ER, 'decimals', []), sym(addr), get(poolAddress, P, 'getConfiguration', [addr]), get(oracleAddr, OR, 'getAssetPrice', [addr]), get(poolAddress, P, 'getReserveData', [addr])]);
    if (!dec || !conf) { out.notes.push('read failed'); return out; }
    out.decimals = Number(dec[0]);
    if (s) out.symbol = clean(s, 12) || out.symbol;
    const data = BigInt(conf[0].data !== undefined ? conf[0].data : conf[0][0]);
    const bit = (n) => ((data >> BigInt(n)) & 1n) === 1n;
    out.flags = { active: bit(56), frozen: bit(57), paused: bit(60), flashLoanEnabled: bit(63) };
    out.flashEnabled = out.flags.active && !out.flags.paused && out.flags.flashLoanEnabled;
    out.price8 = price ? BigInt(price[0]) : 0n;
    if (rd) {
      const bal = await get(addr, ER, 'balanceOf', [rd[0].aTokenAddress]);
      if (bal) out.available = BigInt(bal[0]); else out.notes.push('available liquidity unknown');
    } else out.notes.push('available liquidity unknown');
    return out;
  }));
  return { premiumBps, assets, oracle };
}

/** Confirms each configured venue really is what the config says it is (all venues checked at once). */
async function validateVenues(provider, venuesCfg, lim) {
  const checks = await Promise.all(venuesCfg.venues.map(async (v) => {
    try {
      const codes = await Promise.all([v.factory, v.quoter, v.router].filter(Boolean).map(async (a) => [a, await retry(() => provider.getCode(a))]));
      const missing = codes.find(([, c]) => c === '0x');
      if (missing) return { v, ok: false, why: 'no code at ' + missing[0] };
      if (v.kind === 'curve') {
        // each listed pool must exist and hold exactly the coins listed, at those indexes; a pool that does not is dropped
        const pools = [];
        for (const pl of v.pools || []) {
          try {
            const c = new ethers.Contract(pl.address, ABI.curve, provider);
            const [c0, c1] = await Promise.all([retry(() => c.coins(0)), retry(() => c.coins(1))]);
            if (c0.toLowerCase() === pl.coins[0].toLowerCase() && c1.toLowerCase() === pl.coins[1].toLowerCase()) pools.push(pl);
          } catch (_) { /* not a Curve pool, or not reachable: dropped */ }
        }
        if (!pools.length) return { v, ok: false, why: 'no listed Curve pool holds the coins listed for it' };
        return { v: { ...v, pools }, ok: true, kept: pools.length, of: (v.pools || []).length };
      }
      if (v.kind === 'v3') {
        const [ts, qf, rf] = await Promise.all([
          retry(() => new ethers.Contract(v.factory, ABI.v3Factory, provider).feeAmountTickSpacing(500)),
          retry(() => new ethers.Contract(v.quoter, ABI.quoterV2, provider).factory()),
          v.router ? retry(() => new ethers.Contract(v.router, ABI.hasFactory, provider).factory()) : Promise.resolve(null),
        ]);
        if (Number(ts) !== 10) return { v, ok: false, why: 'factory is not a Uniswap-V3-style factory (tick spacing for 500 != 10)' };
        if (qf.toLowerCase() !== v.factory.toLowerCase()) return { v, ok: false, why: 'quoter.factory() does not match the configured factory' };
        if (rf && rf.toLowerCase() !== v.factory.toLowerCase()) return { v, ok: false, why: 'router.factory() does not match the configured factory' };
      } else {
        const rf = await retry(() => new ethers.Contract(v.router, ABI.v2Router, provider).factory());
        if (rf.toLowerCase() !== v.factory.toLowerCase()) return { v, ok: false, why: 'router.factory() does not match the configured factory' };
      }
      return { v, ok: true };
    } catch (e) { return { v, ok: false, why: redact(e.shortMessage || e.message).slice(0, 100) }; }
  }));
  const report = checks.map((c) => (c.ok ? { id: c.v.id, ok: true, executable: c.v.executable, ...(c.kept !== undefined ? { pools: `${c.kept} of ${c.of}` } : {}) } : { id: c.v.id, ok: false, why: c.why }));
  return { good: checks.filter((c) => c.ok).map((c) => c.v), report };
}

/** Finds every pool/pair for every token pair on every validated venue. Only pools with liquidity are kept. */
/** Finds every pool/pair for every token pair on every validated venue (batched). Only pools with liquidity are kept. */
async function discoverMarkets(provider, venues, tokens, lim, cacheFile, cacheMin, batcher) {
  const key = tokens.slice().sort().join(',') + '|' + venues.map((v) => v.id + ':' + (v.factory || (v.pools || []).map((p) => p.address).join('+'))).sort().join(',');
  if (cacheFile && cacheMin > 0) {
    try {
      const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (c.key === key && Date.now() - c.at < cacheMin * 60000) return c.markets;
    } catch (_) { /* no cache */ }
  }
  const b = batcher || new Batcher(provider, { blockTag: 'latest', multicall: false });
  const f3 = new ethers.Interface(ABI.v3Factory), f2 = new ethers.Interface(ABI.v2Factory), pl = new ethers.Interface(ABI.v3Pool), pr = new ethers.Interface(['function getReserves() view returns (uint112, uint112)']);
  const lookups = [];
  // Curve: the listed pools whose two coins are both in the token universe; dx = 0.01% of each coin's balance, the
  // tiny trade the price screen reads each block (decimal-free)
  const tokSet = new Set(tokens.map((t) => t.toLowerCase())); const cv = new ethers.Interface(ABI.curve);
  const curveMarkets = [];
  await Promise.all(venues.filter((v) => v.kind === 'curve').flatMap((v) => (v.pools || []).map(async (pl) => {
    const coins = pl.coins.map((x) => x.toLowerCase());
    if (!coins.every((x) => tokSet.has(x))) return;
    const bals = await Promise.all([0, 1].map(async (i) => { const r = await b.call(pl.address, cv.encodeFunctionData('balances', [i])); try { return r.ok ? BigInt(cv.decodeFunctionResult('balances', r.data)[0]) : 0n; } catch (_) { return 0n; } }));
    if (bals.some((x) => x === 0n)) return; // empty pool
    const tok = (x) => tokens.find((t) => t.toLowerCase() === x);
    curveMarkets.push({ id: `${v.id}:${pl.address.slice(0, 8).toLowerCase()}`, venueId: v.id, kind: 'curve', fee: 0, pair: [tok(coins[0]), tok(coins[1])], coins: [tok(coins[0]), tok(coins[1])], dx: bals.map((x) => String(x / 10000n > 0n ? x / 10000n : 1n)), address: pl.address.toLowerCase(), executable: v.executable, router: null, factory: null });
  })));
  for (let i = 0; i < tokens.length; i++) for (let j = i + 1; j < tokens.length; j++) {
    const [a, c] = [tokens[i], tokens[j]];
    for (const v of venues) {
      if (v.kind === 'curve') continue;
      if (v.kind === 'v3') for (const fee of v.fees) lookups.push({ v, fee, pair: [a, c], call: b.call(v.factory, f3.encodeFunctionData('getPool', [a, c, fee])), dec: (d) => f3.decodeFunctionResult('getPool', d)[0] });
      else lookups.push({ v, fee: 0, pair: [a, c], call: b.call(v.factory, f2.encodeFunctionData('getPair', [a, c])), dec: (d) => f2.decodeFunctionResult('getPair', d)[0] });
    }
  }
  const found = [];
  await Promise.all(lookups.map(async (l) => {
    const r = await l.call; if (!r.ok) return;
    let addr; try { addr = l.dec(r.data); } catch (_) { return; }
    if (!addr || addr === ZERO) return;
    found.push({ ...l, address: addr });
  }));
  const markets = [];
  await Promise.all(found.map(async (l) => {
    // keep only pools that hold liquidity right now (V3: active liquidity; V2: both reserves non-zero)
    if (l.v.kind === 'v3') {
      const r = await b.call(l.address, pl.encodeFunctionData('liquidity'));
      if (!r.ok) return; let liq; try { liq = pl.decodeFunctionResult('liquidity', r.data)[0]; } catch (_) { return; }
      if (liq === 0n) return;
      markets.push({ id: `${l.v.id}:${l.fee}:${l.address.slice(0, 8)}`, venueId: l.v.id, kind: 'v3', fee: l.fee, pair: l.pair, address: l.address.toLowerCase(), executable: l.v.executable, router: l.v.router, quoter: l.v.quoter, factory: l.v.factory.toLowerCase() });
    } else {
      const r = await b.call(l.address, pr.encodeFunctionData('getReserves'));
      if (r.ok) { try { const [r0, r1] = pr.decodeFunctionResult('getReserves', r.data); if (r0 === 0n || r1 === 0n) return; } catch (_) { /* unusual pair ABI: keep; quotes decide */ } }
      markets.push({ id: `${l.v.id}:${l.address.slice(0, 8)}`, venueId: l.v.id, kind: 'v2', fee: 0, pair: l.pair, address: l.address.toLowerCase(), executable: l.v.executable, router: l.v.router, factory: l.v.factory.toLowerCase() });
    }
  }));
  markets.push(...curveMarkets);
  markets.sort((x, y) => (x.id < y.id ? -1 : 1));
  if (cacheFile && cacheMin > 0) {
    try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify({ key, at: Date.now(), markets })); } catch (_) { /* cache is optional */ }
  }
  return markets;
}

/**
 * Real on-chain quote for one swap on one market, or null. All quotes go through the scan's batcher, so they are
 * pinned to the scan's block. Identical quotes inside one scan are asked once (cached promise).
 */
function makeQuoter(provider, counter, batcher) {
  const b = batcher || new Batcher(provider, { blockTag: 'latest', multicall: false });
  const q2 = new ethers.Interface(ABI.quoterV2); const v2 = new ethers.Interface(ABI.v2Router); const cv = new ethers.Interface(ABI.curve);
  const cache = new Map();
  return function quote(market, tokenIn, tokenOut, amountIn) {
    const k = `${market.id}|${tokenIn}|${tokenOut}|${amountIn}`;
    if (cache.has(k)) { counter.cached = (counter.cached || 0) + 1; return cache.get(k); }
    const p = (async () => {
      counter.n++;
      try {
        if (market.kind === 'curve') {
          const i = market.coins.indexOf(tokenIn), j = market.coins.indexOf(tokenOut);
          if (i < 0 || j < 0 || i === j) { counter.fail++; return null; }
          const r = await b.call(market.address, cv.encodeFunctionData('get_dy', [i, j, amountIn]));
          if (!r.ok) { counter.fail++; return null; }
          const out = BigInt(cv.decodeFunctionResult('get_dy', r.data)[0]);
          return out > 0n ? out : null;
        }
        if (market.kind === 'v3') {
          const r = await b.call(market.quoter, q2.encodeFunctionData('quoteExactInputSingle', [{ tokenIn, tokenOut, amountIn, fee: market.fee, sqrtPriceLimitX96: 0 }]));
          if (!r.ok) { counter.fail++; return null; }
          const out = BigInt(q2.decodeFunctionResult('quoteExactInputSingle', r.data)[0]);
          return out > 0n ? out : null;
        }
        const r = await b.call(market.router, v2.encodeFunctionData('getAmountsOut', [amountIn, [tokenIn, tokenOut]]));
        if (!r.ok) { counter.fail++; return null; }
        const amounts = v2.decodeFunctionResult('getAmountsOut', r.data)[0];
        const out = BigInt(amounts[amounts.length - 1]);
        return out > 0n ? out : null;
      } catch (_) { counter.fail++; return null; }
    })();
    cache.set(k, p);
    return p;
  };
}

module.exports = { AAVE_POOL, ABI, limiter, retry, connect, meter, readAave, validateVenues, discoverMarkets, makeQuoter };
