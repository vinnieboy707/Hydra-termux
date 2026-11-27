'use strict';
// The company: AI departments that report to a VP, who reports to you (the owner).
//
//   Owner (you) ── daily report at your report time; immediate alerts ONLY for: the database down, money lost, money made.
//   VP of Operations ── mission: keep building and delegating until Chronos is profitable. Until the first verified
//     profit the VP has full operational control (any trading setting or execution policy inside its safe range,
//     experiments, restarts, delegations, build requests). After it, authority drops to "limits only" by itself.
//   Departments ── each assesses its area every cycle from real state, reports to the VP, and verifies the VP's changes:
//     Trading desk · Risk & compliance · Treasury · Site reliability · Data & records · Research · Security.
//
// Hard limits no authority level lifts: funds move only to your own configured wallets; keys are never touched or
// shown; daily gas and loss caps hold; the profit guard stays on; code runs only sealed and tested; your kill switch
// stops everything. Every report, decision, delegation and verification is journaled (data/company/journal.jsonl),
// sent to the portal (agent activity) and, when set, to your webhook.
const fs = require('fs');
const path = require('path');
const { redact } = require('./safety.cjs');
const { POLICY, readExecPolicy } = require('./execpolicy.cjs');

const HOUR = 3600000, DAY = 86400000;

// The VP's charter. Hard-coded on purpose: no setting, agent or AI answer can change it; only a sealed, tested release
// can. The builder (the scheduled Claude session that writes code) follows the same charter (docs/COMPANY.md).
const VP_CHARTER = Object.freeze({
  mission: 'Continuously improve Chronos until it handles real funds and makes verified profit; never stop before that, and keep improving within limits after it.',
  objectives: Object.freeze([
    'Keep the engine running and correct: reliability comes before every other objective.',
    'Get the contract deployed and the executor funded and ready (steps only you can take are sent to you as reminders, and in every daily report, until each is verified done).',
    'Turn proven shadow wins into live trades (promotion rules, within their bounds).',
    'Unblock profitable routes: a filter that alone blocks a route with positive net is the first thing to change.',
    'Find more opportunities: a wider token universe, more venues (build requests), faster reaction to every block.',
    'Cut costs: gas, flash fees (a cheaper flash-loan source is a contract change for your approval).',
    'Improve the codebase itself (builder): correctness, tests, planted bugs, documentation, performance.',
  ]),
  rules: Object.freeze([
    'Equal effort on success: every cycle has a pass on what works (wins noticed and told, a playbook of the routes that cleared every rule, won or paid, and every profit policy checked), not only on what fails.',
    'Improve only: every change must pass its acceptance gate, or it is reverted.',
    'One change at a time; verify it before the next.',
    'Never repeat a change that failed.',
    'Never stop before the first verified profit.',
    'Hard limits always hold: funds only to your wallets, keys untouched, gas and loss caps, the profit guard, sealed code, your kill switch.',
  ]),
  acceptance: Object.freeze({
    runtime: 'after the verification window: the progress score (realized profit, shadow wins, approved routes, best net) is not lower and risk is not red',
    code: 'every test passes, every planted bug is caught, documentation is current, the code is sealed, install simulations pass, no hard limit is touched',
  }),
  cadence: Object.freeze({ decideEveryMs: 2 * HOUR, verifyMs: 2 * HOUR, buildRequestEveryMs: 6 * HOUR, researchEveryMs: 12 * HOUR, realCheckEveryMs: 24 * HOUR, auditMinGapMs: 30 * 60000 }),
});
const usd = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(Math.abs(v) < 1 ? 4 : 2)}`);

// Settings the VP may change while it holds full control, each inside a safe range (in addition to every execution
// policy key, which keeps its own bounds). Funds, keys and contract code are never in this list.
const VP_SETTINGS = {
  MIN_NET_PROFIT_USD: { min: 0.01, max: 50 },
  MAX_SLIPPAGE_BPS: { min: 5, max: 100 },
  GO_MIN_USD_PER_DAY: { min: 0, max: 1000 },
  CHRONOS_DISCOVER_TOKENS: { min: 0, max: 200, int: true },
  SCAN_QUOTE_CYCLES: { min: 50, max: 2000, int: true },
  SCAN_MAX_LEGS: { min: 2, max: 5, int: true },
  HOT_SCAN_MS: { min: 1000, max: 60000, int: true },
};

/** is this change inside the VP's authority right now? returns null when allowed, else the reason */
function allowed(key, value, authority) {
  const pol = POLICY.find((p) => p.key === key);
  if (pol) { const r = readExecPolicy((k) => (k === key ? String(value) : undefined)); return r.problems.length ? r.problems[0] : null; }
  if (authority !== 'full') return `${key} needs your approval (VP authority is limits only)`;
  const s = VP_SETTINGS[key]; if (!s) return `${key} is outside the VP's authority`;
  const n = Number(value);
  if (!Number.isFinite(n) || n < s.min || n > s.max || (s.int && !Number.isInteger(n))) return `${key}=${value} is outside its safe range ${s.min}–${s.max}`;
  return null;
}

// ------------------------------------------------------------------ departments (pure: snapshot in, report out)
const DEPARTMENTS = {
  trading: { title: 'Trading desk', mandate: 'find and size every profitable route; report what blocks the rest', logs: ['scan results', 'indicators', 'fast lane'] },
  risk: { title: 'Risk & compliance', mandate: 'enforce your policies (P0, G1, T1, S0), loss and gas caps; veto unsafe changes', logs: ['policy checks', 'mode', 'executor stats'] },
  treasury: { title: 'Treasury', mandate: 'cash flow from receipts, tax reserve (30%), executor gas, payouts due', logs: ['realized executions', 'balances', 'executor'] },
  sre: { title: 'Site reliability', mandate: 'keep nodes, feeds and the engine up; run the incident resolver; run every real check once a day', logs: ['engine log', 'incidents', 'block feed', 'chronos verify-real'] },
  data: { title: 'Data & records', mandate: 'keep the portal database in sync; detect database outages', logs: ['sync status'] },
  research: { title: 'Research', mandate: 'learn what wins on-chain; turn it into build requests', logs: ['chronos research'] },
  security: { title: 'Security', mandate: 'code integrity, foreign files, devices, state signatures', logs: ['integrity', 'devices'] },
};

function assess(x) {
  const R = {};
  const I = x.res && x.res.indicators;
  const stale = x.lastScanAt && x.interval && x.now - x.lastScanAt > Math.max(60000, x.interval * 3000);
  const top = I && (I.blockedBy || [])[0];
  R.trading = { status: !x.lastScanAt || stale || x.scanError ? 'red' : x.res && x.res.approved ? 'green' : 'amber',
    kpis: { cyclesChecked: I ? I.cycles.checked : null, pricesAllow: I ? I.cycles.pricesAllow : null, approved: x.res ? x.res.approved : null, bestNetUsd: I && I.best ? I.best.netUsd : null, rawGaps: I && I.raw ? I.raw.grossPositive : null, topBlocker: top ? top.filter : null, topBlockerBestUsd: top && top.onlyThis ? top.bestNetIfOnlyThis : null, gasGwei: I ? I.breakEven.gasGwei : null },
    notes: [stale && 'scans are stale', x.scanError && `last scan failed: ${x.scanError}`].filter(Boolean) };
  const reverts = x.today ? x.today.reverted : 0;
  R.risk = { status: (x.policyFails || []).length || x.safe ? 'red' : reverts ? 'amber' : 'green',
    kpis: { mode: x.mode || null, heldWhy: x.heldWhy || null, policyFails: (x.policyFails || []).map((p) => p.id), sentToday: x.today ? x.today.sent : 0, revertsToday: reverts, gasUsdToday: x.today ? x.today.gasUsd : 0, safeMode: !!x.safe, killSwitch: !!x.killed },
    notes: (x.policyFails || []).map((p) => `policy ${p.id}: ${p.detail}`) };
  // a confirmed trade's time is when this engine first saw its receipt (x.seenAt: txHash → ms)
  const ex = (x.realized && x.realized.executions) || [];
  const today = ex.filter((e) => (x.seenAt && x.seenAt[e.txHash]) >= x.now - DAY);
  const netToday = today.reduce((a, e) => a + (Number(e.netUsd) || 0), 0) - (x.today ? x.today.lossGasUsd || 0 : 0);
  const lowGas = x.execInfo && x.execInfo.gasEth !== undefined && x.minGasEth !== undefined && x.execInfo.gasEth < x.minGasEth;
  R.treasury = { status: x.realized && x.realized.totalNetUsd > 0 ? 'green' : lowGas ? 'red' : 'amber',
    kpis: { realizedNetUsdAllTime: x.realized ? x.realized.totalNetUsd : 0, realizedGasUsdAllTime: x.realized ? x.realized.totalGasUsd : 0, netUsdLast24h: netToday, tradesLast24h: today.length, taxReserveUsd: x.realized && x.realized.totalNetUsd > 0 ? Math.ceil(x.realized.totalNetUsd * 30) / 100 : 0, executorGasEth: x.execInfo ? x.execInfo.gasEth ?? null : null, executorReady: x.execInfo ? !!x.execInfo.ready : false },
    notes: [lowGas && 'executor gas is below its minimum', x.execInfo && !x.execInfo.ready && x.execInfo.why && `executor not ready: ${x.execInfo.why}`].filter(Boolean) };
  const open = (x.incidents && x.incidents.open) || [];
  // real checks: every test stand-in's real counterpart, run by SRE once a day (lib/realcheck.cjs)
  const rc = x.realcheck; const rcRes = (rc && rc.results) || [];
  const rcAge = rc && rc.at ? x.now - Date.parse(rc.at) : Infinity;
  const rcFailed = rcRes.filter((r) => r.status === 'fail');
  const realChecks = { pass: rcRes.filter((r) => r.status === 'pass').length, fail: rcFailed.length, notRun: rcRes.filter((r) => r.status === 'not run').length, failed: rcFailed.map((r) => r.id), ageHours: Number.isFinite(rcAge) ? Math.round(rcAge / HOUR) : null };
  R.sre = { status: open.some((i) => i.status === 'escalated') ? 'red' : open.length || rcFailed.length || rcAge > 26 * HOUR ? 'amber' : 'green',
    kpis: { openIncidents: open.length, escalated: open.filter((i) => i.status === 'escalated').map((i) => i.problem), resolvedRecently: ((x.incidents && x.incidents.resolved) || []).length, feedsUp: x.feed ? x.feed.up : null, feeds: x.feed ? x.feed.feeds : null, realChecks },
    notes: [...open.map((i) => `${i.problem}: ${i.status} (${i.attempts.join(', ') || 'starting'})`), ...rcFailed.map((r) => `real check failed: ${r.id}: ${r.detail}`)] };
  const sy = x.sync || {};
  const dbDown = !!(sy.failures >= 5 && (!sy.lastOk || x.now - sy.lastOk > 10 * 60000) && sy.pending > 0);
  R.data = { status: dbDown ? 'red' : sy.pending > 200 ? 'amber' : 'green', kpis: { pending: sy.pending ?? null, failures: sy.failures ?? null, lastOkAgoS: sy.lastOk ? Math.round((x.now - sy.lastOk) / 1000) : null, databaseDown: dbDown }, notes: [sy.lastErr && `last sync error: ${sy.lastErr}`].filter(Boolean) };
  const rs = x.research;
  const rsAge = rs && rs.at ? x.now - Date.parse(rs.at) : Infinity;
  R.research = { status: rsAge > 12 * HOUR ? 'amber' : 'green', kpis: { ageHours: Number.isFinite(rsAge) ? Math.round(rsAge / HOUR) : null, profitableAfterGas: rs ? rs.profitableAfterGas : null, venuesYouLack: rs ? (rs.venuesYouLack || []).length : null, flashLoans: rs ? rs.flashLoans : null }, notes: [] };
  R.security = { status: x.integrity && !x.integrity.ok ? 'red' : x.integrity && (x.integrity.foreign || []).length || x.stateTampered ? 'amber' : 'green', kpis: { integrityOk: x.integrity ? !!x.integrity.ok : null, foreignFiles: x.integrity ? (x.integrity.foreign || []).length : null, stateTampered: !!x.stateTampered }, notes: [] };
  return R;
}

// ------------------------------------------------------------------ the VP's experiment playbook toward profit
// Each experiment is tried at most once per value; it is applied, verified over a window, kept if it helped (or did no
// harm), reverted if risk objects or it made things worse. Ordered: the cheapest, most direct unblockers first.
function experiments(x, R, env) {
  const out = [];
  const T = R.trading.kpis; const num = (k, d) => (Number.isFinite(Number(env(k))) && env(k) !== '' && env(k) !== undefined ? Number(env(k)) : d);
  if (T.topBlocker === 'profit floor' && T.topBlockerBestUsd > 0) {
    const cur = num('MIN_NET_PROFIT_USD', 0.35); const next = Math.max(0.01, Math.floor(T.topBlockerBestUsd * 0.9 * 100) / 100);
    if (next < cur) out.push({ key: 'MIN_NET_PROFIT_USD', value: next, from: cur, why: `routes are blocked only by the profit floor and the best would net ${usd(T.topBlockerBestUsd)}` });
  }
  if (T.topBlocker === 'price impact cap' && T.topBlockerBestUsd > 0) {
    const cur = num('MAX_SLIPPAGE_BPS', 35); const next = Math.min(100, cur + 15);
    if (next > cur) out.push({ key: 'MAX_SLIPPAGE_BPS', value: next, from: cur, why: `routes netting up to ${usd(T.topBlockerBestUsd)} are blocked only by the price-impact cap; quotes already include impact and minProfit protects the trade` });
  }
  if (x.shadowWins > 0 && R.risk.kpis.mode !== 'LIVE') {
    const w = num('PROMOTE_MIN_WINS', 5); if (w > 1) out.push({ key: 'PROMOTE_MIN_WINS', value: 1, from: w, why: `${x.shadowWins} shadow win(s) proven on your contract; waiting for more delays the first profit` });
    const g = num('GO_MIN_USD_PER_DAY', null); if (g !== null && g > 0) out.push({ key: 'GO_MIN_USD_PER_DAY', value: 0, from: g, why: 'the daily-dollar threshold is holding back a proven route' });
  }
  if (T.rawGaps === 0 || (T.cyclesChecked !== null && T.approved === 0 && T.topBlocker === null)) {
    const d = num('CHRONOS_DISCOVER_TOKENS', 40); if (d < 200) out.push({ key: 'CHRONOS_DISCOVER_TOKENS', value: Math.min(200, d + 40), from: d, why: 'no raw gaps among the current tokens: widen the universe' });
    const q = num('SCAN_QUOTE_CYCLES', 400); if (q < 2000) out.push({ key: 'SCAN_QUOTE_CYCLES', value: Math.min(2000, q * 2), from: q, why: 'quote more of the cycles prices allow' });
  }
  if (R.risk.kpis.mode === 'LIVE' && R.risk.kpis.sentToday >= 4 && R.risk.kpis.revertsToday / R.risk.kpis.sentToday >= 0.5) {
    const t = Number(x.policy && x.policy.EXEC_TIP_SHARE_BPS); const max = POLICY.find((p) => p.key === 'EXEC_TIP_SHARE_BPS').max;
    if (Number.isFinite(t) && t < max) out.push({ key: 'EXEC_TIP_SHARE_BPS', value: Math.min(max, t + 1000), from: t, why: `${R.risk.kpis.revertsToday} of ${R.risk.kpis.sentToday} sends reverted: bid more to win the race` });
  }
  return out;
}

/** the progress measure the VP optimises before the first profit: approved routes, shadow wins, realized net */
const score = (x, R) => (R.treasury.kpis.realizedNetUsdAllTime || 0) * 1000 + (x.shadowWins || 0) * 10 + (R.trading.kpis.approved || 0) + Math.max(0, R.trading.kpis.bestNetUsd || 0);

/** a cell's own quality check before it may submit: an answer with a cause, evidence, at least one concrete step */
function selfCheck(r) {
  const a = r.answer || {}; const checks = [];
  if (!a.cause || a.cause.length < 15) checks.push('no clear cause');
  if (!a.evidence || !a.evidence.length) checks.push('no evidence quoted');
  if (!a.next || !a.next.length || !a.next.some((n) => n.step && n.step.length > 10)) checks.push('no concrete step');
  if (!r.used || !r.used.length) checks.push('no tool was used to check anything');
  return { passed: checks.length === 0, checks: checks.length ? checks : ['cause, evidence, steps and tool use present'] };
}
/** the VP's quality review of a submission: actionable and not guesswork */
function vpQuality(r, cell) {
  const a = r.answer; const why = [];
  if (a.confidence === 'low') why.push('low confidence');
  if (/\bunknown\b/i.test(a.cause) && a.next.every((n) => /unknown/i.test(n.profitEffect || ''))) why.push('neither cause nor effect is known');
  if (a.next.every((n) => n.owner === 'you') && cell && /contract|executor|billing/i.test(cell.text) === false) why.push('every step handed to you for a check Chronos can act on');
  return { ok: why.length === 0, why: why.join('; ') };
}

class Company {
  /** applyEnv(key, value) → string · delegate(task) → Promise<string> · alert(level, title, text) · report(kind, payload) */
  constructor({ dataDir, applyEnv, delegate = async () => 'not available', alert = () => {}, report = () => {}, now = () => Date.now(), verifyMs = VP_CHARTER.cadence.verifyMs, minGapMs = VP_CHARTER.cadence.decideEveryMs, reportAt = '07:30', tz = 'America/Los_Angeles', narrate = null, mind = null }) {
    Object.assign(this, { dataDir, applyEnv, delegate, alert, report, now, verifyMs, minGapMs, reportAt, tz, narrate, mind });
    this.dir = path.join(dataDir, 'company'); this.file = path.join(this.dir, 'state.json');
    try { this.st = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (_) { this.st = { authority: 'full', profitAt: null, tried: {}, pending: null, alerted: {}, lastReportDay: null, decisions: [], delegations: {} }; }
  }
  save() { try { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.st), { mode: 0o600 }); } catch (_) { /* best effort */ } }
  journal(kind, body) {
    const e = { at: new Date(this.now()).toISOString(), kind, ...JSON.parse(redact(JSON.stringify(body))) };
    try { fs.mkdirSync(this.dir, { recursive: true }); fs.appendFileSync(path.join(this.dir, 'journal.jsonl'), JSON.stringify(e) + '\n', { mode: 0o600 }); } catch (_) { /* best effort */ }
    this.report(kind, e); return e;
  }
  localDay(t) { return new Intl.DateTimeFormat('en-CA', { timeZone: this.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)); }
  localHM(t) { return new Intl.DateTimeFormat('en-GB', { timeZone: this.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t)); }

  /** one cycle: departments report, the VP verifies, decides, delegates, alerts, and writes the daily report when due */
  async tick(x) {
    const t = this.now(); x = { ...x, now: t };
    const R = assess({ ...x, seenAt: this.st.seen || {} });
    this.st.seen = this.st.seen || {};
    const out = { reports: R, decided: null, verified: null, delegated: [], alerts: [], daily: null };
    // mission: full control until the first verified profit, then limits only
    if (!this.st.profitAt && R.treasury.kpis.realizedNetUsdAllTime > 0) {
      this.st.profitAt = t; this.st.authority = 'limits';
      out.alerts.push(this._alert('money', 'First verified profit', `Chronos made ${usd(R.treasury.kpis.realizedNetUsdAllTime)} net, verified from receipts. The VP's mission is met; its authority is now limits only.`, 'mission:profit'));
      this.journal('decision', { by: 'vp', what: 'authority reduced to limits only after the first verified profit' });
    }
    // immediate alerts: the database down, money lost, money made (the road to cash adds its own, below)
    if (R.data.kpis.databaseDown) out.alerts.push(this._alert('critical', 'Portal database unreachable', `Sync has failed ${R.data.kpis.failures} times; last success ${R.data.kpis.lastOkAgoS ?? '—'} s ago. The engine keeps trading and queues the rows.`, 'db:' + this.localDay(t)));
    // trades: alert on each new confirmed one (not on ones that were there before this company started)
    this.st.seen = this.st.seen || {};
    const first = !this.st.booted;
    for (const e of (x.realized && x.realized.executions) || []) {
      const id = e.txHash; if (!id || this.st.seen[id]) continue;
      this.st.seen[id] = t; if (first) continue;
      if (Number(e.netUsd) > 0) out.alerts.push(this._alert('money', `Made ${usd(Number(e.netUsd))}`, `Confirmed trade ${String(id).slice(0, 12)}… net ${usd(Number(e.netUsd))} after gas.`, 'tx:' + id));
      else if (Number(e.netUsd) < 0) out.alerts.push(this._alert('critical', `Lost ${usd(Math.abs(Number(e.netUsd)))}`, `Trade ${String(id).slice(0, 12)}… lost money after gas. The profit guard and the VP are on it.`, 'tx:' + id));
    }
    // reverted sends spend gas without a receipt profit: alert on each new one (executor's own daily count)
    const rv = x.today ? x.today.reverted || 0 : 0; const rvKey = (x.today && x.today.day) || this.localDay(t);
    if (!first && rv > (this.st.reverts && this.st.reverts.day === rvKey ? this.st.reverts.n : 0)) out.alerts.push(this._alert('critical', `Lost ${usd(x.today.lossGasUsd || 0)} in gas today`, `${rv} send(s) reverted today (gas spent, no profit). The profit guard returns to shadow after losses.`, `rv:${rvKey}:${rv}`));
    this.st.reverts = { day: rvKey, n: rv };
    this.st.booted = true;
    // the standing team: seven specialists act on their triggers and report, in order, synchronously; the VP's feedback
    // (effective / back off / take over) is applied in the same round (lib/team.cjs)
    {
      this.team = this.team || new (require('./team.cjs').Team)(this.st, this.now);
      out.team = this.lastTeam = await this.team.run(x, R, {
        act: (name) => this.delegate('act:' + name, { reports: R }), task: (name) => { const last = Math.max(this.st.delegations[name] || 0, this.st.delegations['push:' + name] || 0); if (t - last < 2 * HOUR) return 'already done within 2 h'; this.st.delegations['push:' + name] = t; return this.delegate(name, { reports: R }); }, // one owner per task: the VP's schedule sees it
        tell: (title, text) => out.alerts.push(this._alert('critical', title, text, `team:${title}:${Math.floor(t / 3600000)}`)),
      });
      for (const r of out.team.reports) for (const f of r.fired) this.journal('team', { by: r.agent, what: `${f.trigger} → ${f.skill}`, outcome: f.result.slice(0, 120), why: f.detail });
      for (const k of out.team.takeovers) {
        this.journal('decision', { by: 'vp', what: `took over ${k.agent}:${k.trigger} after 3 ineffective runs`, outcome: 'cell opened', why: k.detail });
        if (this.mind && !this.mind.cell(`agent:${k.agent}:${k.trigger}`)) this.mind.openCell(`agent:${k.agent}:${k.trigger}`, `The ${k.agent} agent's ${k.trigger} fix did not hold 3 times: ${k.detail}`);
      }
    }
    // the road to cash: verify every milestone from its real source, push Chronos's own steps, and keep telling you
    // about yours until each is verified done (lib/milestones.cjs)
    {
      const env = x.env || (() => undefined); this.st.road = this.st.road || {};
      out.road = await require('./milestones.cjs').drive(this.st.road, { ...x, env }, R, {
        notify: (level, title, text) => out.alerts.push(this._alert(level, title, text, `ms:${title}:${t}`)),
        delegate: async (task) => { if (this.st.delegations['push:' + task] && t - this.st.delegations['push:' + task] < 2 * HOUR) return null; this.st.delegations['push:' + task] = t; try { return await this.delegate(task, { reports: R }); } catch (_) { return null; } },
        localHour: Number(this.localHM(t).slice(0, 2)), nudgeHours: Number(env('CHRONOS_VP_NUDGE_HOURS')) || 3, quietHours: env('CHRONOS_VP_QUIET') || '21-08',
      });
      // and the same care for success: wins noticed and told, the playbook of what worked, the profit policies
      this.st.success = this.st.success || {};
      out.success = require('./success.cjs').track(this.st.success, { ...x, env }, R, { notify: (level, title, text) => out.alerts.push(this._alert(level, title, text, `su:${title}:${t}`)) });
      // two successes for every failure: counted from real events; short of it, the VP runs a success push
      out.ledger = require('./success.cjs').balance(this.st.success, { ...x, day: this.localDay(t) }, { wins: [...out.success.wins, ...(x.mirrorFired || []).map((k) => 'mirror ' + k)], road: out.road.sent,
        delegate: async (task) => { const last = Math.max(this.st.delegations[task] || 0, this.st.delegations['push:' + task] || 0); if (t - last < 2 * HOUR) return null; this.st.delegations['push:' + task] = t; try { return await this.delegate(task, { reports: R }); } catch (_) { return null; } } }); // never twice within 2 h of the same work
      // 100 indicators (50 success, 50 failure) and the price-direction model, measured every cycle (lib/indicators.cjs,
      // lib/direction.cjs); retired when they never fire, weighted once proven; the VP acts on what they show
      this.priceDir = this.priceDir || new (require('./direction.cjs').Direction)(); this.priceDir.observe(x.res);
      out.direction = this.lastDirection = this.priceDir.summary();
      this.indicators = this.indicators || new (require('./indicators.cjs').Indicators)({ dataDir: path.dirname(this.dir), retireDays: Number(env('CHRONOS_INDICATOR_RETIRE_DAYS')) || 7 });
      const pb = Object.values(this.st.success.playbook || {}); const cur = (out.road.list || []).find((m) => !m.done);
      out.indicators = this.lastIndicators = this.indicators.observe(x, R, { direction: out.direction, ledger: this.st.success.ledger, lastSuccessAt: this.st.success.ledger && this.st.success.ledger.lastSuccessAt,
        playbook: pb.length, playbookBest: pb.length ? Math.max(...pb.map((e) => e.bestNetUsd)) : null, roadDone: (out.road.list || []).filter((m) => m.done).length, roadTotal: (out.road.list || []).length,
        roadWaitingH: cur && Number.isFinite(cur.runningMs) ? cur.runningMs / HOUR : null });
      // a spread far above its normal tends to close: that is the window, so the desk looks again right away
      if (out.direction.wideSpreads.length && (!this.st.delegations['push:scan-now'] || t - this.st.delegations['push:scan-now'] >= 5 * 60000)) {
        this.st.delegations['push:scan-now'] = t; try { await this.delegate('scan-now', { reports: R }); } catch (_) { /* next cycle */ }
      }
    }
    // verify the VP's last change
    const p = this.st.pending;
    if (p && t >= p.at + this.verifyMs) {
      const now = score(x, R); const riskRed = R.risk.status === 'red' && !p.riskWasRed;
      const keep = !riskRed && now >= p.scoreBefore;
      if (!keep) { const r = this.applyEnv(p.key, p.from); this.journal('verification', { by: 'risk+trading', change: `${p.key} ${p.from} → ${p.value}`, outcome: 'reverted', why: riskRed ? 'risk turned red after the change' : `progress fell (${p.scoreBefore.toFixed(2)} → ${now.toFixed(2)})`, result: r }); }
      else this.journal('verification', { by: 'risk+trading', change: `${p.key} ${p.from} → ${p.value}`, outcome: 'kept', why: `progress ${p.scoreBefore.toFixed(2)} → ${now.toFixed(2)}, risk ${R.risk.status}` });
      out.verified = { key: p.key, kept: keep }; this.st.pending = null;
      if (this.mind) { const cid = 'change:' + p.key; const c = this.mind.cell(cid); if (c && c.state === 'submitted') this.mind.review(cid, { accept: keep, final: true, why: keep ? `effective: progress ${p.scoreBefore.toFixed(2)} → ${now.toFixed(2)}, risk ${R.risk.status}` : `not effective: ${riskRed ? 'risk turned red' : 'progress fell'}; reverted` }); else if (c) this.mind.collapse(cid, `closed: ${keep ? 'kept' : 'reverted'} (the change never landed)`); }
    }
    // decide: the next untried experiment, one at a time, never twice, risk can veto
    if (!this.st.pending && !x.killed && t - (this.st.lastDecisionAt || 0) >= this.minGapMs) {
      const env = x.env || (() => undefined);
      const props = (this.st.proposals || []).map((p) => ({ key: p.key, value: p.value, from: env(p.key) ?? '', why: p.why })); this.st.proposals = [];
      for (const ex of [...props, ...experiments(x, R, env)]) {
        const id = `${ex.key}=${ex.value}`; if (this.st.tried[id]) continue;
        const why = allowed(ex.key, ex.value, this.st.authority);
        this.st.tried[id] = t;
        if (why) { this.journal('decision', { by: 'vp', what: `wanted ${ex.key} ${ex.from} → ${ex.value}`, outcome: 'needs you', why, reason: ex.why }); this.st.decisions = [...this.st.decisions.slice(-49), { at: t, what: `${ex.key} ${ex.from} → ${ex.value}`, outcome: 'needs you', why }]; continue; }
        if (R.risk.status === 'red') { this.journal('decision', { by: 'risk', what: `veto ${ex.key} → ${ex.value}`, outcome: 'vetoed', why: 'risk is red: no changes until it clears' }); break; }
        const r = this.applyEnv(ex.key, ex.value);
        this.st.pending = { key: ex.key, value: ex.value, from: ex.from, at: t, scoreBefore: score(x, R), riskWasRed: false };
        this.st.lastDecisionAt = t;
        this.st.decisions = [...this.st.decisions.slice(-49), { at: t, what: `${ex.key} ${ex.from} → ${ex.value}`, outcome: 'applied', why: ex.why }];
        out.decided = this.journal('decision', { by: 'vp', what: `${ex.key} ${ex.from} → ${ex.value}`, outcome: 'applied', why: ex.why, result: r, verifyAfterMin: Math.round(this.verifyMs / 60000) });
        // a worker cell for the change: it submits only if the change really landed; the VP accepts or rejects it after the window
        if (this.mind) { const cid = 'change:' + ex.key; this.mind.openCell(cid, `${ex.key} ${ex.from} → ${ex.value}: ${ex.why}`, { maxAttempts: 1 }); this.mind.submit(cid, `${ex.key}=${ex.value} (${r})`, { passed: /^applied/.test(String(r)), checks: [`applyEnv: ${String(r).slice(0, 80)}`] }); }
        break;
      }
    }
    // delegate: standing tasks to departments (each at most once per its interval)
    // the same work done this cycle by a push (road to cash, success push) counts: it is not run twice
    const due = (k, every) => { const last = Math.max(this.st.delegations[k] || 0, this.st.delegations['push:' + k] || 0); return !last || t - last >= every; };
    const tasks = [];
    if ((R.research.kpis.ageHours === null || R.research.kpis.ageHours >= 12) && due('research', VP_CHARTER.cadence.researchEveryMs)) tasks.push('research');
    if (R.data.kpis.pending > 200 && due('flush-sync', HOUR)) tasks.push('flush-sync');
    if ((R.sre.kpis.realChecks.ageHours === null || R.sre.kpis.realChecks.ageHours >= 24) && due('verify-real', VP_CHARTER.cadence.realCheckEveryMs)) tasks.push('verify-real');
    if (due('build-request', VP_CHARTER.cadence.buildRequestEveryMs) && (!this.st.profitAt || due('build-request', 4 * VP_CHARTER.cadence.buildRequestEveryMs))) tasks.push('build-request'); // never stops; slower after profit
    for (const k of tasks) {
      this.st.delegations[k] = t;
      let r; try { r = await this.delegate(k, { reports: R }); } catch (e) { r = 'failed: ' + redact(e.message); }
      out.delegated.push(this.journal('delegation', { by: 'vp', to: k === 'research' ? 'research' : k === 'flush-sync' ? 'data' : k === 'verify-real' ? 'sre' : 'builder', task: k, result: String(r).slice(0, 300) }));
    }
    // audit after every completed task: a setting applied or verified, a delegation done, a milestone gained or lost.
    // Everything is re-checked from real sources (your checks, then Blockscout as the independent witness) and the next
    // step to real profit is reassessed (lib/vpaudit.cjs). Tasks done close together share one audit, at most one per
    // CHRONOS_VP_AUDIT_MIN minutes (default 30): the queue is kept across engine restarts, so none is skipped.
    {
      const done = [];
      if (out.decided) done.push(`VP change ${String(out.decided.what || '').slice(0, 60)}`);
      if (out.verified) done.push(`verification of ${out.verified.key} (${out.verified.kept ? 'kept' : 'reverted'})`);
      for (const d of out.delegated) if (d && d.task) done.push(String(d.task));
      for (const r of (out.team && out.team.reports) || []) for (const f of r.fired) if (!/^already done/.test(f.result)) done.push(f.skill.replace('act:', '')); // what the agent did, by name
      for (const s of (out.road && out.road.sent) || []) if (/^[✓✗]/.test(s)) done.push(s.slice(0, 70));
      this.st.auditQueue = [...(this.st.auditQueue || []), ...done].slice(-20);
      const env = x.env || (() => undefined); const gap = (Number(env('CHRONOS_VP_AUDIT_MIN')) || VP_CHARTER.cadence.auditMinGapMs / 60000) * 60000;
      if (this.st.auditQueue.length && t - (this.st.lastAuditAt || 0) >= gap) {
        const after = this.st.auditQueue; this.st.auditQueue = []; this.st.lastAuditAt = t;
        let a; try { a = await this.delegate('audit', { reports: R, after, road: (out.road && out.road.list) || [] }); } catch (e) { a = null; }
        if (a && typeof a === 'object' && Array.isArray(a.checks)) {
          out.audit = this.lastAudit = a;
          this.journal('verification', { by: 'vp', change: 'audit after ' + after.slice(0, 3).join(', '), outcome: a.fail ? 'needs attention' : 'clean', why: a.line, checks: a.checks });
          out.alerts.push(this._alert(a.fail ? 'critical' : 'audit', a.fail ? `Audit: ${a.fail} problem(s) found` : 'Audit: clean', a.line, `audit:${t}`));
          out.cells = await this._cells(a, env);
        } else this.journal('verification', { by: 'vp', change: 'audit after ' + after.slice(0, 3).join(', '), outcome: 'not run', why: String(a || 'audit unavailable').slice(0, 200) });
      }
    }
    // daily report at your report time (once per local day)
    const day = this.localDay(t);
    if (this.st.lastReportDay !== day && this.localHM(t) >= this.reportAt) { out.daily = await this.dailyReport(x, R); this.st.lastReportDay = day; }
    this.save(); if (this.mind) this.mind.save();
    return out;
  }

  /**
   * Worker cells after an audit (your rule: the VP opens cells; a cell completes its task and verifies its own quality
   * before submitting; the VP verifies quality and effectiveness and accepts, and only then the cell collapses):
   *   · each submitted fix cell is reviewed for EFFECTIVENESS against this audit: the checks it was opened for now pass →
   *     accepted (collapsed to one line); still failing → rejected with that reason, and it works again (3 tries, then
   *     escalated to you);
   *   · failing checks no cell covers → the VP opens one; a working cell does its task (the AI analyst, within the AI
   *     budget), checks its own answer and submits only if that check passes; the VP checks the QUALITY of the
   *     submission at once (actionable, evidenced, not a repeat of a rejected answer) and rejects it if not.
   */
  async _cells(a, env) {
    if (!this.mind) return null;
    const failing = new Set(a.checks.filter((c) => c.status === 'fail').map((c) => c.id)); const res = { accepted: [], rejected: [], opened: [], submitted: [], escalated: [] };
    for (const c of this.mind.openTasks().filter((x) => x.key.startsWith('fix:'))) {
      if (c.state !== 'submitted') continue;
      const ids = c.key.slice(4).split(','); const still = ids.filter((i) => failing.has(i));
      const v = this.mind.review(c.key, still.length ? { accept: false, why: `not effective: ${still.join(', ')} still failing at the next audit` } : { accept: true, why: `effective: ${ids.join(', ')} pass at the next audit` });
      (v === 'accepted' ? res.accepted : v === 'escalated' ? res.escalated : res.rejected).push(c.key);
      if (v === 'escalated') this._alert('critical', `Needs you: ${ids.join(', ')}`, `The VP rejected 3 fixes for ${ids.join(', ')} (still failing). Last: ${c.rejections && c.rejections.length ? c.rejections[c.rejections.length - 1].why : '—'}. Run: chronos assist`, `esc:${c.key}:${this.now()}`);
    }
    // a cell taking over a team agent's trigger: effective when that trigger has cleared (its streak reset)
    for (const c of this.mind.openTasks().filter((x) => x.key.startsWith('agent:') && x.state === 'submitted')) {
      const st = (this.st.team || {})[c.key.slice(6)];
      const v = this.mind.review(c.key, st && st.streak === 0 ? { accept: true, why: 'effective: the condition cleared' } : { accept: false, why: 'not effective: the condition is still there' });
      (v === 'accepted' ? res.accepted : v === 'escalated' ? res.escalated : res.rejected).push(c.key);
    }
    // a cell for Chronos's own next step on the road to cash: effective when the road has moved past that step
    for (const c of this.mind.openTasks().filter((x) => x.key.startsWith('step:') && x.state === 'submitted')) {
      const n = Number(c.key.slice(5)); const moved = !a.next || a.next.step !== n || a.fail === 0 && a.next.step === 0;
      const v = this.mind.review(c.key, moved && (!a.next || a.next.step !== n) ? { accept: true, why: `effective: step ${n} is verified done` } : { accept: false, why: `not effective yet: step ${n} still not met (${a.next ? a.next.todo : ''})`.slice(0, 280) });
      (v === 'accepted' ? res.accepted : v === 'escalated' ? res.escalated : res.rejected).push(c.key);
    }
    if (!failing.size && a.next && a.next.owner === 'chronos' && a.next.step > 0 && !this.mind.cell('step:' + a.next.step)) { const id = 'step:' + a.next.step; this.mind.openCell(id, `Step ${a.next.step}: ${a.next.title} — ${a.next.todo}`.slice(0, 300)); res.opened.push(id); }
    const covered = new Set(this.mind.openTasks().filter((x) => x.key.startsWith('fix:')).flatMap((x) => x.key.slice(4).split(',')));
    const uncovered = [...failing].filter((i) => !covered.has(i)).sort();
    if (uncovered.length) { const id = 'fix:' + uncovered.join(','); this.mind.openCell(id, `Fix: ${a.checks.filter((c) => uncovered.includes(c.id)).map((c) => `${c.id}: ${c.detail}`).join(' | ')}`.slice(0, 300)); res.opened.push(id); for (const i of uncovered) this.mind.observe('check', i, (a.checks.find((c) => c.id === i) || {}).detail || '', 2, { task: id }); }
    // one working cell does its task per audit (the AI is used sparingly)
    const w = ['fix:', 'agent:', 'step:'].map((p) => this.mind.openTasks().find((x) => x.key.startsWith(p) && x.state === 'working')).find(Boolean); // failing checks first, then team takeovers, then the next step
    if (w) {
      const r = await this._analyse(a, env, { cell: w });
      if (r && r.answer) {
        const sc = selfCheck(r);
        const sub = this.mind.submit(w.key, `${r.answer.cause} → ${r.answer.next.map((n) => n.step).join('; ')}`, sc);
        if (sub === 'submitted') {
          res.submitted.push(w.key);
          // the VP's quality review, at once (effectiveness is judged at the next audit)
          const repeat = (w.rejections || []).some((x) => x.work && x.work === w.submission.work);
          const q = vpQuality(r, w); if (!q.ok || repeat) { this.mind.review(w.key, { accept: false, why: 'quality: ' + (repeat ? 'same answer as a rejected one' : q.why) }); res.rejected.push(w.key); }
        }
      }
    }
    if (!a.fail && !this.mind.openTasks().some((x) => x.key.startsWith('fix:'))) { /* nothing open: a clean audit closes nothing more */ }
    return res;
  }

  /**
   * The AI analyst, sparingly (your policy): only when an audit fails or the next step is Chronos's own; at most
   * CHRONOS_VP_AI_MAX_PER_DAY calls a day (default 12), CHRONOS_VP_AI_MIN_GAP_MIN minutes apart (default 60), and never
   * the same question twice within 6 h. Its answer is journaled, told to you and kept in the open task's cells.
   */
  async _analyse(a, env, { cell = null } = {}) {
    const t = this.now(); const day = this.localDay(t); const ai = this.st.ai = this.st.ai && this.st.ai.day === day ? this.st.ai : { day, n: 0, lastAt: this.st.ai ? this.st.ai.lastAt : 0, asked: (this.st.ai && this.st.ai.asked) || {} };
    const need = !!cell || a.fail > 0 || (a.next && a.next.owner === 'chronos');
    if (!need) return null;
    const cap = Number(env('CHRONOS_VP_AI_MAX_PER_DAY')); const gap = Number(env('CHRONOS_VP_AI_MIN_GAP_MIN'));
    if (ai.n >= (Number.isFinite(cap) && cap >= 0 ? cap : 12) || t - (ai.lastAt || 0) < (Number.isFinite(gap) && gap > 0 ? gap : 60) * 60000) return null;
    const rework = cell && cell.rejections && cell.rejections.length ? ` Your previous answer was rejected by the VP: ${cell.rejections.map((x) => x.why).join(' | ')}. Give a different, better-evidenced fix.` : '';
    const q = cell ? `Your task (cell ${cell.key}): ${cell.text}. ${cell.key.startsWith('step:') ? 'Find what blocks this step from real data and the concrete steps that get it verified.' : 'Find the cause and the concrete steps that make these checks pass.'}${rework}` : a.fail ? `The audit found: ${a.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.detail}`).join(' | ')}. What is the cause, and what are the next steps to real profit?`
      : `The next step to real profit is "${a.next.title}": ${a.next.todo}. What exactly should Chronos do now, and why?`;
    const qk = q.slice(0, 160); if (ai.asked[qk] && t - ai.asked[qk] < 6 * HOUR) return null;
    ai.n += 1; ai.lastAt = t; ai.asked[qk] = t; for (const k of Object.keys(ai.asked)) if (t - ai.asked[k] > 24 * HOUR) delete ai.asked[k];
    let r; try { r = await this.delegate('analyse', { question: q }); } catch (e) { r = null; }
    if (!r || !r.answer) { this.journal('analysis', { by: 'analyst', question: q, outcome: 'no answer', why: String((r && r.why) || 'analyst unavailable').slice(0, 200) }); return null; }
    this.journal('analysis', { by: 'analyst', question: q, answer: r.answer, via: r.via, tools: r.used });
    if (this.mind) this.mind.observe('analysis', cell ? cell.key : 'next-step', `${r.answer.cause} → ${(r.answer.next[0] || {}).step || 'no step'} (AI analysis, ${r.answer.confidence} confidence)`, 2, { task: cell ? cell.key : null });
    const n0 = r.answer.next[0];
    this._alert('audit', 'Audit: analysis', `${r.answer.cause}${n0 ? ` Next (${n0.owner === 'you' ? 'yours' : 'Chronos'}): ${n0.step}.` : ''} (AI analysis, ${r.answer.confidence} confidence; evidence in the journal)`, `analysis:${t}`);
    return r;
  }

  /** the analyst proposes a setting: tried first at the VP's next decision, inside the same safe ranges and risk veto */
  propose(key, value, why) {
    const reason = allowed(key, value, this.st.authority); if (reason) return `not proposed: ${reason}`;
    this.st.proposals = [...(this.st.proposals || []).filter((p) => p.key !== key), { key, value, why: 'analyst: ' + why, at: this.now() }].slice(-5); this.save();
    return `proposed: ${key}=${value} (the VP applies it at its next decision, verifies it and reverts it if progress falls)`;
  }

  _alert(level, title, text, key) {
    if (this.st.alerted[key]) return null;
    this.st.alerted[key] = this.now();
    const keys = Object.keys(this.st.alerted); if (keys.length > 500) delete this.st.alerted[keys[0]];
    this.alert(level, title, text);
    return this.journal('alert', { level, title, text });
  }

  /** which charter objective the VP is working on now (the first one not yet met) */
  objective(x, R) {
    if (R.sre.status === 'red' || R.trading.status === 'red' || R.security.status === 'red') return 0;
    if (!R.treasury.kpis.executorReady) return 1;
    if (R.risk.kpis.mode !== 'LIVE' && (x.shadowWins || 0) > 0) return 2;
    if (R.trading.kpis.topBlockerBestUsd > 0) return 3;
    if (!R.treasury.kpis.realizedNetUsdAllTime) return 4;
    return R.treasury.kpis.realizedGasUsdAllTime > 0 ? 5 : 6;
  }

  async dailyReport(x, R) {
    const T = R.trading.kpis, F = R.treasury.kpis, K = R.risk.kpis;
    const since = this.now() - DAY;
    const decisions = this.st.decisions.filter((d) => d.at >= since);
    const needsYou = [
      ...decisions.filter((d) => d.outcome === 'needs you').map((d) => `${d.what}: ${d.why}`),
      ...R.sre.kpis.escalated.map((k) => `incident escalated: ${k} (chronos assist)`),
      ...R.treasury.notes, ...R.risk.notes, ...R.security.notes,
    ];
    const road = require('./milestones.cjs').withTimes(require('./milestones.cjs').evaluate({ ...x, env: x.env || (() => undefined) }, R), this.st.road, this.now());
    const lines = [
      `Chronos daily report · ${this.localDay(this.now())} · VP authority: ${this.st.authority === 'full' ? 'full control until first profit' : 'limits only'}`,
      `VP mission: ${VP_CHARTER.mission}`,
      `Working on objective ${this.objective(x, R) + 1} of ${VP_CHARTER.objectives.length}: ${VP_CHARTER.objectives[this.objective(x, R)]}`,
      '',
      `CASH FLOW: last 24 h net ${usd(F.netUsdLast24h)} over ${F.tradesLast24h} trade(s) · all time ${usd(F.realizedNetUsdAllTime)} net, gas ${usd(F.realizedGasUsdAllTime)} · tax reserve (30%) ${usd(F.taxReserveUsd)} · executor gas ${F.executorGasEth ?? '—'} ETH${F.executorReady ? '' : ' (not ready)'}`,
      `TRADING: ${T.cyclesChecked ?? '—'} cycles checked last scan · ${T.rawGaps ?? '—'} raw gaps · ${T.approved ?? '—'} approved · best ${usd(T.bestNetUsd)} · top blocker ${T.topBlocker || 'none'}${T.topBlockerBestUsd ? ` (best blocked ${usd(T.topBlockerBestUsd)})` : ''}`,
      `RISK: mode ${K.mode || '—'}${K.heldWhy ? ` (${K.heldWhy})` : ''} · sends today ${K.sentToday} · reverts ${K.revertsToday} · gas today ${usd(K.gasUsdToday)}${K.safeMode ? ' · SAFE MODE' : ''}${K.policyFails.length ? ' · failing: ' + K.policyFails.join(', ') : ''}`,
      `RELIABILITY: ${R.sre.kpis.openIncidents} open incident(s), ${R.sre.kpis.resolvedRecently} resolved recently · feeds ${R.sre.kpis.feedsUp ?? '—'}/${R.sre.kpis.feeds ?? '—'} · database ${R.data.kpis.databaseDown ? 'DOWN' : 'ok'} (${R.data.kpis.pending ?? 0} queued)`,
      `REAL CHECKS: ${R.sre.kpis.realChecks.ageHours === null ? 'not run yet' : `${R.sre.kpis.realChecks.pass} pass · ${R.sre.kpis.realChecks.fail} fail · ${R.sre.kpis.realChecks.notRun} not run · ${R.sre.kpis.realChecks.ageHours} h old`}${R.sre.kpis.realChecks.failed.length ? ' · failed: ' + R.sre.kpis.realChecks.failed.join(', ') : ''}`,
      `RESEARCH: ${R.research.kpis.ageHours === null ? 'not run yet' : `${R.research.kpis.ageHours} h old`} · ${R.research.kpis.profitableAfterGas ?? '—'} profitable competitor tx · ${R.research.kpis.venuesYouLack ?? '—'} venues we lack`,
      ...require('./milestones.cjs').lines(road),
      ...require('./milestones.cjs').ladderLines(F.realizedNetUsdAllTime),
      ...require('./insights.cjs').summarize(x.insights),
      ...require('./team.cjs').lines(this.lastTeam),
      ...require('./chainsignals.cjs').lines(x.chainSignals),
      ...(this.lastAudit ? ['LAST AUDIT (your checks + Blockscout): ' + this.lastAudit.line, ...this.lastAudit.checks.map((c) => `  ${c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '·'} ${c.id}: ${c.detail}`)] : ['LAST AUDIT: none yet (runs after the VP\'s next completed task)']),
      '',
      ...require('./success.cjs').lines(this.st.success || {}, { ...x, env: x.env || (() => undefined) }, R),
      ...require('./mirror.cjs').lines(x.mirror),
      '',
      ...require('./indicators.cjs').lines(this.lastIndicators),
      ...require('./direction.cjs').lines(this.lastDirection),
      '',
      'VP DECISIONS (24 h):', ...(decisions.length ? decisions.map((d) => `  · ${d.what}: ${d.outcome}${d.why ? ' · ' + d.why : ''}`) : ['  · none']),
      '', 'NEEDS YOU:', ...(needsYou.length ? needsYou.map((s) => '  · ' + s) : ['  · nothing']),
      '', 'DEPARTMENTS:', ...Object.entries(R).map(([k, v]) => `  · ${DEPARTMENTS[k].title}: ${v.status.toUpperCase()}`),
    ];
    let note = null;
    if (this.narrate) { try { note = await this.narrate(lines.join('\n')); } catch (_) { note = null; } }
    const departments = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v.status]));
    const body = { day: this.localDay(this.now()), authority: this.st.authority, objective: this.objective(x, R) + 1, cash: F, trading: T, risk: K, departments, decisions, needsYou, text: lines.join('\n'), vpNote: note };
    // the email: a professional HTML report (lib/emailreport.cjs); the text above stays as its plain fallback
    try {
      const env = x.env || (() => undefined); const oi = this.objective(x, R);
      const em = require('./emailreport.cjs').build({ day: body.day, version: require('../package.json').version, cash: F, trading: T, risk: K, road, realizedUsd: F.realizedNetUsdAllTime, needsYou, decisions, departments, vpNote: note, objective: { n: oi + 1, of: VP_CHARTER.objectives.length, text: VP_CHARTER.objectives[oi] }, portalUrl: env('CHRONOS_PORTAL_URL') });
      body.html = em.html; body.subject = em.subject;
    } catch (_) { /* the plain report still goes out */ }
    this.alert('report', `Chronos daily report: ${usd(F.netUsdLast24h)} last 24 h`, `${needsYou.length} item(s) need you. Full report in the portal and your email.`);
    return this.journal('daily-report', body);
  }

  status() { return { authority: this.st.authority, profitAt: this.st.profitAt, pending: this.st.pending, recentDecisions: this.st.decisions.slice(-5), lastReportDay: this.st.lastReportDay }; }
}

module.exports = { Company, VP_CHARTER, DEPARTMENTS, VP_SETTINGS, assess, experiments, allowed, score };
