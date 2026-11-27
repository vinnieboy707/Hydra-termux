'use strict';
// Burst mode (2.9.13): every read a scan makes is spread over all your nodes at once, as fast as they answer.
//   · round-robin per request: N nodes answer N requests in parallel; a scan is not tied to one node any more
//   · a rate limit (429, "limit exceeded") or a slow/failed node is never retried on that node: the same request goes
//     to the next node at once, and that node cools down (Retry-After, else 1 s doubling to 60 s; a daily quota until
//     its reset). ethers' own retry (12 tries with growing waits on the SAME node) and its 5-minute timeout are off.
//   · no plan pacing between scans for nodes whose plan refuses past its limit (free tiers, flat plans): hitting the
//     limit costs a cool-down, never money. Nodes that can bill per use (dRPC pay-as-you-go, Ankr premium, Chainstack
//     paid, Alchemy, QuickNode, unknown) stay out unless CHRONOS_BURST_NODES=all, so a burst never runs up a bill.
//   · the send lane is never in the fan: your first node (ARB_RPC_URL) and Arbitrum's own public endpoint carry the
//     executor's reads, simulation and the signed trade, so a scan that spends every quota can never block a trade.
const { ethers } = require('ethers');
const PR = require('./providers.cjs');

const DEFAULT_TIMEOUT_MS = 2500;
const SEQUENCER_RPC = 'https://arb1.arbitrum.io/rpc'; // Arbitrum's public endpoint: free, forwards to the sequencer

/** does a node's plan bill per use past its allowance (true), refuse (false), or is it unknown (null)? */
function billsOverage(url, get = () => undefined) {
  const f = PR.profile(url, get);
  switch (f.id) {
    case 'infura': return false; // hard daily caps on every plan
    case 'swiftnodes': return false; // free: refused (429, not billed); paid: flat, unlimited monthly
    case 'getblock': return false; // CU packages: refused when spent
    case 'public': return false;
    case 'drpc': return f.plan === 'free' ? false : true; // pay-as-you-go above free
    case 'ankr': return f.plan === 'premium' ? true : false; // premium is pay-as-you-go credits
    case 'chainstack': return f.plan === 'developer' ? false : true; // paid plans bill extra requests
    default: return null; // Alchemy, QuickNode, anything else: unknown → treated as billing
  }
}

/** a provider for one node that fails fast: no retry on 429, short timeout; metered like chain.connect */
function fastProvider(url, { get = () => undefined, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const req = new ethers.FetchRequest(url);
  req.timeout = timeoutMs;
  req.setThrottleParams({ maxAttempts: 1 });
  const bm = PR.batchMax(url, get);
  const p = new ethers.JsonRpcProvider(req, 42161, { staticNetwork: ethers.Network.from(42161), batchMaxCount: bm || 20, batchStallTime: 2 });
  return require('./chain.cjs').meter(p, url, get);
}

const limitMsg = (e) => String((e && (e.shortMessage || e.message)) || e) + ' ' + String((e && e.info && e.info.responseStatus) || '');
const retryAfterMs = (e) => { try { const h = e && e.response && e.response.headers; const v = h && (h['retry-after'] || h['Retry-After']); const n = Number(v); return Number.isFinite(n) && n > 0 ? n * 1000 : null; } catch (_) { return null; } };

/**
 * One ethers provider over many nodes. members: [{ key, url, provider? }]. Requests go round-robin to the nodes not
 * cooling; on a limit, error or timeout the same request goes to the next node at once.
 */
class FanProvider extends ethers.JsonRpcProvider {
  constructor(members, { get = () => undefined, timeoutMs = DEFAULT_TIMEOUT_MS, now = () => Date.now(), log = () => {}, make = fastProvider } = {}) {
    if (!members.length) throw new Error('burst mode needs at least one node');
    const bm = Math.min(...members.map((m) => PR.batchMax(m.url, get) || 20));
    super(members[0].url, 42161, { staticNetwork: ethers.Network.from(42161), batchMaxCount: bm, batchStallTime: 2 });
    this.now = now; this.log = log; this.i = 0;
    this.members = members.map((m) => ({ key: m.key, url: m.url, provider: m.provider || make(m.url, { get, timeoutMs }), coolUntil: 0, fails: 0, ok: 0, limited: 0, why: null, inFlight: 0 }));
    this.meter = { posts: 0, calls: 0, credits: 0, failovers: 0 };
  }
  /** nodes free now, starting at the next in turn (each request starts on a different node) */
  order() {
    const t = this.now(); const n = this.members.length; const start = this.i++ % n;
    const live = [];
    for (let k = 0; k < n; k++) { const m = this.members[(start + k) % n]; if (m.coolUntil <= t) live.push(m); }
    return live;
  }
  cool(m, e) {
    const t = this.now(); const msg = limitMsg(e); m.fails++;
    let ms;
    if (PR.isLimitError(msg)) {
      m.limited++; m.why = 'rate limit';
      if (/daily|count exceeded|credits?/i.test(msg)) { const d = new Date(t); ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - t; m.why = 'daily quota spent'; }
      else if (/month/i.test(msg)) { ms = 24 * 3600 * 1000; m.why = 'monthly quota spent'; }
      else ms = retryAfterMs(e) || Math.min(60000, 1000 * 2 ** Math.min(m.fails - 1, 6));
    } else { ms = Math.min(30000, 500 * 2 ** Math.min(m.fails - 1, 6)); m.why = /timeout|TIMEOUT/.test(msg) ? 'slow (timeout)' : msg.slice(0, 50); }
    m.coolUntil = t + ms;
    return ms;
  }
  async _send(payload) {
    const list = Array.isArray(payload) ? payload : [payload];
    this.meter.posts++; this.meter.calls += list.length;
    const tried = [];
    for (const m of this.order()) {
      tried.push(m.key); m.inFlight++;
      try {
        const r = await m.provider._send(payload);
        // a node can answer 200 with a limit error inside the JSON: that is a refusal too
        const lim = (Array.isArray(r) ? r : [r]).find((x) => x && x.error && PR.isLimitError(JSON.stringify(x.error)));
        if (lim) throw Object.assign(new Error(JSON.stringify(lim.error).slice(0, 120)), { limit: true });
        m.ok++; m.fails = 0; m.why = null;
        if (tried.length > 1) this.meter.failovers++;
        return r;
      } catch (e) { this.cool(m, e); } finally { m.inFlight--; }
    }
    // every node refused or is cooling: the scan sees an ordinary error and the engine carries on
    const soon = Math.min(...this.members.map((m) => m.coolUntil)) - this.now();
    throw Object.assign(new Error(`every node is cooling down (rate limits): ${this.members.map((m) => `${m.key}${m.why ? ' ' + m.why : ''}`).join(', ')}`), { allCooling: true, waitMs: Math.max(100, soon) });
  }
  status() {
    const t = this.now();
    return this.members.map((m) => ({ key: m.key, ok: m.ok, limited: m.limited, coolingS: Math.max(0, Math.round((m.coolUntil - t) / 1000)), why: m.why }));
  }
}

/**
 * Which of your nodes go into the fan, and why the others do not. entries: PR.nodeEntries(get) · sendUrl: the node
 * kept for trades (excluded when at least one other node remains) · mode: CHRONOS_BURST_NODES ('free' | 'all')
 */
function members(entries, get, sendUrl, mode = 'free') {
  const inFan = [], out = [];
  const https = entries.filter((e) => /^https:\/\//.test(e.url));
  for (const e of https) {
    const bills = billsOverage(e.url, get);
    if (mode !== 'all' && bills !== false) { out.push({ key: e.key, why: bills === null ? 'plan unknown: it may bill per request (CHRONOS_BURST_NODES=all to include it)' : 'its plan bills per request past the allowance (CHRONOS_BURST_NODES=all to include it)' }); continue; }
    inFan.push(e);
  }
  const keep = inFan.filter((e) => e.url !== sendUrl);
  if (keep.length && keep.length < inFan.length) out.push({ key: inFan.find((e) => e.url === sendUrl).key, why: 'kept for your trades (the send lane): scans never spend it' });
  return { members: keep.length ? keep : inFan, out };
}

module.exports = { FanProvider, fastProvider, billsOverage, members, SEQUENCER_RPC, DEFAULT_TIMEOUT_MS };
