'use strict';
// The road to cash, driven by the VP. Eight milestones in order (each is the version it unlocks in the version map,
// CHANGELOG.md). Every milestone is verified by the engine from a real source (the chain, your contract, the executor's
// own readiness, receipts, shadow runs, your real checks), never from a flag someone set. The VP:
//   · works on the first milestone not yet verified: when the step is Chronos's own, it delegates the work; when the
//     step is yours, it tells you exactly what to do, and keeps telling you until it is verified done;
//   · notifies you the moment a milestone is verified, with the evidence, and the next step;
//   · notifies you at once if a verified milestone stops holding (it is then worked on again).
// Reminders for your steps: right away, then every CHRONOS_VP_NUDGE_HOURS (default 3) outside your quiet hours
// (CHRONOS_VP_QUIET, default 21-08 local), each one saying how long the step has been waiting.
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const HOUR = 3600000;

/** each milestone: what it is, who acts, and how it is verified (→ { done, evidence, todo }) */
const MILESTONES = Object.freeze([
  {
    id: 'engine', version: '2.9', title: 'The engine runs and reaches your portal', owner: 'chronos',
    verify: (x, R) => {
      const ok = !!x.lastScanAt && x.now - x.lastScanAt < 10 * 60000 && !R.data.kpis.databaseDown;
      return { done: ok, evidence: ok ? `last scan ${Math.round((x.now - x.lastScanAt) / 1000)} s ago at block ${x.res && x.res.blockNumber}; portal sync ok` : null, todo: R.data.kpis.databaseDown ? 'portal database unreachable: the engine queues rows and retries' : 'no scan in 10 minutes: chronos phone' };
    },
  },
  {
    id: 'contract-v2', version: '3.0', title: 'Contract v2 deployed and yours', owner: 'you',
    verify: (x) => {
      const a = x.env('CHRONOS_FLASH_ARB_ADDRESS'); const c = x.contractInfo;
      const ok = ADDR.test(a || '') && c && c.kind === 2;
      return { done: ok, evidence: ok ? `read on chain: ${a} is ChronosFlashArbV2 (Balancer vault ${c.vault ? 'set' : 'unset'}, ${c.factoriesAllowed} venue factories allowed)` : null, todo: 'In Termux: chronos mainnet  → type YES at the deploy step (about 0.01 ETH of gas from your owner wallet)' };
    },
  },
  {
    id: 'real-checks', version: '3.0', title: 'Every real check passes against Arbitrum One', owner: 'chronos',
    verify: (x) => {
      const rs = (x.realcheck && x.realcheck.results) || []; const fail = rs.filter((r) => r.status === 'fail').map((r) => r.id);
      const ok = rs.length > 0 && fail.length === 0 && rs.some((r) => r.id === 'contract-deployed' && r.status === 'pass');
      return { done: ok, evidence: ok ? `${rs.filter((r) => r.status === 'pass').length} real checks pass (${x.realcheck.at})` : null, todo: fail.length ? `failing: ${fail.join(', ')} (the VP reruns verify-real; fix: chronos verify-real)` : 'run: chronos verify-real' };
    },
  },
  {
    id: 'executor', version: '4.0', title: 'Executor ready: operator of your contract, with gas, its key able to sign (Cloud HSM or your phone key)', owner: 'you',
    verify: (x) => {
      const e = x.execInfo; const ok = !!(e && e.ready);
      const todo = !ADDR.test(x.env('CHRONOS_EXECUTOR_ADDRESS') || '')
        ? 'Fix the Google Cloud payment method (console.cloud.google.com/billing), run the Cloud Shell command from chronos mainnet, approve "chronos-engine" in your portal → Devices; your phone picks up the executor'
        : e && /key agent is not running/.test(e.why || '') ? 'your phone key is locked: chronos executor unlock'
        : e && /no executor key yet/.test(e.why || '') ? `give ${x.env('CHRONOS_EXECUTOR_ADDRESS')} a key that can sign: chronos executor import (on this phone) or cloud/gcp-setup.sh (Cloud KMS)`
        : `run chronos mainnet: it makes ${x.env('CHRONOS_EXECUTOR_ADDRESS')} an operator and sends it gas (shown first, sent on YES)${e && e.why ? ` · now: ${e.why}` : ''}`;
      return { done: ok, evidence: ok ? `executor ${e.address || x.env('CHRONOS_EXECUTOR_ADDRESS')} is an operator with ${Number(e.gasEth).toFixed(4)} ETH of gas (read on chain)` : null, todo };
    },
  },
  {
    id: 'closest-route', version: '5.0', title: 'A route clears your profit floor', owner: 'chronos',
    verify: (x, R) => {
      const ok = (R.trading.kpis.approved || 0) > 0;
      return { done: ok, evidence: ok ? `${R.trading.kpis.approved} route(s) approved in the last scan, best $${Number(R.trading.kpis.bestNetUsd).toFixed(2)}` : null, todo: `best net now ${Number.isFinite(R.trading.kpis.bestNetUsd) ? '$' + R.trading.kpis.bestNetUsd.toFixed(2) : '—'} (top blocker ${R.trading.kpis.topBlocker || '—'}): the VP tunes one setting at a time and requests the build work the Path to profit data points to` };
    },
  },
  {
    id: 'shadow-win', version: '7.0', title: 'A shadow test wins on mainnet', owner: 'chronos',
    verify: (x) => ({ done: (x.shadowWins || 0) > 0, evidence: x.shadowWins > 0 ? `${x.shadowWins} shadow win(s): full simulation against the live chain netted a profit` : null, todo: 'every approved route is shadow-tested automatically' }),
  },
  {
    id: 'live', version: '7.0', title: 'LIVE mode by your promotion rules', owner: 'chronos',
    verify: (x, R) => ({ done: R.risk.kpis.mode === 'LIVE', evidence: R.risk.kpis.mode === 'LIVE' ? 'mode LIVE (promotion rules held)' : null, todo: `mode ${R.risk.kpis.mode || '—'}${R.risk.kpis.heldWhy ? ` (${R.risk.kpis.heldWhy})` : ''}: promotion is automatic once the rules hold` }),
  },
  {
    id: 'cash', version: '8.0', title: 'First profit verified from receipts', owner: 'chronos',
    verify: (x, R) => {
      const n = R.treasury.kpis.realizedNetUsdAllTime || 0;
      return { done: n > 0, evidence: n > 0 ? `realized net $${n.toFixed(2)} after gas, verified from transaction receipts; 30% ($${(Math.ceil(n * 30) / 100).toFixed(2)}) for your tax reserve` : null, todo: 'live trades are verified from their receipts as they confirm' };
    },
  },
]);

/** quiet hours "21-08" → is local hour h inside them */
function quiet(spec, h) {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(String(spec || '21-08').trim()); if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  return a === b ? false : a < b ? h >= a && h < b : h >= a || h < b;
}
const ago = (ms) => (ms < HOUR ? `${Math.max(1, Math.round(ms / 60000))} min` : ms < 48 * HOUR ? `${Math.round(ms / HOUR)} h` : `${Math.round(ms / (24 * HOUR))} days`);

/** profit so far, from receipts only (the treasury department's verified numbers) */
function profit(R) {
  const k = (R && R.treasury && R.treasury.kpis) || {}; const usd = (v) => (Number(v) < 0 ? '-$' : '$') + Math.abs(Number(v) || 0).toFixed(2);
  return `Profit verified from receipts: ${usd(k.realizedNetUsdAllTime)} all time · ${usd(k.netUsdLast24h)} in 24 h (${k.tradesLast24h || 0} trades)${k.taxReserveUsd > 0 ? ` · ${usd(k.taxReserveUsd)} for your tax reserve` : ''}`;
}

/** evaluate every milestone now (no side effects) */
function evaluate(x, R) {
  return MILESTONES.map((m, i) => {
    let v; try { v = m.verify(x, R); } catch (e) { v = { done: false, evidence: null, todo: 'could not verify: ' + String(e.message).slice(0, 120) }; }
    return { step: i + 1, id: m.id, version: m.version, title: m.title, owner: m.owner, ...v };
  });
}

/**
 * One VP cycle on the road to cash. st (persisted by the company): { done: {id: {at, evidence}}, nudged: {id: {first, last, n}} }.
 * notify(level, title, text) · delegate(task) for Chronos's own steps. Returns { list, current, sent: [titles] }.
 */
async function drive(st, x, R, { notify, delegate = async () => null, localHour, nudgeHours = 3, quietHours = '21-08' }) {
  st.done = st.done || {}; st.nudged = st.nudged || {}; st.since = st.since || x.now; st.current = st.current || null;
  const list = evaluate(x, R); const sent = [];
  const say = (level, title, text) => { notify(level, title, text); sent.push(title); };
  for (const m of list) {
    const was = st.done[m.id];
    if (m.done && !was) {
      // time it took: since this step became the current one (or since the road was first checked)
      const startedAt = st.current && st.current.id === m.id ? st.current.at : st.since;
      st.done[m.id] = { at: x.now, evidence: m.evidence, tookMs: x.now - startedAt }; delete st.nudged[m.id];
      const next = list.find((n) => !n.done);
      const total = list.filter((n) => n.done).length;
      say(m.id === 'cash' ? 'money' : 'milestone', `✓ Step ${m.step} verified: ${m.title}`, `${m.evidence}. Version ${m.version} milestone, ${total} of ${list.length} verified. Took ${ago(x.now - startedAt)}.${next ? ` Next, step ${next.step}: ${next.title} (${next.owner === 'you' ? 'yours: ' + next.todo : 'Chronos is on it'}); its clock starts now.` : ' Every milestone is met.'} ${profit(R)}.`);
    } else if (!m.done && was) {
      delete st.done[m.id];
      say('critical', `✗ Step ${m.step} no longer holds: ${m.title}`, `It was verified ${ago(x.now - was.at)} ago (${was.evidence}). Now: ${m.todo}`);
    }
  }
  const current = list.find((m) => !m.done) || null;
  if (current && (!st.current || st.current.id !== current.id)) st.current = { id: current.id, at: x.now };
  if (!current) st.current = null;
  if (current) {
    const n = st.nudged[current.id] || { first: x.now, last: 0, n: 0 };
    const dueNudge = x.now - n.last >= nudgeHours * HOUR && !quiet(quietHours, localHour);
    if (current.owner === 'you' && dueNudge) {
      n.last = x.now; n.n += 1; st.nudged[current.id] = n;
      say(n.n >= 3 ? 'critical' : 'milestone', `Step ${current.step} needs you: ${current.title}`, `${n.n > 1 ? `Waiting ${ago(x.now - st.current.at)} (reminder ${n.n}). ` : ''}${current.todo}. Everything after it waits on this; Chronos verifies it the moment it is done. ${profit(R)}.`);
    } else if (current.owner === 'chronos') {
      st.nudged[current.id] = { ...n, first: n.first };
      if (current.id === 'real-checks') await delegate('verify-real');
    }
  }
  return { list: withTimes(list, st, x.now), current, sent };
}

/** the list with how long each step took (verified) or has been running (current), from the VP's state */
function withTimes(list, st, now) {
  const s = st || {};
  return list.map((m) => ({ ...m, tookMs: m.done && s.done && s.done[m.id] ? s.done[m.id].tookMs ?? null : null, runningMs: !m.done && s.current && s.current.id === m.id ? now - s.current.at : null }));
}

/** plain lines for the daily report, the dashboard and chronos progress */
function lines(list) {
  const done = list.filter((m) => m.done).length; const cur = list.find((m) => !m.done);
  const t = (m) => (Number.isFinite(m.tookMs) ? ` (took ${ago(m.tookMs)})` : Number.isFinite(m.runningMs) ? ` (${ago(m.runningMs)} so far)` : '');
  return [`ROAD TO CASH: ${done}/${list.length} verified${cur ? ` · now step ${cur.step} (version ${cur.version})${t(cur)}: ${cur.title} · ${cur.owner === 'you' ? 'YOURS: ' : 'Chronos: '}${cur.todo}` : ' · every milestone met'}`,
    ...list.map((m) => `  ${m.done ? '✓' : m === cur ? '▶' : '·'} ${m.step}. ${m.title} [v${m.version}]${t(m)}${m.done ? ' — ' + m.evidence : ''}`)];
}


/**
 * After the road to cash: the profit ladder to $100,000, counted only from verified receipts (the treasury's
 * realized net, after gas). Each rung shows what you keep after the 30% tax reserve.
 */
const LADDER = Object.freeze([
  { usd: 1, title: 'First verified profit' },
  { usd: 100, title: '$100 verified' },
  { usd: 1000, title: '$1,000 verified' },
  { usd: 5000, title: '$5,000 verified' },
  { usd: 10000, title: '$10,000 verified' },
  { usd: 25000, title: '$25,000 verified' },
  { usd: 50000, title: '$50,000 verified' },
  { usd: 100000, title: '$100,000 verified and received' },
]);
/** → [{ rung, usd, title, done, pct, keepUsd }] for a realized net (USD, all time) */
function ladder(realizedUsd, taxBps = 3000) {
  const r = Math.max(0, Number(realizedUsd) || 0); let prev = 0;
  return LADDER.map((x, i) => { const pct = r >= x.usd ? 100 : Math.max(0, Math.min(100, ((r - prev) / (x.usd - prev)) * 100)); const row = { rung: i + 1, usd: x.usd, title: x.title, done: r >= x.usd, pct: r >= prev ? Math.round(pct) : 0, keepUsd: Math.round(x.usd * (1 - taxBps / 10000)) }; prev = x.usd; return row; });
}
/** every step from now to $100,000: the road (8) then the ladder (8) → { total, done, left, next } */
function stepsLeft(road, realizedUsd) {
  const l = ladder(realizedUsd); const all = [...road.map((m) => ({ kind: 'road', ...m })), ...l.map((m) => ({ kind: 'ladder', ...m }))];
  const done = all.filter((m) => m.done).length;
  return { total: all.length, done, left: all.length - done, next: all.find((m) => !m.done) || null, ladder: l };
}
function ladderLines(realizedUsd) {
  const l = ladder(realizedUsd); const cur = l.find((x) => !x.done);
  return [`PROFIT LADDER TO $100,000: ${l.filter((x) => x.done).length}/${l.length} rungs${cur ? ` · next: ${cur.title} (${cur.pct}% of the way)` : ' · complete'}`,
    ...l.map((x) => `  ${x.done ? '✓' : x === cur ? '▶' : '·'} ${x.rung}. ${x.title} (you keep $${x.keepUsd.toLocaleString('en-US')} after the 30% tax reserve)`)];
}

module.exports = { MILESTONES, evaluate, drive, lines, quiet, profit, withTimes, LADDER, ladder, stepsLeft, ladderLines };
