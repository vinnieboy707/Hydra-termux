'use strict';
// Incident resolver: every problem the engine detects, or an error line in its log, opens an INCIDENT. The resolver
// works through that problem's researched resolutions in order, one at a time, never repeating one within an incident,
// and verifies each by watching whether the problem is gone afterwards. When the list is used up, an AI agent (if you
// configured one) may pick further steps, but only from the same allowlist of safe, reversible actions. Anything else
// is escalated to you with the guide's steps. Every attempt, its verification and its evidence are recorded, posted to
// your webhook and shown in the portal. A problem that keeps coming back is escalated instead of being retried in a loop.
const fs = require('fs');
const path = require('path');
const { redact } = require('./safety.cjs');

const MIN = 60000;
// Allowlisted actions. Every one is safe and reversible: none touches keys, limits, deploys, code or funds.
const ACTIONS = {
  'web-reference-check': 'compare your node with Arbitrum\'s public endpoint (is the chain moving? is your node behind or down?)',
  'reinit': 're-initialise the chain connection, venues and pool list',
  'failover-node': 'switch to your next configured RPC node',
  'backoff': 'double the time between scans (at most 5 minutes)',
  'reduce-load': 'halve parallel quotes and batch size, and pause the fast lane',
  'fast-lane-off': 'pause the per-block fast lane (full scans continue)',
  'clear-market-cache': 'drop the cached pool list and rediscover pools',
  'restart-feed': 'reconnect the websocket block feeds',
  'scan-now': 'start a scan immediately',
  'shadow-only': 'stop sending for an hour (shadow tests continue; nothing is sent)',
  'flush-sync': 'push the queued portal rows now',
  'prune-logs': 'rotate engine logs larger than 5 MB (the last 1 MB is kept)',
  'restart-engine': 'restart the engine (at most 3 times an hour)',
};

// Problems: the guide row that explains each (docs/OPERATIONS.md), its researched resolutions in order, and what only
// you can do when they are used up.
const PROBLEMS = {
  'nodes-down': { symptom: 'No RPC node answers as Arbitrum One', ladder: ['web-reference-check', 'reinit', 'failover-node', 'backoff', 'reduce-load'], you: 'fix the url in chronos setup or add ARB_RPC_URL_2' },
  'rpc-unreachable': { symptom: 'Node unreachable or timing out', ladder: ['web-reference-check', 'reinit', 'failover-node', 'backoff'], you: 'check your provider; add a second node (ARB_RPC_URL_2)' },
  'rpc-rate-limit': { symptom: 'Node rate-limited (HTTP 429)', ladder: ['reduce-load', 'backoff', 'fast-lane-off', 'failover-node'], you: 'chronos nodes shows each plan\'s limits; raise the plan (INFURA_PLAN / SWIFTNODES_PLAN tell Chronos) or add a node from another provider' },
  'rpc-lagging': { symptom: 'Node behind the chain', ladder: ['failover-node', 'reinit'], you: 'switch provider or add a second node' },
  'scan-error': { symptom: 'Last scan failed', ladder: ['reinit', 'failover-node', 'clear-market-cache', 'reduce-load', 'backoff'], you: 'read the message; chronos doctor' },
  'scans-stale': { symptom: 'Stage 2 not met, 0 errors', ladder: ['scan-now', 'reinit', 'restart-engine'], you: 'chronos service status, then chronos service restart' },
  'quotes': { symptom: 'Many quotes failing', ladder: ['reduce-load', 'failover-node', 'clear-market-cache'], you: 'check your node; chronos doctor' },
  'venues': { symptom: 'No executable venue passed its check', ladder: ['web-reference-check', 'reinit', 'failover-node'], you: 'check venues.json against the chain (chronos audit)' },
  'aave': { symptom: 'Aave reports no flash-loanable asset', ladder: ['web-reference-check', 'reinit', 'failover-node'], you: 'check Aave status; the engine stays in shadow' },
  'feed-down': { symptom: 'Websocket feed down', ladder: ['restart-feed', 'fast-lane-off'], you: 'check the wss url (chronos set ARBITRUM_WSS_URL)' },
  'sync-backlog': { symptom: 'Portal sync backlog', ladder: ['flush-sync'], you: 'chronos device (approved?), then check the portal' },
  'disk': { symptom: 'Disk full or state cannot be written', ladder: ['prune-logs'], you: 'free space on the device' },
  'reverts': { symptom: 'Trades reverting', ladder: ['shadow-only'], you: 'read the shadow failures in the portal before changing limits' },
  'nonce': { symptom: 'Nonce errors', ladder: ['reinit'], you: 'make sure no other program sends from the executor address' },
  'executor-gas': { symptom: 'Executor out of gas', ladder: [], you: 'send ETH on Arbitrum to the executor address (chronos deploy tops it up)' },
  'integrity': { symptom: '`Code integrity check failed`', ladder: [], you: 'chronos update (reinstalls the verified release) or re-seal a deliberate change' },
  'state-signature': { symptom: 'State file failed its signature check', ladder: [], you: 'something wrote to the engine state file: check the device; chronos service restart' },
  'policy': { symptom: 'Policy check failing', ladder: [], you: 'chronos doctor lists the policy and its fix' },
};

// health problem ids (lib/health.cjs) → problem keys; profit stages and display-only notes are not errors
function keyOf(id) {
  if (/^profit-stage|^history$|^engine$/.test(id)) return null;
  if (id === 'scan' || id === 'scan-streak') return 'scan-error';
  if (id === 'nodes-all') return 'nodes-down';
  if (id.startsWith('node:')) return 'rpc-unreachable';
  if (id === 'stale') return 'scans-stale';
  if (id.startsWith('policy:')) return 'policy';
  return PROBLEMS[id] ? id : null;
}

// error lines in the log → problem keys (first match wins)
const TRIPS = [
  [/\b429\b|rate.?limit|too many requests|-32005|request rate exceeded|daily request count exceeded|credits? (limit|exceeded)/i, 'rpc-rate-limit'],
  [/insufficient funds/i, 'executor-gas'],
  [/nonce (too low|too high|has already been used)|replacement transaction underpriced/i, 'nonce'],
  [/ENOSPC|no space left|state write failed/i, 'disk'],
  [/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|request timeout|timed out/i, 'rpc-unreachable'],
  [/block feed \d+ down/i, 'feed-down'],
];
const ERRORISH = /error|failed|fatal|refused|reverted|timed out|429|rate.?limit|count exceeded|-32005|ENOSPC|insufficient funds|nonce|down \(/i;
function classify(line) { if (!ERRORISH.test(line)) return null; for (const [re, k] of TRIPS) if (re.test(line)) return k; return null; }

class Resolver {
  /**
   * dataDir: where incidents are kept · act(actionId) → Promise<string evidence> (performs an allowlisted action) ·
   * agent: async ({ problem, symptom, detail, tried, allowed }) → { action, reason } | null (optional AI) ·
   * report(kind, payload): webhook / portal / phone · now: clock (tests)
   */
  constructor({ dataDir, act, agent = null, report = () => {}, now = () => Date.now(), verifyMs = 2 * MIN, maxAgentSteps = 2 }) {
    Object.assign(this, { dataDir, act, agent, report, now, verifyMs, maxAgentSteps });
    this.file = path.join(dataDir, 'live', 'incidents.json');
    try { this.st = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (_) { this.st = { open: {}, closed: [] }; }
    this.busy = false;
  }
  save() { try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.st), { mode: 0o600 }); } catch (_) { /* best effort */ } }

  /** a log line: if it is an error the resolver knows, open (or refresh) its incident */
  trip(line) {
    const k = classify(line); if (!k) return null;
    const t = this.now(); const inc = this._open(k, redact(line).slice(0, 200), t);
    inc.lastTrip = t; this.save(); return k;
  }

  _open(k, detail, t) {
    let inc = this.st.open[k];
    if (!inc) {
      const recent = this.st.closed.filter((c) => c.problem === k && t - c.closedAt < 60 * MIN).length;
      inc = this.st.open[k] = { problem: k, symptom: PROBLEMS[k].symptom, opened: t, detail, attempts: [], status: 'open', agentSteps: 0, reopenedInLastHour: recent };
      this.report('incident', { problem: k, symptom: inc.symptom, detail, reopenedInLastHour: recent });
      if (recent >= 3) this._escalate(inc, `came back ${recent} times in the last hour after being resolved: escalated instead of retried`);
    } else inc.detail = detail;
    return inc;
  }

  _escalate(inc, why) {
    if (inc.status === 'escalated') return;
    inc.status = 'escalated'; inc.escalatedAt = this.now(); inc.why = why;
    this.report('escalated', { problem: inc.problem, symptom: inc.symptom, why, tried: inc.attempts.map((a) => `${a.action}: ${a.outcome}`), you: PROBLEMS[inc.problem].you, guide: 'docs/OPERATIONS.md#troubleshooting' });
  }

  _close(k, how) {
    const inc = this.st.open[k]; if (!inc) return;
    inc.status = 'resolved'; inc.closedAt = this.now(); inc.how = how;
    this.st.closed = [...this.st.closed.slice(-99), inc]; delete this.st.open[k];
    this.report('resolved', { problem: k, symptom: inc.symptom, how, attempts: inc.attempts.length });
  }

  /** is problem k present now? present: Set of keys detected this round; a tripped problem counts while it keeps tripping */
  _present(k, present, since) { const inc = this.st.open[k]; return present.has(k) || !!(inc && inc.lastTrip && inc.lastTrip > since); }

  /**
   * One round: problems = health problems [{ id, msg }]. Verifies pending attempts, then starts at most one new
   * resolution (never two at once, so each verification is clean). Returns what it did.
   */
  async tick(problems) {
    if (this.busy) return null; this.busy = true;
    try {
      const t = this.now(); const present = new Set();
      for (const p of problems) { const k = keyOf(p.id); if (!k) continue; present.add(k); this._open(k, redact(p.msg).slice(0, 200), t); }
      // verify the attempt in flight
      for (const [k, inc] of Object.entries(this.st.open)) {
        const a = inc.attempts.find((x) => x.outcome === 'pending'); if (!a) continue;
        if (t < a.at + this.verifyMs) { this.save(); return { waiting: k, action: a.action }; }
        if (this._present(k, present, a.at)) { a.outcome = 'failed'; a.verifiedAt = t; this.report('attempt', { problem: k, action: a.action, outcome: 'failed', evidence: a.evidence }); }
        else { a.outcome = 'resolved'; a.verifiedAt = t; this.report('attempt', { problem: k, action: a.action, outcome: 'resolved', evidence: a.evidence }); this._close(k, a.action); }
      }
      // problems that went away on their own (no attempt in flight, not seen for a verify window)
      for (const [k, inc] of Object.entries(this.st.open)) {
        if (inc.status === 'open' && !inc.attempts.length && !this._present(k, present, t - this.verifyMs) && t - inc.opened >= this.verifyMs) this._close(k, 'cleared on its own');
      }
      // start the next resolution for the most important open incident
      for (const [k, inc] of Object.entries(this.st.open)) {
        if (inc.status !== 'open' || !this._present(k, present, t - this.verifyMs)) continue;
        const tried = new Set(inc.attempts.map((x) => x.action));
        let next = PROBLEMS[k].ladder.find((x) => !tried.has(x)); let by = 'guide';
        if (!next && this.agent && inc.agentSteps < this.maxAgentSteps) {
          const allowed = Object.keys(ACTIONS).filter((x) => !tried.has(x));
          let pick = null;
          try { pick = allowed.length ? await this.agent({ problem: k, symptom: inc.symptom, detail: inc.detail, tried: inc.attempts.map((x) => ({ action: x.action, outcome: x.outcome, evidence: x.evidence })), allowed: allowed.map((x) => ({ action: x, what: ACTIONS[x] })) }) : null; } catch (_) { pick = null; }
          inc.agentSteps++;
          if (pick && allowed.includes(pick.action)) { next = pick.action; by = 'AI agent: ' + redact(String(pick.reason || '')).slice(0, 160); }
        }
        if (!next) { this._escalate(inc, inc.attempts.length ? 'every researched resolution was tried and verified as not working' : 'only you can resolve this'); continue; }
        const at = this.now(); let evidence;
        try { evidence = redact(String(await this.act(next))).slice(0, 300); } catch (e) { evidence = 'action failed: ' + redact(e.message).slice(0, 200); }
        inc.attempts.push({ action: next, by, at, evidence, outcome: 'pending' });
        this.report('attempt', { problem: k, action: next, by, outcome: 'started', evidence });
        this.save(); return { started: k, action: next, by };
      }
      this.save(); return null;
    } finally { this.busy = false; }
  }

  summary() { return { open: Object.values(this.st.open).map((i) => ({ problem: i.problem, status: i.status, attempts: i.attempts.map((a) => `${a.action}:${a.outcome}`) })), resolved: this.st.closed.slice(-10).map((i) => ({ problem: i.problem, how: i.how })) }; }
}

module.exports = { Resolver, ACTIONS, PROBLEMS, TRIPS, classify, keyOf };
