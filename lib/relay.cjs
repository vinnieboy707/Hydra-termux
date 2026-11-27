'use strict';
// The price-move relay: one node's log stream serves every engine.
//   · Publisher: an engine whose node streams swap logs (its block feed fires onSwap) gathers the watched pools that
//     moved and, at most every 2 s, posts them as one pool_moves row through the signed ingest function.
//   · Database: each row is broadcast at once on Realtime topic "chronos-pool-moves" (trigger in server/chain.sql).
//   · Listener: every engine subscribes; the pools in a broadcast are re-quoted on the next fast scan, exactly as if
//     its own node had streamed them. An engine whose plan has no log stream (SwiftNodes free, Infura without logs)
//     still re-quotes only what moved instead of every pool every block: fewer calls on every metered node.
// A broadcast is a hint, never a price: the engine re-quotes those pools from the chain itself, only pools already in
// its own market list are used, and at most 2,000 pools a minute are taken. Rows published by this engine come back
// through the broadcast too and are simply re-marked (harmless).
const PUBLISH_EVERY_MS = 2000, MAX_POOLS_ROW = 500, TAKE_PER_MIN = 2000;
const TOPIC = 'chronos-pool-moves';
const ADDR = /^0x[0-9a-f]{40}$/;

/** wss realtime url from the ingest url (https://<ref>.supabase.co/functions/v1/ingest) and the publishable key */
function realtimeUrl(syncUrl, key) {
  const m = String(syncUrl || '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\//i);
  return m && key ? `wss://${m[1]}.supabase.co/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0` : null;
}

class Publisher {
  /** enqueue(table, row): the sync queue · now: clock */
  constructor({ enqueue, now = () => Date.now() }) { this.enqueue = enqueue; this.now = now; this.pools = new Set(); this.block = 0; this.last = 0; this.rows = 0; this.sent = 0; }
  /** the block feed saw a watched pool move */
  moved(pool, block) { const p = String(pool).toLowerCase(); if (!ADDR.test(p)) return; this.pools.add(p); if (Number(block) > this.block) this.block = Number(block); }
  /** called every engine loop: posts one row when 2 s have passed and something moved → rows posted */
  tick() {
    if (!this.pools.size || !this.block || this.now() - this.last < PUBLISH_EVERY_MS) return 0;
    const all = [...this.pools]; this.pools.clear(); this.last = this.now(); let n = 0;
    for (let i = 0; i < all.length; i += MAX_POOLS_ROW) { this.enqueue('pool_moves', { block: this.block, pools: all.slice(i, i + MAX_POOLS_ROW) }); n++; }
    this.rows += n; this.sent += all.length; return n;
  }
  status() { return { rows: this.rows, pools: this.sent, waiting: this.pools.size }; }
}

/** the pools of one Realtime message, or [] (both shapes realtime.send produces) */
function poolsOf(msg) {
  if (!msg || msg.event !== 'broadcast' || !msg.payload) return [];
  const p = msg.payload.payload && msg.payload.event === 'moves' ? msg.payload.payload : msg.payload.event === 'moves' ? msg.payload : null;
  const pools = p && Array.isArray(p.pools) ? p.pools : [];
  return pools.map((x) => String(x).toLowerCase()).filter((x) => ADDR.test(x));
}

class Listener {
  /** url: realtimeUrl() · onPools(pools[]) · WS: WebSocket class (Node 22 global, else the ws package) */
  constructor({ url, onPools, log = () => {}, WS = null, now = () => Date.now() }) {
    this.url = url; this.onPools = onPools; this.log = log; this.now = now;
    this.WS = WS || globalThis.WebSocket || (() => { try { return require('ws'); } catch (_) { return null; } })();
    this.ws = null; this.ref = 0; this.up = false; this.fails = 0; this.msgs = 0; this.taken = 0; this.dropped = 0; this.window = { at: 0, n: 0 }; this.stopped = false; this.why = null;
  }
  start() { if (this.url && this.WS) this._open(); else this.why = this.url ? 'no websocket client' : 'relay not configured'; return this; }
  stop() { this.stopped = true; clearInterval(this.hb); try { if (this.ws) this.ws.close(); } catch (_) { /* closing */ } }
  _send(o) { try { this.ws.send(JSON.stringify({ ...o, ref: String(++this.ref) })); } catch (_) { /* reconnect handles it */ } }
  _open() {
    let ws; try { ws = new this.WS(this.url); } catch (e) { return this._retry(e); }
    this.ws = ws;
    const on = (ev, fn) => (typeof ws.on === 'function' ? ws.on(ev, fn) : ws.addEventListener(ev, fn));
    on('open', () => {
      this._send({ topic: `realtime:${TOPIC}`, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } } });
      clearInterval(this.hb); this.hb = setInterval(() => this._send({ topic: 'phoenix', event: 'heartbeat', payload: {} }), 25000); this.hb.unref?.();
    });
    on('message', (ev) => {
      let m; try { m = JSON.parse(typeof ev === 'string' ? ev : ev && ev.data !== undefined ? String(ev.data) : String(ev)); } catch (_) { return; }
      if (m.event === 'phx_reply' && m.topic === `realtime:${TOPIC}`) { const ok = m.payload && m.payload.status === 'ok'; if (ok && !this.up) { this.up = true; this.fails = 0; this.why = null; this.log('relay: listening for pool moves'); } else if (!ok) this.why = 'join refused'; return; }
      const pools = poolsOf(m); if (!pools.length) return;
      this.msgs++;
      const t = this.now(); if (t - this.window.at > 60000) this.window = { at: t, n: 0 };
      const room = Math.max(0, TAKE_PER_MIN - this.window.n); const take = pools.slice(0, room);
      this.window.n += take.length; this.taken += take.length; this.dropped += pools.length - take.length;
      if (take.length) { try { this.onPools(take); } catch (_) { /* the engine handles its own errors */ } }
    });
    on('close', () => this._retry(new Error('closed')));
    on('error', (e) => this._retry(e));
  }
  _retry(e) {
    if (this.stopped || this.retrying) return;
    this.up = false; this.fails++; this.why = String((e && e.message) || e).slice(0, 80); clearInterval(this.hb);
    try { if (this.ws) this.ws.close(); } catch (_) { /* closing */ }
    this.retrying = true; const wait = Math.min(60000, 1000 * 2 ** Math.min(this.fails - 1, 6));
    setTimeout(() => { this.retrying = false; this._open(); }, wait).unref?.();
  }
  status() { return { up: this.up, messages: this.msgs, poolsTaken: this.taken, poolsDropped: this.dropped, fails: this.fails, why: this.why }; }
}

module.exports = { Publisher, Listener, poolsOf, realtimeUrl, TOPIC, PUBLISH_EVERY_MS, MAX_POOLS_ROW, TAKE_PER_MIN };
