'use strict';
// Agents that run inside the engine. What each may do on its own, and what waits for you:
//   watchdog    on its own: records every problem and its resolution; restarts a stalled engine (≤ 3 per hour,
//               then it stops restarting and alerts you).
//   profit      on its own: nothing new to do. The profit guard is a demotion rule in mode.cjs (it only ever switches
//               live trading OFF). This agent reports it and every switch.
//   tuner       proposes only: a priority-fee share change when live sends keep losing races. Applied to .env after
//               you approve it in the portal, and only within the bounds in execpolicy.cjs.
//   requirements reports only: contract/flash-loan requirement failures with the owner call that fixes them.
//   diagnosis   reports only: an AI explanation of a new error (agentllm.cjs). It never runs anything.
// Never possible for any agent: touching the signing key, sending funds, changing contract code, raising a limit
// without your approval. Approvals carry only a reference; the action is stored here, so the cloud can say yes or
// no but cannot change what is done.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ENV = require('./envfile.cjs');
const { POLICY, readExecPolicy } = require('./execpolicy.cjs');
const { redact } = require('./safety.cjs');

const HOUR = 3600000, DAY = 86400000;
const APPLIABLE = new Set(POLICY.map((p) => p.key)); // only execution-policy keys, each checked against its bounds

function validChange(key, value) {
  if (!APPLIABLE.has(key)) return `${key} is not a setting agents may change`;
  const r = readExecPolicy((k) => (k === key ? String(value) : undefined));
  return r.problems.length ? r.problems[0] : null;
}

class Agents {
  constructor({ dataDir, envFile, sync, notify = async () => {}, log = () => {}, diagnose = null, now = () => Date.now() }) {
    Object.assign(this, { dataDir, envFile, sync, notify, log, diagnose, now });
    this.file = path.join(dataDir, 'agents', 'state.json');
    this.st = { proposals: {}, restarts: [], reported: {}, diagnosed: {}, diagDay: null, diagCount: 0 };
    try { this.st = { ...this.st, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; } catch (_) { /* first run */ }
    this.wantRestart = null;
    this.nextDecisions = 0;
  }
  save() {
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 }); fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.st), { mode: 0o600 }); fs.renameSync(this.file + '.tmp', this.file); }
    catch (e) { this.log('agents state not saved: ' + e.message); }
  }
  event(agent, severity, source, message, { action = null, outcome = 'none', detail = null } = {}) {
    const row = require('./vocab.cjs').eventRow({ ts: new Date(this.now()).toISOString(), agent, severity, source, message: redact(message).slice(0, 500), action: action && redact(action).slice(0, 300), outcome, detail }); // only words your database accepts
    try { fs.mkdirSync(path.join(this.dataDir, 'agents'), { recursive: true, mode: 0o700 }); fs.appendFileSync(path.join(this.dataDir, 'agents', 'events.jsonl'), JSON.stringify(row) + '\n', { mode: 0o600 }); } catch (_) { /* best effort */ }
    if (this.sync && this.sync.enabled) this.sync.enqueue('agent_events', row);
    return row;
  }

  /** watchdog: problems in / out. fresh, resolved: from health.logNew. problems: current list. */
  async observe({ fresh = [], resolved = [], problems = [] }) {
    const byId = new Map(problems.map((p) => [p.id, p]));
    for (const p of fresh) {
      const sev = p.profit ? 'info' : /^(integrity|nodes-all|scan-streak|stale|state-signature)$/.test(p.id) ? 'critical' : 'warning';
      this.event('watchdog', sev, p.id, p.msg, { outcome: 'detected' });
      if (sev !== 'info' && this.diagnose) await this.tryDiagnose(p);
    }
    for (const id of resolved) this.event('watchdog', 'info', id, `resolved: ${id}`, { outcome: 'fixed' });
    return byId;
  }

  /** watchdog: a running, unpaused engine with no completed scan for this long is restarted by its service manager. */
  checkStall(S) {
    const t = this.now();
    const limit = Math.max(10 * 60000, (S.interval || 30) * 10000);
    if (S.phase !== 'running' || S.paused || S.scanning || !S.lastScanAt || t - S.lastScanAt < limit) return null;
    this.st.restarts = this.st.restarts.filter((x) => t - x < HOUR);
    if (this.st.restarts.length >= 3) {
      if (!this.st.reported.stallEscalated || t - this.st.reported.stallEscalated > HOUR) {
        this.st.reported.stallEscalated = t; this.save();
        this.event('watchdog', 'critical', 'stale', `no completed scan for ${Math.round((t - S.lastScanAt) / 60000)} min after 3 restarts this hour; not restarting again`, { action: 'check the node (ARB_RPC_URL) and the engine log', outcome: 'escalated' });
        this.notify({ id: 'agent:stall', title: 'Chronos watchdog needs you', text: 'Engine stalled after 3 restarts this hour. Check your node and the engine log.', level: 'error', minIntervalMs: 0 });
      }
      return null;
    }
    this.st.restarts.push(t); this.save();
    this.event('watchdog', 'critical', 'stale', `no completed scan for ${Math.round((t - S.lastScanAt) / 60000)} min`, { action: 'restart the engine', outcome: 'fixed' });
    this.wantRestart = 'stalled';
    return 'restart';
  }

  /** profit agent: report every mode switch with its reason. */
  modeChanged(m) {
    const why = m.mode === 'LIVE' ? 'every promotion rule met' : (m.heldWhy || 'a rule failed');
    this.event('profit', m.mode === 'LIVE' ? 'info' : 'warning', 'mode', `switched to ${m.mode}: ${why}`, { action: m.mode === 'LIVE' ? 'sending profitable trades' : 'stopped sending; shadow keeps running', outcome: m.mode === 'LIVE' ? 'none' : 'fixed', detail: { heldUntil: m.heldUntil ? new Date(m.heldUntil).toISOString() : null } });
  }

  /** requirements agent: one report per failing requirement per day. */
  requirements(shadowRun) {
    if (!shadowRun || shadowRun.stage !== 'preflight' || !shadowRun.failed) return;
    for (const f of shadowRun.failed) {
      const k = 'req:' + f.name; const t = this.now();
      if (this.st.reported[k] && t - this.st.reported[k] < DAY) continue;
      this.st.reported[k] = t; this.save();
      this.event('requirements', 'warning', 'preflight', `requirement not met: ${f.name}`, { action: f.fix || 'see the dashboard Measure tab', outcome: 'escalated' });
    }
  }

  /** tuner: when at least 4 live sends today and half or more reverted, propose a higher priority-fee share. */
  tune({ policy, today }) {
    if (!today || today.sent < 4 || today.reverted / today.sent < 0.5) return null;
    const cur = policy.EXEC_TIP_SHARE_BPS; const max = POLICY.find((p) => p.key === 'EXEC_TIP_SHARE_BPS').max;
    if (cur >= max) return null;
    const next = Math.min(max, cur + 1000);
    return this.propose({ agent: 'tuner', kind: 'limit', title: `Raise priority-fee share ${cur / 100}% → ${next / 100}%`,
      action: { type: 'set_env', key: 'EXEC_TIP_SHARE_BPS', value: String(next), from: String(cur) },
      why: `${today.reverted} of ${today.sent} live sends reverted today. On Arbitrum each 125 ms round is ordered by priority fee, so a higher bid wins more races; each win keeps less of its surplus. Your floor still applies to every send.` });
  }

  propose({ agent, kind, title, action, why }) {
    const t = this.now();
    for (const [ref, p] of Object.entries(this.st.proposals)) {
      if (t - p.createdAt > DAY) { delete this.st.proposals[ref]; continue; } // expired unanswered
      if (p.action.key === action.key && p.action.value === action.value) return null; // already asked
    }
    const bad = action.type === 'set_env' ? validChange(action.key, action.value) : 'unknown action';
    if (bad) { this.event(agent, 'warning', 'proposal', `not proposed: ${bad}`, { outcome: 'none' }); return null; }
    const ref = crypto.randomBytes(16).toString('hex');
    this.st.proposals[ref] = { agent, kind, title, action, createdAt: t };
    this.save();
    if (this.sync && this.sync.enabled) this.sync.enqueue('approvals', { ref, agent, kind, title, detail: { change: `${action.key}: ${action.from} → ${action.value}`, why } });
    this.event(agent, 'info', 'proposal', `waiting for your approval: ${title}`, { outcome: 'escalated' });
    this.notify({ id: 'agent:prop:' + ref, title: 'Chronos needs your approval', text: title, minIntervalMs: 0 });
    return ref;
  }

  /** Pull your decisions and apply approved ones. Only proposals this engine made are acted on. */
  async pollDecisions() {
    const t = this.now();
    if (!this.sync || !this.sync.enabled || t < this.nextDecisions || !Object.keys(this.st.proposals).length) return [];
    this.nextDecisions = t + 30000;
    let list;
    try { list = (await this.sync.call('decisions', { op: 'list' })).decisions || []; } catch (e) { this.log('decisions unavailable: ' + redact(e.message)); return []; }
    const done = [];
    for (const d of list) {
      const p = this.st.proposals[d.ref];
      if (!p) continue; // not ours, or already handled: never acted on
      let result;
      if (t - p.createdAt > DAY) result = 'expired before the decision reached the engine; not applied';
      else if (d.status === 'denied') result = 'denied: nothing changed';
      else if (d.status === 'approved') result = this.apply(p.action);
      else continue;
      delete this.st.proposals[d.ref]; this.save();
      try { await this.sync.call('decisions', { op: 'ack', ref: d.ref, result }); } catch (_) { /* the ref is gone locally; a repeat is ignored */ }
      this.event(p.agent, 'info', 'decision', `${p.title}: ${result}`, { outcome: /^applied/.test(result) ? 'fixed' : 'none' });
      done.push({ ref: d.ref, result });
      if (/^applied/.test(result)) this.wantRestart = 'setting changed';
    }
    return done;
  }

  apply(action) {
    if (action.type !== 'set_env') return 'not applied: unknown action';
    const bad = validChange(action.key, action.value);
    if (bad) return 'not applied: ' + bad;
    if (!this.envFile) return 'not applied: no .env file';
    try {
      const doc = ENV.load(this.envFile);
      // what the engine runs with now: the .env value, or the default when unset or out of bounds
      const now = String(readExecPolicy((k) => (k === action.key ? ENV.get(doc, k) : undefined)).policy[action.key]);
      if (action.from !== undefined && now !== String(action.from)) return `not applied: ${action.key} is now ${now}, not ${action.from} as when proposed`;
      ENV.set(doc, action.key, action.value); ENV.save(doc);
      return `applied: ${action.key}=${action.value} (engine restarts to load it)`;
    } catch (e) { return 'not applied: ' + redact(e.message); }
  }

  async tryDiagnose(p) {
    const t = this.now(); const day = new Date(t).toISOString().slice(0, 10);
    if (this.st.diagDay !== day) { this.st.diagDay = day; this.st.diagCount = 0; }
    if (this.st.diagCount >= 20 || (this.st.diagnosed[p.id] && t - this.st.diagnosed[p.id] < 6 * HOUR)) return;
    this.st.diagCount++; this.st.diagnosed[p.id] = t; this.save();
    try {
      const d = await this.diagnose(p);
      if (d) this.event('diagnosis', 'info', p.id, `likely cause: ${d.cause}`, { action: d.fix, outcome: 'none', detail: { confidence: d.confidence, model: d.model } });
    } catch (e) { this.log('diagnosis failed: ' + redact(e.message)); }
  }
}
module.exports = { Agents, validChange, APPLIABLE };
