'use strict';
// Automatic shadow ↔ live switching. SHADOW simulates every approved opportunity with your contract's exact call.
// LIVE sends the ones whose fresh simulation clears your floor, and keeps simulating everything else, so both run
// together and you see simulated $/day next to realized $/day (the gap is what competitors take).
// Promotion needs every condition; demotion needs any one. Every condition is reported with have / need so the
// screen can show exactly when the next switch happens.
const DAY = 86400000;
const utcDay = (t) => new Date(t).toISOString().slice(0, 10);

/** Shadow statistics over the last 24 h from shadow run records. */
function shadowStats(runs, now = Date.now()) {
  const r = runs.filter((x) => now - x.at < DAY && x.stage !== 'preflight-error');
  const sims = r.filter((x) => x.stage === 'done' || x.stage === 'simulation');
  const wins = sims.filter((x) => x.win);
  const first = r.length ? Math.min(...r.map((x) => x.at)) : now;
  const hours = Math.max(1 / 60, (now - first) / 3600000);
  const sumNet = wins.reduce((a, x) => a + x.netUsd, 0);
  const blocked = r.filter((x) => x.stage === 'preflight');
  return { runs: r.length, sims: sims.length, wins: wins.length, winRate: sims.length ? wins.length / sims.length : 0, sumNetUsd: sumNet,
    perDayUsd: hours >= 1 / 6 ? (sumNet / hours) * 24 : null, observedMin: Math.round(hours * 60), lastBlocked: blocked.length ? blocked[blocked.length - 1] : null };
}

/**
 * @param {object} a
 *   policy: readExecPolicy(...).policy · goMinUsdPerDay · maxDailyDrawdownUsd
 *   exec: { ready, why } executor readiness (KMS key reachable, operator on the contract, gas balance)
 *   shadow: shadowStats(...) · live: { day, gasUsd, netUsd, sent, reverted, consecutiveReverts } (today, UTC)
 *   prev: previous mode state { mode, since, heldUntil, heldWhy } · killed: kill switch present
 */
function evaluate({ policy, goMinUsdPerDay, maxDailyDrawdownUsd, exec, shadow, live, prev = {}, killed = false, gasEth = null, now = Date.now() }) {
  const P = policy;
  const today = live && live.day === utcDay(now) ? { lossGasUsd: 0, ...live } : { gasUsd: 0, lossGasUsd: 0, netUsd: 0, sent: 0, reverted: 0, consecutiveReverts: 0 };
  const demote = [
    { name: 'kill switch', bad: !!killed, have: killed ? 'ON' : 'off', need: 'off', hold: 'until removed' },
    { name: 'mode setting', bad: P.CHRONOS_MODE === 'shadow', have: P.CHRONOS_MODE, need: 'auto', hold: 'until CHRONOS_MODE=auto' },
    { name: 'realized net today', bad: today.netUsd <= -Math.abs(maxDailyDrawdownUsd || 0) && today.sent > 0, have: today.netUsd, need: `> −$${maxDailyDrawdownUsd}`, hold: 'next UTC day' },
    { name: 'reverts in a row', bad: today.consecutiveReverts >= P.MAX_CONSECUTIVE_REVERTS, have: today.consecutiveReverts, need: `< ${P.MAX_CONSECUTIVE_REVERTS}`, hold: '30 min, then fresh shadow wins' },
    { name: 'gas lost to reverts today', bad: today.lossGasUsd >= P.MAX_DAILY_GAS_USD, have: today.lossGasUsd, need: `< $${P.MAX_DAILY_GAS_USD}`, hold: 'next UTC day' },
    { name: 'profit guard', bad: today.sent >= (P.GUARD_MIN_SENDS || 5) && today.netUsd <= 0, have: today.sent >= (P.GUARD_MIN_SENDS || 5) ? today.netUsd : `${today.sent}/${P.GUARD_MIN_SENDS || 5} sends`, need: 'net > $0', hold: 'next UTC day' },
    { name: 'executor gas balance', bad: gasEth !== null && gasEth < P.EXEC_MIN_GAS_ETH, have: gasEth, need: `≥ ${P.EXEC_MIN_GAS_ETH} ETH`, hold: 'until topped up' },
  ];
  const promote = [
    { name: 'executor ready', met: !!(exec && exec.ready), have: exec && exec.ready ? 'yes' : (exec && exec.why) || 'no', need: 'yes' },
    { name: 'shadow wins (24 h)', met: shadow.wins >= P.PROMOTE_MIN_WINS, have: shadow.wins, need: P.PROMOTE_MIN_WINS, frac: Math.min(1, shadow.wins / P.PROMOTE_MIN_WINS) },
    { name: 'shadow win rate', met: shadow.sims > 0 && shadow.winRate * 10000 >= P.PROMOTE_MIN_WIN_RATE_BPS, have: shadow.winRate, need: P.PROMOTE_MIN_WIN_RATE_BPS / 10000, frac: Math.min(1, (shadow.winRate * 10000) / P.PROMOTE_MIN_WIN_RATE_BPS) },
    { name: 'simulated $/day', met: shadow.perDayUsd !== null && shadow.perDayUsd >= (goMinUsdPerDay || 0), have: shadow.perDayUsd, need: goMinUsdPerDay || 0, frac: shadow.perDayUsd === null ? 0 : Math.min(1, shadow.perDayUsd / Math.max(1e-9, goMinUsdPerDay || 1e-9)) },
  ];
  const bad = demote.filter((d) => d.bad);
  let { mode = 'SHADOW', since = now, heldUntil = 0, heldWhy = null } = prev;
  // a hold from an earlier demotion: next UTC day for money caps, 30 min for reverts
  if (heldUntil && now >= heldUntil) { heldUntil = 0; heldWhy = null; }
  if (mode === 'LIVE' && bad.length) {
    mode = 'SHADOW'; since = now; heldWhy = bad.map((d) => d.name).join(', ');
    const nextDay = Date.parse(utcDay(now + DAY) + 'T00:00:00Z');
    heldUntil = bad.some((d) => d.hold === 'next UTC day') ? nextDay : bad.some((d) => d.name === 'reverts in a row') ? now + 30 * 60000 : 0;
  } else if (mode !== 'LIVE' && !bad.length && !heldUntil && promote.every((c) => c.met)) { mode = 'LIVE'; since = now; heldWhy = null; }
  const next = mode === 'LIVE' ? demote : promote;
  return { mode, since, heldUntil, heldWhy, promote, demote, blocking: bad, next, today };
}

/** One line for the phone and the dashboard: the mode and what the next switch is waiting for. */
/** The record before the engine's first evaluation (it is still connecting to Arbitrum One). */
const starting = () => ({ mode: 'SHADOW', starting: true, since: Date.now(), heldUntil: 0, heldWhy: null, promote: [], demote: [], today: { sent: 0, reverted: 0, netUsd: 0, gasUsd: 0 } });
function summary(m) {
  if (!m) return 'engine not running: shadow and live run in the engine';
  if (m.starting) return 'SHADOW · engine starting: reading Arbitrum One for its first scan; nothing is sent';
  const $ = (v) => (v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`);
  if (m.mode === 'LIVE') return `LIVE · today ${$(m.today.netUsd)} net · ${m.today.sent} sent · ${m.today.reverted} reverted · gas ${$(m.today.gasUsd)}`;
  const held = m.heldUntil ? ` · held until ${new Date(m.heldUntil).toISOString().slice(11, 16)} UTC (${m.heldWhy})` : '';
  const open = m.promote.filter((c) => !c.met).map((c) => c.name === 'executor ready' ? `executor: ${c.have}` : c.name === 'shadow win rate' ? `win rate ${Math.round(c.have * 100)}%/${Math.round(c.need * 100)}%` : c.name === 'simulated $/day' ? `sim $/day ${c.have === null ? 'after 10 min' : $(c.have)}/${$(c.need)}` : `wins ${c.have}/${c.need}`);
  return `SHADOW${held} · live when: ${open.length ? open.join(' · ') : 'all met'}`;
}
module.exports = { evaluate, shadowStats, utcDay, summary, starting };
