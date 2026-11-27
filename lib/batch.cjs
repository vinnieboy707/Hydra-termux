'use strict';
// Read-only call batching. Many eth_calls are packed into one Multicall3.aggregate3 eth_call, so a scan costs a
// handful of RPC round-trips instead of thousands. Every call in a batcher is pinned to ONE block: all quotes in a
// scan describe the same market state, so a spread can never be manufactured by mixing quotes from different blocks.
// If Multicall3 is missing or a whole batch fails (for example a node gas cap), each call is retried on its own at
// the same block. A call that reverts is reported as failed, never as a number.
const { ethers } = require('ethers');

const MULTICALL3 = (process.env.CHRONOS_MULTICALL || '0xcA11bde05977b3631167028862bE2a173976CA11');
const MC = new ethers.Interface(['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)']);
const NETWORK_RE = /timeout|ECONN|ENOTFOUND|EAI_AGAIN|socket|network|503|502|429|rate|SERVER_ERROR|fetch failed/i;

function limiter(n) {
  let active = 0; const q = [];
  const next = () => {
    if (active >= n || !q.length) return;
    active++;
    const { fn, res, rej } = q.shift();
    Promise.resolve().then(fn).then(res, rej).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}

async function retryNetwork(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (!NETWORK_RE.test(String(e && (e.shortMessage || e.message)))) throw e;
      await new Promise((r) => setTimeout(r, 250 * (i + 1) ** 2));
    }
  }
  throw last;
}

class Batcher {
  /**
   * @param provider ethers provider
   * @param o.blockTag block number every call is pinned to ('latest' only for discovery)
   * @param o.multicall false disables batching (individual calls, same block pinning)
   */
  /** o.maxSize: the size grows toward it while full batches succeed (fewer billed calls per scan); o.onSize(n) remembers it */
  constructor(provider, { blockTag = 'latest', size = 100, maxSize = null, onSize = null, multicall = true, concurrency = 8, stats, address = MULTICALL3 } = {}) {
    this.address = address; this.p = provider; this.blockTag = blockTag; this.size = size; this.multicall = multicall;
    this.maxSize = maxSize || size; this.onSize = onSize;
    this.lim = limiter(concurrency); this.q = []; this.timer = null;
    this.stats = stats || { batches: 0, calls: 0, fallbacks: 0, rpc: 0 };
  }
  /** Resolves to { ok: boolean, data: hex } — never throws for a revert. */
  call(target, data) {
    return new Promise((resolve) => {
      this.q.push({ target, data, resolve });
      this.stats.calls++;
      if (this.q.length >= this.size) this._flush();
      else if (!this.timer) this.timer = setImmediate(() => this._flush());
    });
  }
  async _one(target, data) {
    this.stats.rpc++;
    try { const r = await retryNetwork(() => this.p.call({ to: target, data, blockTag: this.blockTag })); return { ok: true, data: r }; }
    catch (_) { return { ok: false, data: '0x' }; }
  }
  _flush() {
    if (this.timer) { clearImmediate(this.timer); this.timer = null; }
    const items = this.q.splice(0, this.size);
    if (!items.length) return;
    if (this.q.length) this.timer = setImmediate(() => this._flush());
    if (!this.multicall) { for (const it of items) this.lim(() => this._one(it.target, it.data)).then(it.resolve); return; }
    this.lim(() => this._multi(items));
  }
  /** one aggregate3 eth_call for these items; refused → halves (still multicalls), never call-by-call above 10 */
  async _multi(items) {
    this.stats.batches++; this.stats.rpc++;
    const data = MC.encodeFunctionData('aggregate3', [items.map((it) => ({ target: it.target, allowFailure: true, callData: it.data }))]);
    try {
      const raw = await retryNetwork(() => this.p.call({ to: this.address, data, blockTag: this.blockTag }));
      const res = MC.decodeFunctionResult('aggregate3', raw)[0];
      if (res.length !== items.length) throw new Error('multicall length mismatch');
      items.forEach((it, i) => it.resolve({ ok: !!res[i].success, data: res[i].returnData }));
      // a full batch went through: pack more into each call next time (each eth_call is billed, its size is not)
      if (items.length >= this.size && this.size < this.maxSize) { this.size = Math.min(this.maxSize, Math.ceil(this.size * 1.25)); if (this.onSize) this.onSize(this.size); }
    } catch (_) {
      // a node may refuse a big batch (gas cap, response size): smaller batches from now on; this one is answered as
      // two half-size multicalls at the same block (call by call only below 10 calls)
      this.stats.fallbacks++;
      this.size = Math.max(10, Math.floor(Math.min(this.size, items.length) / 2)); this.maxSize = Math.max(this.size, Math.floor(this.maxSize * 0.8)); if (this.onSize) this.onSize(this.size);
      if (items.length <= 10) { await Promise.all(items.map(async (it) => it.resolve(await this._one(it.target, it.data)))); return; }
      const h = Math.ceil(items.length / 2);
      await Promise.all([this._multi(items.slice(0, h)), this._multi(items.slice(h))]);
    }
  }
}

async function multicallAvailable(provider, address = MULTICALL3) {
  try { return (await provider.getCode(address)) !== '0x'; } catch (_) { return false; }
}

module.exports = { Batcher, MULTICALL3, multicallAvailable, limiter, retryNetwork };
