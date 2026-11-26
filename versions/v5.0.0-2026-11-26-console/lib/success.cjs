'use strict';
// Building on success, with the same care as handling failure. Every cycle the VP spends one pass on problems
// (incidents, risk, the resolver) and one on what works:
//   · it notices real wins as they happen: the first route above your floor, a new closest-ever route, every shadow win,
//     every profit verified from receipts, and tells you (with the numbers);
//   · it keeps a playbook of what worked: each route pattern (path, lender, legs, size) that was approved, won its shadow
//     test or paid, how often and how well, so the desk knows what to repeat;
//   · it holds every profit and success policy in one place (profit floor, profit capture, tax reserve, drawdown and gas
//     caps, price impact, promotion to LIVE, payouts, receipts-only profit) with whether each holds right now.
// Only measured numbers are used: a scan, a shadow run or a receipt. Nothing is estimated or projected.
const HOUR = 3600000;
const usd = (v) => (Number(v) < 0 ? '-$' : '$') + Math.abs(Number(v) || 0).toFixed(2);
const PROFIT_POLICY_IDS = ['PROFIT', 'T1', 'DD', 'GAS', 'SLIP', 'LIVE'];

/** route pattern of a candidate: what to repeat */
function pattern(c) {
  const path = (c.loopPath || c.path || []).join('>');
  return { key: `${path}|${(c.flash && c.flash.provider) || 'aave_v3'}|${c.legsCount || 0}`, path, lender: (c.flash && c.flash.provider) || 'aave_v3', legs: c.legsCount || 0 };
}

/**
 * One success pass. st (persisted): { best: {netUsd, at}, firstRouteAt, shadowWins, profitUsd, playbook: {key: {...}}, lastRecordNote }.
 * x: { now, res, shadowWins, realized, policies, cfg } · notify(level, title, text). Returns { wins, lines }.
 */
function track(st, x, R, { notify }) {
  st.playbook = st.playbook || {}; const wins = [];
  const win = (title, text) => { wins.push(title); notify('success', title, text); };
  const res = x.res; const I = res && res.indicators; const floor = x.cfg && Number(x.cfg.MIN_NET_PROFIT_USD);
  // 1. the routes that cleared every rule this scan go into the playbook
  for (const c of (res && res.candidates) || []) {
    if (!c.approved || !Number.isFinite(c.netUsd)) continue;
    const p = pattern(c); const e = st.playbook[p.key] || { ...p, approved: 0, shadowWins: 0, bestNetUsd: c.netUsd, firstAt: x.now };
    e.approved += 1; e.bestNetUsd = Math.max(e.bestNetUsd, c.netUsd); e.lastAt = x.now; e.lastSizeUsd = Number.isFinite(c.amountUsd) ? c.amountUsd : e.lastSizeUsd ?? null;
    st.playbook[p.key] = e;
  }
  if (res && res.approved > 0 && !st.firstRouteAt) {
    st.firstRouteAt = x.now; const top = (res.candidates || []).filter((c) => c.approved).sort((a, b) => b.netUsd - a.netUsd)[0];
    win('★ First route above your floor', `${top ? pattern(top).path + ' via ' + pattern(top).lender + ' nets ' + usd(top.netUsd) + ' after gas and fees' : res.approved + ' route(s) approved'} at block ${res.blockNumber}. It goes to its shadow test now.`);
  }
  // 2. closest-ever route (a record), told when it improves by $0.50 or more, or crosses zero or your floor
  const best = I && I.best && Number.isFinite(I.best.netUsd) ? I.best.netUsd : null;
  if (best !== null) {
    const was = st.best ? st.best.netUsd : null;
    if (was === null) st.best = { netUsd: best, at: x.now };
    else if (best > was) {
      const crossed = (was < 0 && best >= 0) || (Number.isFinite(floor) && was < floor && best >= floor);
      if (crossed || best - was >= 0.5) win(crossed ? '★ A route crossed ' + (best >= floor ? 'your profit floor' : 'break-even') : '★ New closest route', `best net ${usd(best)} (was ${usd(was)}, ${Math.round((x.now - st.best.at) / HOUR)} h ago)${Number.isFinite(floor) ? `; your floor is ${usd(floor)}, ${best >= floor ? 'cleared' : usd(floor - best) + ' to go'}` : ''}.`);
      st.best = { netUsd: best, at: x.now };
    }
  }
  // 3. every shadow win (full simulation on the live chain netted a profit)
  const sw = Number(x.shadowWins) || 0;
  if (st.shadowWins === undefined) st.shadowWins = sw;
  else if (sw > st.shadowWins) { win(`★ Shadow win #${sw}`, `${sw - st.shadowWins} new: the full simulation against the live chain netted a profit. ${sw >= (Number(x.cfg && x.cfg.PROMOTE_MIN_WINS) || 5) ? 'Enough wins for promotion to LIVE once the rest of your rules hold.' : `${(Number(x.cfg && x.cfg.PROMOTE_MIN_WINS) || 5) - sw} more before promotion to LIVE.`}`); st.shadowWins = sw; }
  // 4. money verified from receipts (the money alert says the amount; this keeps the running total and the pattern)
  const p = R.treasury.kpis.realizedNetUsdAllTime || 0;
  if (st.profitUsd === undefined) st.profitUsd = p;
  else if (p > st.profitUsd) { win(`★ Profit up to ${usd(p)}`, `+${usd(p - st.profitUsd)} verified from receipts · ${usd(R.treasury.kpis.netUsdLast24h)} in 24 h · ${usd(R.treasury.kpis.taxReserveUsd)} for your tax reserve.`); st.profitUsd = p; }
  return { wins, lines: lines(st, x, R) };
}

/**
 * Two successes for every failure. The ledger counts only real events, from the same sources the rest of the VP uses:
 *   failures: an incident opened, a send that reverted, a real check that started failing, a road step that stopped holding;
 *   successes: a win (above), a road step verified, an incident resolved, a real check that started passing.
 * Successes are never manufactured: when the ledger is short of 2 successes per failure, the VP runs a success push,
 * the work most likely to produce real ones (competitor research to copy what pays, a fresh scan, the real checks
 * rerun) at most every 2 hours, and says so in the daily report. Counted per day (your local day) and in total.
 */
function balance(st, x, { wins = [], road = [], delegate = async () => null }) {
  const L = st.ledger = st.ledger || { failures: 0, successes: 0, day: null, dayFailures: 0, daySuccesses: 0, lastPush: 0, seen: {} };
  const day = x.day || new Date(x.now).toISOString().slice(0, 10);
  if (L.day !== day) { L.day = day; L.dayFailures = 0; L.daySuccesses = 0; }
  const fail = (n = 1) => { L.failures += n; L.dayFailures += n; }; const ok = (n = 1) => { if (n > 0) { L.successes += n; L.daySuccesses += n; L.lastSuccessAt = x.now; } };
  const seen = L.seen; const first = seen.init !== true; seen.init = true;
  // incidents: opened = failure, gone = resolved = success
  const openNow = new Set(((x.incidents && x.incidents.open) || []).map((i) => i.problem || i.id).filter(Boolean));
  const openBefore = new Set(seen.open || []);
  if (!first) { for (const p of openNow) if (!openBefore.has(p)) fail(); for (const p of openBefore) if (!openNow.has(p)) ok(); }
  seen.open = [...openNow];
  // reverted sends (the executor's own daily count)
  const rv = (x.today && x.today.reverted) || 0; const rvDay = (x.today && x.today.day) || day;
  if (!first && seen.rvDay === rvDay && rv > (seen.rv || 0)) fail(rv - (seen.rv || 0));
  seen.rv = rv; seen.rvDay = rvDay;
  // real checks: started failing = failure, started passing = success
  const rc = Object.fromEntries((((x.realcheck && x.realcheck.results) || [])).map((r) => [r.id, r.status]));
  if (!first) for (const [id, s] of Object.entries(rc)) { const was = (seen.rc || {})[id]; if (was && was !== s) { if (s === 'fail') fail(); else if (s === 'pass' && was === 'fail') ok(); } }
  seen.rc = rc;
  // road to cash and wins (already real, already told)
  for (const t of road) { if (/^✓ Step/.test(t)) ok(); else if (/^✗ Step/.test(t)) fail(); }
  ok(wins.length);
  const short = 2 * L.dayFailures - L.daySuccesses;
  let push = null;
  if (short > 0 && x.now - L.lastPush >= 2 * HOUR) { L.lastPush = x.now; push = ['research', 'scan-now', ...(Object.values(rc).includes('fail') ? ['verify-real'] : [])]; for (const k of push) delegate(k).catch(() => {}); } // the real checks are rerun only when one is failing
  return { ...L, short, push };
}

/** the ledger as one report line */
function ledgerLine(L) {
  if (!L) return 'SUCCESS LEDGER: no events counted yet';
  const short = 2 * L.dayFailures - L.daySuccesses;
  return `SUCCESS LEDGER (target: 2 successes per failure): today ${L.daySuccesses} successes for ${L.dayFailures} failures${short > 0 ? ` · ${short} short: the VP is on a success push (competitor research to copy what pays, a fresh scan, real checks rerun)` : ' · on target'} · in total ${L.successes} for ${L.failures}`;
}

/** every profit and success policy, with whether it holds now (from lib/policies.cjs plus the promotion and payout rules) */
function policyLines(x) {
  const P = (x.policies || []).filter((p) => PROFIT_POLICY_IDS.includes(p.id));
  const env = x.env || (() => undefined); const cfg = x.cfg || {};
  const out = P.map((p) => `  ${/ENFORCED|READY|OK|ON/.test(p.status) ? '✓' : '!'} ${p.name}: ${p.rule} — ${p.status}${p.detail ? ' (' + p.detail + ')' : ''}`);
  out.push(`  ✓ Profit counts only when verified from transaction receipts (never from a quote or a simulation)`);
  out.push(`  ✓ Promotion to LIVE: ${cfg.PROMOTE_MIN_WINS ?? env('PROMOTE_MIN_WINS') ?? 5} shadow wins${env('GO_MIN_USD_PER_DAY') ? ` and ${usd(env('GO_MIN_USD_PER_DAY'))}/day projected from verified wins` : ''}; every trade is shadow-tested first`);
  out.push(`  ${/^0x[0-9a-fA-F]{40}$/.test(env('PAYOUT_WALLET_ADDRESS') || '') ? '✓' : '!'} Payouts to your wallet ${env('PAYOUT_WALLET_ADDRESS') ? env('PAYOUT_WALLET_ADDRESS').slice(0, 6) + '…' : 'not set (chronos set PAYOUT_WALLET_ADDRESS)'}`);
  out.push('  ✓ The first verified profit ends the VP\'s full control (limits only from then on)');
  return out;
}

/** the daily report's success half */
function lines(st, x, R) {
  const pb = Object.values(st.playbook || {}).sort((a, b) => b.bestNetUsd - a.bestNetUsd || b.approved - a.approved).slice(0, 5);
  return [
    'WHAT WORKED (building on success):',
    `  closest route ever: ${st.best ? usd(st.best.netUsd) : '—'}${st.best ? ` (${new Date(st.best.at).toISOString().slice(0, 16).replace('T', ' ')} UTC)` : ''} · shadow wins ${st.shadowWins ?? 0} · profit from receipts ${usd(R.treasury.kpis.realizedNetUsdAllTime)}`,
    ...(pb.length ? pb.map((e) => `  ${e.path} via ${e.lender} (${e.legs} legs): approved ${e.approved}×, best ${usd(e.bestNetUsd)}${Number.isFinite(e.lastSizeUsd) ? `, last size ${usd(e.lastSizeUsd)}` : ''} — repeat it`) : ['  no route has cleared every rule yet: the Path to profit data shows what is closest and what stops it']),
    '',
    ledgerLine(st.ledger),
    '',
    'PROFIT & SUCCESS POLICY (one place, checked now):',
    ...policyLines(x),
  ];
}

module.exports = { track, balance, ledgerLine, lines, policyLines, pattern, PROFIT_POLICY_IDS };
