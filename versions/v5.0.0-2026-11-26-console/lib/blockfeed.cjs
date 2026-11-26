'use strict';
// Live block feed over websockets. Every wss:// url you set is connected at once; whichever announces a new block
// first triggers the fast re-check, so a slow or dropped connection costs nothing while another is up. Each
// connection must prove it is Arbitrum One (chain 42161) before its blocks count. Dropped connections reconnect with
// backoff. Read-only: nothing here can sign or send. Urls are secrets: they are never logged.
const { ethers } = require('ethers');
const { redact } = require('./safety.cjs');

const WSS_KEYS = ['ARBITRUM_WSS_URL', 'ARB_WSS_URL', 'ALCHEMY_WSS_URL', 'ARBITRUM_WSS_URL_2', 'ARBITRUM_WSS_URL_3'];
// Swap events of the pool families the scanner trades (Uniswap/Sushi V3, PancakeSwap V3, V2 pairs)
const SWAP_TOPICS = [
  ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)'),
  ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24,uint128,uint128)'),
  ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)'),
];

/** every configured wss url (deduplicated), from a getter like the .env reader */
function wssUrls(get) { return [...new Set(WSS_KEYS.map((k) => get(k)).filter((u) => /^wss:\/\/\S+$/.test(u || '')))]; }

class BlockFeed {
  /** urls: wss urls · onBlock(n): called once per new block number · log: text sink · connect: (url) => provider (tests) */
  /** pools: addresses whose Swap events to stream · onSwap(poolAddress): called for each swap in those pools */
  /** policy(url) → { use, logs, why }: what the provider's plan allows (lib/providers.cjs feedPolicy) */
  constructor({ urls, onBlock, onSwap = null, pools = [], log = () => {}, connect = null, maxBackoffMs = 30000, policy = null }) {
    Object.assign(this, { urls, onBlock, onSwap, log, maxBackoffMs });
    this.pools = pools.map((a) => a.toLowerCase()); this.swaps = 0;
    this.connect = connect || ((u) => new ethers.WebSocketProvider(u, 42161, { staticNetwork: ethers.Network.from(42161) }));
    const pol = (u) => { try { return policy ? policy(u) : { use: true, logs: true, why: null }; } catch (_) { return { use: true, logs: true, why: null }; } };
    this.skipped = [];
    this.last = 0; this.stopped = false;
    this.conns = urls.map((u) => ({ u, pol: pol(u) })).filter((x) => { if (!x.pol.use) { this.skipped.push(x.pol.why); log(`block feed: a websocket is not used: ${x.pol.why}`); } return x.pol.use; })
      .map((x, i) => ({ i, u: x.u, logs: x.pol.logs !== false, plan: x.pol.why, p: null, ok: false, blocks: 0, lastAt: 0, fails: 0, why: null }));
  }
  start() { for (const c of this.conns) this._open(c); return this; }
  /** reconnect every feed now (an allowlisted resolution) */
  restart() {
    for (const c of this.conns) {
      c.retrying = true; // the close this causes must not schedule a second reconnect
      try { if (c.p) c.p.destroy(); } catch (_) { /* closing */ }
      c.p = null; c.ok = false; c.fails = 0; c.why = null;
      setTimeout(() => { c.retrying = false; this._open(c); }, 100).unref?.();
    }
    return `${this.conns.length} feed(s) reconnecting`;
  }
  stop() { this.stopped = true; for (const c of this.conns) { try { if (c.p) c.p.destroy(); } catch (_) { /* closing */ } c.p = null; c.ok = false; } }
  /** what the System tab and the portal show: no urls, only which feed number is up */
  status() { return { skipped: this.skipped.slice(), feeds: this.conns.length, up: this.conns.filter((c) => c.ok).length, lastBlock: this.last || null, watchingPools: this.onSwap ? this.pools.length : 0, swaps: this.swaps, detail: this.conns.map((c) => ({ feed: c.i + 1, up: c.ok, blocks: c.blocks, lastAt: c.lastAt || null, swaps: c.logs, plan: c.plan || null, why: c.why })) }; }
  _open(c) {
    if (this.stopped) return;
    let p;
    try { p = this.connect(c.u); } catch (e) { return this._retry(c, e); }
    c.p = p;
    // listen for the socket's errors at once, before anything is awaited: a socket that fails or is closed while still
    // connecting ("WebSocket was closed before the connection was established") emits an error that, unheard, ends
    // the whole engine. Events from a connection that was already replaced are ignored.
    const down = (e) => { if (c.p === p) this._retry(c, e); };
    let ws = null; try { ws = p.websocket; } catch (_) { ws = null; }
    if (ws && typeof ws.on === 'function') { ws.on('error', (e) => down(e)); ws.on('close', () => down(new Error('connection closed'))); }
    else if (ws && 'onclose' in ws) { ws.onerror = (e) => down(e && e.error ? e.error : new Error('websocket error')); ws.onclose = () => down(new Error('connection closed')); }
    (async () => {
      try {
        const id = BigInt(await p.send('eth_chainId', []));
        if (id !== 42161n) { c.why = `feed ${c.i + 1} is chain ${id}, not Arbitrum One: ignored`; this.log(c.why); c.p = null; try { p.destroy(); } catch (_) { /* closing */ } return; } // wrong chain: never retried
        c.ok = true; c.fails = 0; c.why = null;
        this.log(`block feed ${c.i + 1} connected`);
        p.on('block', (n) => {
          c.blocks++; c.lastAt = Date.now();
          if (n > this.last) { this.last = n; try { this.onBlock(n); } catch (_) { /* the engine handles its own errors */ } }
        });
        this._subscribe(c);
      } catch (e) { down(e); }
    })();
  }
  /** stream Swap events of the watched pools on one connection (re-done when the pool list changes) */
  _subscribe(c) {
    if (!this.onSwap || !this.pools.length || !c.p || !c.logs) return; // the plan has no log streams on this feed
    try { if (c.filter) c.p.off(c.filter); } catch (_) { /* old filter gone */ }
    c.filter = { address: this.pools, topics: [SWAP_TOPICS] };
    c.p.on(c.filter, (l) => { c.swaps = (c.swaps || 0) + 1; this.swaps++; try { this.onSwap(String(l.address).toLowerCase(), l.blockNumber); } catch (_) { /* the engine handles its own errors */ } });
  }
  /** the scanner rediscovered pools: watch the new list on every live connection */
  setPools(pools) { this.pools = pools.map((a) => a.toLowerCase()); for (const c of this.conns) if (c.ok) this._subscribe(c); }
  _retry(c, e) {
    if (this.stopped || c.retrying) return;
    c.ok = false; c.fails++; c.why = redact(String((e && (e.shortMessage || e.message)) || e)).slice(0, 80);
    try { if (c.p) c.p.destroy(); } catch (_) { /* closing */ }
    c.p = null; c.retrying = true;
    const wait = Math.min(this.maxBackoffMs, 1000 * 2 ** Math.min(c.fails - 1, 5));
    this.log(`block feed ${c.i + 1} down (${c.why}); retry in ${Math.round(wait / 1000)} s`);
    setTimeout(() => { c.retrying = false; this._open(c); }, wait).unref?.();
  }
}

module.exports = { BlockFeed, wssUrls, WSS_KEYS, SWAP_TOPICS };
