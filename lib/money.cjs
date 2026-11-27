'use strict';
// The money view: are we making money, what is stopping it right now, how to fix that, and how long it should take.
// Every figure comes from receipts, the last real scan or the measurement session. Where a time cannot be estimated
// honestly, it says so instead of guessing.
const PROFIT = require('./profit.cjs');

const fmt$ = (n, d = 2) => (Number.isFinite(n) ? (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const mins = (m) => (m < 1 ? 'under a minute' : m < 60 ? `about ${Math.ceil(m)} min` : m < 48 * 60 ? `about ${(m / 60).toFixed(1)} h` : `about ${(m / 1440).toFixed(1)} days`);
const SHORT = [[/STANDBY_GAS_WAIT/, 'gas above your ceiling'], [/NOT_EXECUTABLE/, 'venue your contract cannot call'], [/below floor/, 'below your profit floor'], [/impact/, 'price impact above your cap'], [/flash-loanable/, 'asset not flash-loanable'], [/liquidity/, 'more than Aave can lend']];

function rejectionMix(res) {
  const mix = {};
  for (const c of (res && res.candidates) || []) {
    if (c.approved) continue;
    const hit = SHORT.find(([re]) => re.test(c.reasons[0] || ''));
    const k = hit ? hit[1] : 'other';
    mix[k] = (mix[k] || 0) + 1;
  }
  return Object.entries(mix).sort((a, b) => b[1] - a[1]);
}

function explain(stage, S, sm, ed) {
  const cfg = S.cfg || {};
  const res = S.res;
  const t = S.thresholds || {};
  const elapsedMin = Math.max(1e-6, (Date.now() - S.session.startedAt) / 60000);
  switch (stage.n) {
    case 1: {
      const probs = (S.cfg && S.cfg.problems) || S.problems || [];
      return { why: probs.slice(0, 3).map((p) => p.split(' (')[0]), fix: ['press e: setup imports the keys already on this phone and asks only for what is missing', 'or run: chronos autopilot'], eta: 'about 1–2 minutes of your time' };
    }
    case 2: {
      const why = [], fix = [];
      if (S.error) { why.push(`last scan failed: ${S.error}`); fix.push('System tab → Nodes shows which RPC answers; paste a working ARB_RPC_URL with e'); }
      const badNodes = (S.nodes || []).filter((n) => !n.ok);
      if (badNodes.length) why.push(`${badNodes.length} node(s) not answering as Arbitrum One`);
      if (S.followProblem) { why.push(S.followProblem); fix.push('restart it: chronos service restart   (or press L to scan in this window)'); }
      if (!why.length) {
        const last = S.lastScanAt ? Math.round((Date.now() - S.lastScanAt) / 1000) : null;
        const took = S.res && S.res.tookMs ? Math.round(S.res.tookMs / 1000) : null;
        why.push(last === null ? (S.scanning ? 'first scan in progress' : 'waiting for the first scan')
          : `${S.scanning ? 'scan in progress' : 'waiting for the next scan'} · last full scan finished ${last} s ago${took ? ` and took ${took} s` : ''}`);
      }
      if (!fix.length) fix.push('nothing to do: it starts by itself');
      const p = S.progress;
      const eta = S.scanning && p && p.total ? `scan ${Math.round((100 * p.done) / p.total)}% (${p.phase === 'screen' ? 'checking every route' : 'sizing the best routes'})` : 'seconds';
      return { why, fix, eta };
    }
    case 3: {
      const why = [], fix = [];
      const cands = (res && res.candidates) || [];
      if (!res) return { why: ['no scan yet'], fix: ['nothing to do'], eta: 'seconds' };
      if (!cands.length) {
        // 2.9.15: say what really emptied the list (it used to claim "no token pair has two pools" every time)
        const ind = res.indicators || {}; const cy = ind.cycles || {};
        if (ind.deadRoutes || ind.thinPools) {
          why.push(`every route with a price gap this scan ran through a dead or thin pool: ${ind.deadRoutes || 0} route(s) set aside, ${ind.thinPools || 0} pool(s) under $${(ind.depthMinUsd || 1000).toLocaleString('en-US')} a side left out`);
          fix.push('nothing to do: dead pools are benched and healthy routes are checked every scan (DEPTH_MIN_USD, DEAD_LOSS_PCT)');
        } else if (cy.checked && !cy.pricesAllow) {
          why.push(`${res.marketsFound} pools, ${cy.checked} cycles checked: no cycle's prices leave a gap after fees right now`);
          fix.push('nothing to do: gaps open and close every block; more venues and tokens add more cycles (venues.json, CHRONOS_DISCOVER_TOKENS)');
        } else {
          why.push(`${res.marketsFound} pools found, but no token pair has two pools to compare`);
          fix.push('more tokens or venues widen the search: CHRONOS_DISCOVER_TOKENS or SCAN_EXTRA_TOKENS in .env, or venues in venues.json (checked on-chain)');
        }
        return { why, fix, eta: 'no estimate: depends on the market' };
      }
      const mix = rejectionMix(res);
      if (mix.length) why.push('rejected routes: ' + mix.map(([k, n]) => `${n} ${k}`).join(' · '));
      const c = cands[0];
      const floor = cfg.MIN_NET_PROFIT_USD;
      why.push(`closest: ${c.borrowSymbol} → ${c.otherSymbol} at ${fmt$(c.amountUsd, 0)}: gross ${fmt$(c.grossUsd)} − flash fee ${fmt$(c.premiumUsd)} − gas ${fmt$(c.gasUsdAssumed, 3)} = ${fmt$(c.netUsd)}${Number.isFinite(floor) ? ` (floor ${fmt$(floor)}, short by ${fmt$(Math.max(0, floor - c.netUsd))})` : ''}`);
      const noFee = c.netUsd + c.premiumUsd;
      if (c.premiumUsd > 0 && Number.isFinite(floor) && noFee >= floor) fix.push(`without the Aave flash fee this route would be ${fmt$(noFee)}: a zero-fee flash source would clear your floor (each one must be verified on-chain first)`);
      if (mix.length && mix[0][0] === 'gas above your ceiling') fix.push('gas is above GAS_CEILING_GWEI right now: the engine waits and resumes by itself');
      if (mix.length && mix[0][0] === 'venue your contract cannot call') fix.push('the best spreads are on venues your contract has no adapter for (e.g. Camelot): adding an adapter means a contract change and a new review');
      fix.push('otherwise only the market can open a bigger spread; the engine keeps watching and alerts you the moment one passes every guardrail');
      return { why, fix, eta: `cannot be estimated: depends on the market · ${sm.episodes} opportunit${sm.episodes === 1 ? 'y' : 'ies'} in ${sm.scans} scan${sm.scans === 1 ? '' : 's'} so far` };
    }
    case 4: {
      const why = [], parts = [];
      const need = (have, goal) => Math.max(0, (goal || 0) - have);
      if (sm.verdict === 'MEASURING') parts.push(sm.minutesToProjection);
      const epRate = sm.episodes / elapsedMin, blkRate = sm.distinctBlocks / elapsedMin;
      const epLeft = need(sm.episodes, t.GO_MIN_EPISODES), blkLeft = need(sm.distinctBlocks, t.GO_MIN_DISTINCT_BLOCKS);
      why.push(`episodes ${sm.episodes}/${t.GO_MIN_EPISODES ?? '?'} · distinct blocks ${sm.distinctBlocks}/${t.GO_MIN_DISTINCT_BLOCKS ?? '?'} · $/day ${sm.perDayUpperBound === null ? `after ${Math.ceil(sm.minutesToProjection)} more min` : `${fmt$(sm.perDayUpperBound)}/${fmt$(t.GO_MIN_USD_PER_DAY)}`}`);
      let unknown = false;
      if (epLeft) { if (epRate > 0) parts.push(epLeft / epRate); else unknown = true; }
      if (blkLeft) { if (blkRate > 0) parts.push(blkLeft / blkRate); else unknown = true; }
      const usdShort = sm.perDayUpperBound !== null && Number.isFinite(t.GO_MIN_USD_PER_DAY) && sm.perDayUpperBound < t.GO_MIN_USD_PER_DAY;
      if (usdShort) why.push(`projected ${fmt$(sm.perDayUpperBound)}/day is below your GO minimum of ${fmt$(t.GO_MIN_USD_PER_DAY)}/day`);
      const eta = unknown || usdShort ? 'no reliable estimate yet: opportunities have to keep appearing' : parts.length ? `${mins(Math.max(...parts))} at the current rate` : 'any moment';
      return { why, fix: ['nothing to do: keep the engine running, it measures continuously', 'GO thresholds are yours to set (Policies tab · chronos setup)'], eta };
    }
    case 5: {
      const m = S.mode; const sh = S.shadowStats;
      if (!m || !sh) return { why: ['the shadow test runs in the 24/7 engine'], fix: ['start it: chronos service install'], eta: 'seconds once the engine runs' };
      const why = [], fix = [];
      if (!sh.runs) why.push(S.execInfo && !S.execInfo.address && !S.execInfo.ready ? `no executor to simulate from: ${S.execInfo.why}` : 'no approved opportunity simulated yet');
      else why.push(`${sh.wins} win(s) in ${sh.sims} simulation(s) (24 h) · win rate ${Math.round(sh.winRate * 100)}%`);
      const lb = sh.lastBlocked;
      if (lb && lb.failed) { why.push('last simulation blocked by: ' + lb.failed.map((f) => f.name).join(', ')); lb.failed.filter((f) => f.fix).forEach((f) => fix.push(f.fix)); }
      if (!fix.length) fix.push(S.execInfo && !S.execInfo.address ? 'set CHRONOS_EXECUTOR_ADDRESS (an operator on your contract) to simulate now, or run cloud/gcp-setup.sh for the KMS executor' : 'nothing to do: every approved opportunity is simulated automatically');
      const c = (m.promote || []).find((x) => x.name === 'shadow wins (24 h)');
      const rate = sh.wins / Math.max(1e-6, sh.observedMin);
      return { why, fix, eta: c && !c.met && rate > 0 ? `${mins((c.need - c.have) / rate)} at the current rate` : 'no reliable estimate yet: depends on the market' };
    }
    case 6: {
      const m = S.mode;
      if (!m) return { why: ['live execution runs in the 24/7 engine'], fix: ['start it: chronos service install'], eta: 'seconds once the engine runs' };
      if (m.starting) return { why: ['the engine is starting: its first scan of Arbitrum One is in progress'], fix: ['nothing to do: wait for the first scan'], eta: 'usually under a minute' };
      const open = (m.mode === 'LIVE' ? [] : (m.promote || []).filter((c) => !c.met)).map((c) => `${c.name}: ${typeof c.have === 'number' ? +c.have.toFixed(2) : c.have} / ${c.need}`);
      return { why: m.heldUntil ? [`held after ${m.heldWhy}`, ...open] : open.length ? open : ['switching'], fix: [S.execInfo && S.execInfo.ready ? 'nothing to do: it switches to LIVE by itself when every condition is met' : `executor: ${S.execInfo ? S.execInfo.why : 'not set up'}`], eta: m.heldUntil ? `held until ${new Date(m.heldUntil).toISOString().slice(11, 16)} UTC` : 'automatic, as soon as the conditions are met' };
    }
    default: {
      const rz = S.realized;
      if (!rz || !rz.contract) return { why: ['no contract address set, so no profit can be verified'], fix: ['deploy your contract (chronos mainnet), which saves CHRONOS_FLASH_ARB_ADDRESS with e'], eta: 'seconds once set' };
      return { why: [rz.executions && rz.executions.length ? `net after gas is ${fmt$(rz.totalNetUsd)}` : 'no Arbitrage receipts from your contract yet'], fix: ['nothing to do here: verified automatically every 10 minutes'], eta: 'checked every 10 minutes' };
    }
  }
}

function view(S) {
  const pr = PROFIT.evaluate(S);
  const sm = S.session.summary(S.thresholds || {});
  const ed = S.session.edge();
  const rz = S.realized;
  const stageN = pr.current ? pr.current.n : 7;
  const metCount = pr.current ? pr.current.n - 1 : 7;
  return {
    making: pr.profiting,
    realizedNetUsd: rz && rz.executions ? rz.totalNetUsd : null,
    verifiedExecutions: rz && rz.executions ? rz.executions.length : 0,
    taxReserveUsd: rz ? rz.taxReserveUsd : null,
    stageN, progress: metCount / 7, stages: pr.stages,
    blocker: pr.current ? { n: pr.current.n, title: pr.current.name, ...explain(pr.current, S, sm, ed) } : null,
    upside: { perDayUpperBound: sm.perDayUpperBound, minutesToProjection: sm.minutesToProjection, episodes: sm.episodes, scans: sm.scans },
  };
}
// The same view, condensed for the pinned phone notification: headline, progress bar, blocker, time, best quote now.
function phoneStatus(S) {
  const m = view(S);
  const n = 12, f = Math.round(m.progress * n);
  const best = S.res && S.res.candidates && S.res.candidates[0];
  const title = m.making ? `Chronos · PROFITING · ${fmt$(m.realizedNetUsd)} net after gas` : `Chronos · not profiting yet · stage ${m.stageN} of 7`;
  const lines = [`${'━'.repeat(f)}${'─'.repeat(n - f)} ${m.making ? 7 : m.stageN - 1}/7 · ${m.blocker ? m.blocker.title : 'verified from receipts'}`];
  if (m.blocker) lines.push(`time: ${m.blocker.eta}`);
  if (best) lines.push(`best quote now ${fmt$(best.netUsd)} net · ${S.res.approved} passed · block ${S.res.blockNumber}`);
  if (S.mode) lines.push(require('./mode.cjs').summary(S.mode));
  lines.push(S.paused ? 'engine PAUSED · Resume button, or p in the dashboard' : S.mode && S.mode.mode === 'LIVE' ? 'engine running · LIVE: every send re-simulated first' : 'engine running · shadow: nothing is sent'); // Android shows the time
  return { title, text: lines.join('\n') };
}
module.exports = { view, explain, rejectionMix, fmt$, phoneStatus };
