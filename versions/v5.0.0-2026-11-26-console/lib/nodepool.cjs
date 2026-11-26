'use strict';
// Every Arbitrum node you set works, staggered. Each scan goes to the node with the most room that is free right now:
// an unmetered node (Alchemy, QuickNode, Chainstack, your own) takes every scan it can; a metered free plan (Infura
// credits, SwiftNodes requests) takes a scan only when its own budget allows, measured from what that node really
// billed last time (lib/chain.cjs meter). Add keys and the engine scans more often, each one inside its plan.
// A node that answers "limit" (429, -32005, "Rate limited") cools down (SwiftNodes: Retry-After 1 s; Infura daily
// credits: until 00:00 UTC) and the same scan is retried at once on the next node, so a limit is never a failed scan.
// Read-only: the pool only chooses which node quotes; trades are sent by the executor (all nodes broadcast them).
const PR = require('./providers.cjs');

class NodePool {
  /**
   * entries: [{ key, url }] (PR.nodeEntries) · get: .env reader · connect(url) → Promise<provider> (chain.connect)
   * now: clock (tests) · log: text sink
   */
  constructor({ entries, get, connect, now = () => Date.now(), log = () => {} }) {
    this.get = get; this.connect = connect; this.now = now; this.log = log;
    this.nodes = PR.rankForScanning(entries, get).map((e) => ({ key: e.key, url: e.url, rank: e.rank, profile: e.profile, provider: null, nextAt: 0, coolUntil: 0, fails: 0, scans: 0, last: null, why: null, paceS: null }));
  }

  /** the node to scan with now → { node } or { wait: ms } when every node is spent or cooling */
  pick() {
    const t = this.now();
    // among the nodes free now, the one used longest ago (ties: most room): every key takes its share in turn
    const ready = this.nodes.filter((n) => n.coolUntil <= t && n.nextAt <= t).sort((a, b) => (a.usedAt || 0) - (b.usedAt || 0) || b.rank - a.rank);
    if (ready.length) { ready[0].usedAt = t; return { node: ready[0] }; }
    const soonest = Math.min(...this.nodes.map((n) => Math.max(n.coolUntil, n.nextAt)));
    return { wait: Math.max(250, soonest - t) };
  }

  /** a connected provider for that node (connected once, reused) */
  async provider(n) { if (!n.provider) n.provider = await this.connect(n.url); return n.provider; }

  /** the meter of that node now (to diff before/after a scan) */
  snap(n) { const m = n.provider && n.provider.meter; return m ? { posts: m.posts, calls: m.calls, credits: m.credits } : null; }

  /** a scan on n finished: its billed usage decides when n may scan again */
  done(n, before) {
    const t = this.now(); n.scans++; n.fails = 0; n.why = null;
    const m = this.snap(n); const used = before && m ? { posts: m.posts - before.posts, calls: m.calls - before.calls, credits: m.credits - before.credits } : null;
    n.last = used;
    const s = used ? PR.minScanInterval(n.url, this.get, used) : null;
    if (s && s !== n.paceS) this.log(`${n.key} (${n.profile.name} ${n.profile.plan}): one scan per ${s} s at most on its own (${used.posts} posts, ${used.calls} calls${used.credits ? `, ${used.credits} credits` : ''} a scan)`);
    n.paceS = s; n.nextAt = s ? t + s * 1000 : t;
    return used;
  }

  /** a scan on n failed: a limit cools it down, anything else backs it off; → ms until n is tried again */
  failed(n, err) {
    const t = this.now(); const msg = String((err && (err.shortMessage || err.message)) || err);
    n.fails++;
    let ms;
    if (PR.isLimitError(msg)) {
      // Infura's daily credits reset at 00:00 UTC; SwiftNodes says Retry-After: 1 (its monthly cap: wait a day and re-check)
      if (/daily|count exceeded|credits?/i.test(msg)) { const d = new Date(t); ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - t; }
      else if (/month/i.test(msg)) ms = 24 * 3600 * 1000;
      else ms = Math.min(60000, 1000 * 2 ** Math.min(n.fails - 1, 6));
      n.why = 'at its plan limit';
    } else { ms = Math.min(300000, 5000 * 2 ** Math.min(n.fails - 1, 6)); n.why = msg.slice(0, 60); }
    n.coolUntil = t + ms;
    if (/no network|could not detect|ENOTFOUND|ECONNREFUSED/i.test(msg)) n.provider = null; // reconnect next time
    return ms;
  }

  /** what the System tab and chronos nodes show (no urls) */
  status() {
    const t = this.now();
    return this.nodes.map((n) => ({ key: n.key, provider: n.profile.name, plan: n.profile.plan, scans: n.scans, paceS: n.paceS, readyInS: Math.max(0, Math.round((Math.max(n.nextAt, n.coolUntil) - t) / 1000)), last: n.last, why: n.why }));
  }
}

module.exports = { NodePool };
