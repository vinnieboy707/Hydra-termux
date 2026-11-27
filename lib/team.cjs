'use strict';
// The VP's standing team: eight stationary specialists, one per angle, designed by the VP's charter. Every VP cycle
// (30 s) they run in a fixed order, synchronously: each checks its triggers against the engine's real state, uses its
// skills (allowlisted actions and tasks only), and reports to the VP. The VP then gives feedback on every report:
//   · a trigger whose action cleared the condition by the next cycle is EFFECTIVE (the agent's score rises);
//   · one that did not is INEFFECTIVE: the agent backs off (its cooldown doubles, up to 16×) so it never hammers, and
//     after 3 ineffective runs in a row the VP takes it over: it opens a worker cell (lib/mind.cjs) for deeper work
//     and tells you when it needs you.
// Errors still get the incident resolver at once on every log line (lib/resolver.cjs); the team covers the standing
// angles (uptime, data, risk, profit, research, security, treasury) on every cycle.
const MIN = 60000;

/** agent → triggers: when(x, R) → detail | null · skill: 'act:<allowlisted action>' | '<task>' | 'escalate' */
const AGENTS = Object.freeze([
  { id: 'sre', title: 'Uptime (SRE)', mandate: 'the engine scans every block, 24/7: nodes, feeds, scans, real checks', triggers: [
    { id: 'scans-stale', when: (x, R) => (R.trading.notes.includes('scans are stale') ? 'no completed scan for 3 intervals' : null), skill: 'act:scan-now', cooldownMs: 2 * MIN },
    { id: 'node-errors', when: (x) => (x.scanError && /429|rate.?limit|timeout|ECONN|ENOTFOUND|network|socket/i.test(x.scanError) ? x.scanError.slice(0, 80) : null), skill: 'act:failover-node', cooldownMs: 5 * MIN },
    { id: 'feed-down', when: (x) => (x.feed && x.feed.feeds > 0 && x.feed.up === 0 ? `0 of ${x.feed.feeds} websocket feeds up` : null), skill: 'act:restart-feed', cooldownMs: 5 * MIN },
    { id: 'real-checks-failing', when: (x, R) => (R.sre.kpis.realChecks.fail > 0 ? `failing: ${R.sre.kpis.realChecks.failed.join(', ')}` : null), skill: 'verify-real', cooldownMs: 60 * MIN },
  ] },
  { id: 'data', title: 'Data', mandate: 'every row reaches your portal', triggers: [
    { id: 'sync-backlog', when: (x, R) => (R.data.kpis.pending > 200 ? `${R.data.kpis.pending} rows queued` : null), skill: 'flush-sync', cooldownMs: 10 * MIN },
  ] },
  { id: 'risk', title: 'Risk', mandate: 'no loss: policies hold, reverts stop sending', triggers: [
    { id: 'policy-fail', when: (x, R) => (R.risk.kpis.policyFails.length ? `policy ${R.risk.kpis.policyFails.join(', ')} failing` : null), skill: 'act:shadow-only', cooldownMs: 30 * MIN, tellYou: true },
    { id: 'reverts', when: (x, R) => (R.risk.kpis.mode === 'LIVE' && R.risk.kpis.revertsToday > 0 ? `${R.risk.kpis.revertsToday} reverted send(s) today` : null), skill: 'act:shadow-only', cooldownMs: 60 * MIN, tellYou: true },
  ] },
  { id: 'trading', title: 'Profit desk', mandate: 'every route quoted, the best ones sized; quotes never wasted', triggers: [
    { id: 'quote-failures', when: (x) => (x.lastQuotes && x.lastQuotes.n > 50 && x.lastQuotes.fail / x.lastQuotes.n > 0.5 ? `${x.lastQuotes.fail} of ${x.lastQuotes.n} quotes failed` : null), skill: 'act:reduce-load', cooldownMs: 30 * MIN },
    { id: 'dust-routes', when: (x) => { const b = x.res && x.res.indicators && x.res.indicators.best; return b && b.amountUsd > 0 && b.netUsd <= -0.9 * b.amountUsd ? `best route returns dust (${Math.round(b.netUsd)} on ${Math.round(b.amountUsd)}): pool list rebuilt` : null; }, skill: 'act:clear-market-cache', cooldownMs: 6 * 60 * MIN },
  ] },
  { id: 'research', title: 'Research', mandate: 'what wins on-chain, fresh every 12 h', triggers: [
    { id: 'research-stale', when: (x, R) => (R.research.kpis.ageHours === null || R.research.kpis.ageHours >= 12 ? 'research older than 12 h' : null), skill: 'research', cooldownMs: 12 * 60 * MIN },
  ] },
  { id: 'security', title: 'Security', mandate: 'sealed code, your keys and funds untouched', triggers: [
    { id: 'integrity', when: (x, R) => (R.security.status === 'red' ? 'code integrity broken' : null), skill: 'act:shadow-only', cooldownMs: 30 * MIN, tellYou: true },
    { id: 'executor-foreign-send', when: (x) => { const c = x.audit && (x.audit.checks || []).find((y) => y.id === 'executor-sends'); return c && c.status === 'fail' ? c.detail.slice(0, 120) : null; }, skill: 'act:shadow-only', cooldownMs: 30 * MIN, tellYou: true },
  ] },
  { id: 'gas', title: 'Gas', mandate: 'every route priced with its own measured gas; the executor never runs dry; no sends into a gas spike', triggers: [
    { id: 'sends-left-low', when: (x) => (x.gas && Number.isFinite(x.gas.sendsLeft) && x.gas.topUpEth > 0 ? `executor can pay for ${x.gas.sendsLeft} more send(s) at today's gas; top up ${x.gas.topUpEth.toFixed(5)} ETH to get back to 200 (chronos mainnet shows it; sent on YES)` : null), skill: 'escalate', cooldownMs: 6 * 60 * MIN, tellYou: true },
    { id: 'gas-spike', when: (x) => (x.gas && x.gas.spike ? `gas ${x.gas.spike.now} gwei is over 5× its median ${x.gas.spike.median} gwei: sending paused 1 h, shadow continues` : null), skill: 'act:shadow-only', cooldownMs: 60 * MIN, tellYou: true },
  ] },
  { id: 'treasury', title: 'Treasury', mandate: 'gas for the executor, 30% tax reserve, payouts', triggers: [
    { id: 'executor-gas-low', when: (x, R) => (R.treasury.notes.some((n) => /gas is below/.test(n)) ? 'executor gas below its minimum: top it up (chronos mainnet shows the cost; sent on YES)' : null), skill: 'escalate', cooldownMs: 3 * 60 * MIN, tellYou: true },
  ] },
]);

class Team {
  /** st: persisted feedback state (the company's) · now: clock */
  constructor(st, now = () => Date.now()) { this.st = st; this.now = now; st.team = st.team || {}; }

  /**
   * One synchronous round: every agent, in order. d: { act(action) → string, task(name) → string, tell(title, text) }.
   * → { reports: [{ agent, title, fired: [{ trigger, detail, skill, result }], score }], takeovers: [{ agent, trigger, detail }] }
   */
  async run(x, R, d) {
    const t = this.now(); const reports = []; const takeovers = [];
    for (const a of AGENTS) {
      const fired = [];
      for (const tr of a.triggers) {
        const k = `${a.id}:${tr.id}`; const s = this.st.team[k] = this.st.team[k] || { runs: 0, effective: 0, streak: 0, back: 1, last: 0, open: false };
        let detail = null; try { detail = tr.when(x, R); } catch (_) { detail = null; }
        // the VP's feedback on the last run: cleared → effective; still there → ineffective, back off, take over at 3
        if (s.open && t > s.last) {
          if (!detail) { s.effective += 1; s.streak = 0; s.back = 1; s.open = false; }
          else if (t - s.last >= tr.cooldownMs * s.back) { s.streak += 1; s.back = Math.min(16, s.back * 2); s.open = false; if (s.streak === 3) takeovers.push({ agent: a.id, trigger: tr.id, detail }); }
        }
        if (!detail || s.open || t - s.last < tr.cooldownMs * s.back) continue;
        let result;
        try {
          if (tr.skill === 'escalate') result = 'told you';
          else if (tr.skill.startsWith('act:')) result = String(await d.act(tr.skill.slice(4)));
          else result = String(await d.task(tr.skill));
        } catch (e) { result = 'failed: ' + String(e.message).slice(0, 120); }
        if (tr.tellYou) d.tell(`${a.title}: ${tr.id}`, `${detail}. Done: ${tr.skill === 'escalate' ? 'nothing Chronos may do alone' : tr.skill.replace('act:', '')} → ${result}`);
        s.runs += 1; s.last = t; s.open = true;
        fired.push({ trigger: tr.id, detail, skill: tr.skill, result: result.slice(0, 200) });
      }
      const mine = Object.entries(this.st.team).filter(([k]) => k.startsWith(a.id + ':')).map(([, v]) => v);
      const runs = mine.reduce((n, v) => n + v.runs, 0); const eff = mine.reduce((n, v) => n + v.effective, 0);
      reports.push({ agent: a.id, title: a.title, status: R[a.id === 'trading' ? 'trading' : a.id] ? R[a.id === 'trading' ? 'trading' : a.id].status : null, fired, score: { runs, effective: eff, rate: runs ? Math.round((100 * eff) / runs) : null } });
    }
    return { reports, takeovers };
  }
}

/** report lines for the daily report and the dashboard */
function lines(rs) {
  if (!rs || !rs.reports) return ['VP TEAM: not run yet'];
  return ['VP TEAM (8 standing agents, report every 30 s):', ...rs.reports.map((r) => `  · ${r.title}: ${r.status || '—'}${r.fired.length ? ' · acted: ' + r.fired.map((f) => `${f.trigger} → ${f.skill.replace('act:', '')}`).join(', ') : ''} · effective ${r.score.rate === null ? '—' : r.score.rate + '%'} of ${r.score.runs} run(s)`)];
}

module.exports = { Team, AGENTS, lines };
