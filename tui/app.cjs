'use strict';
// Chronos console: a full-screen terminal dashboard over the read-only scanner.
// Every number on screen comes from the chain, your .env, or files in your workspace. Nothing is ever sent.
const fs = require('fs');
const path = require('path');
const A = require('./ansi.cjs');
const W = require('./widgets.cjs');
const { T, paint } = A;
const { loadConfig, parseEnvFile } = require('../lib/config.cjs');
const live = require('../lib/live.cjs');
const { runScan, jsonSafe } = require('../lib/scan.cjs');
const { Session } = require('../lib/session.cjs');
const pol = require('../lib/policies.cjs');
const sys = require('../lib/system.cjs');
const { auditRegistry } = require('../lib/audit.cjs');
const { readRecord } = require('../lib/record.cjs');
const { redact, clean } = require('../lib/safety.cjs');
const integrity = require('../lib/integrity.cjs');
const history = require('../lib/history.cjs');
const HEALTH = require('../lib/health.cjs');
const PROFIT = require('../lib/profit.cjs');
const MONEY = require('../lib/money.cjs');
const LS = require('../lib/livestate.cjs');
const SVC = require('../lib/service.cjs');
const RZ = require('../lib/realized.cjs');
const C = require('../lib/chain.cjs');
const { onPath } = require('../lib/notify.cjs');
const { readThresholds } = require('../lib/thresholds.cjs');

const TABS = ['Overview', 'Routes', 'Visuals', 'Measure', 'Policies', 'System'];
const STEPS = [['integrity', 'Code integrity (SEAL.json)'], ['config', 'Settings (.env)'], ['rpc', 'Arbitrum One node'], ['aave', 'Aave reserves and flash premium'], ['venues', 'Venues verified on-chain'], ['discover', 'Pool discovery'], ['scan', 'First scan']];
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const DATA = live.DATA;

function createState() {
  return {
    phase: 'boot', steps: Object.fromEntries(STEPS.map(([k]) => [k, { status: 'wait', detail: '' }])),
    tab: 0, sel: 0, scroll: [0, 0, 0, 0, 0, 0], detail: false, help: false, paused: false,
    scanning: false, scanStart: 0, nextAt: 0, res: null, deps: null, history: [], session: new Session(),
    error: null, problems: [], blockTitle: 'Setup needed', blockIntro: 'These settings are missing or invalid in your .env:', blockFix: 'Copy the lines you need from .env.scanner.example into your .env, save, then press r.', integrity: null, toast: null, toastAt: 0, frame: 0, audit: null, auditing: false,
    consecutiveErrors: 0, lastQuotes: null, lastScanAt: 0, historyRejected: 0, policyFails: [], healthSeen: new Set(), smoothSince: 0,
    nodes: null, services: null, eco: [], record: null, envFile: null, cfg: null, st: null, thresholds: {}, interval: 20,
  };
}

// ------------------------------------------------------------------ helpers
const ago = (ms) => (ms < 1000 ? 'now' : ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
const shortVenue = (id) => String(id).split(':').slice(0, 2).join(':');
const routeName = (c) => (c.legsCount > 2 && c.path && c.legs
  ? `${c.path.join(' → ')}  ${c.legs.map((l) => shortVenue(l.market)).join(' › ')}`
  : `${c.borrowSymbol} → ${c.otherSymbol}  ${shortVenue(c.buyOn)} › ${shortVenue(c.sellOn)}`);
// Only opportunities that passed every guardrail (net-positive after flash fee and gas, flash-loanable asset,
// venues your contract can execute) are listed anywhere; the rest are counted, never shown as opportunities.
const profitable = (r) => (r && r.candidates ? r.candidates.filter((c) => c.approved) : []);
function shortReason(c) {
  if (c.shadow) return c.shadow.win ? W.tag('SHADOW ✓', T.green) : paint(c.shadow.stage === 'preflight' ? 'needs setup' : 'sim failed', { fg: T.amber });
  if (c.approved) return W.tag('APPROVED', T.green);
  const r = c.reasons[0] || '';
  const map = [[/STANDBY_GAS_WAIT/, 'gas gate'], [/NOT_EXECUTABLE/, 'no adapter'], [/below floor/, 'below floor'], [/impact/, 'impact cap'], [/flash-loanable/, 'not flashable'], [/liquidity/, 'aave liquidity']];
  const hit = map.find(([re]) => re.test(r));
  return paint(hit ? hit[1] : 'rejected', { fg: hit && hit[1] === 'gas gate' ? T.amber : T.dim });
}
const fmtUsd = (n, d = 0) => (Number.isFinite(n) ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const label = (s) => paint(s, { fg: T.dim });
const prettyRoute = (k) => { const [pair, b, s2] = k.split('|'); return `${pair.replace('>', ' → ')}  ${shortVenue(b)} › ${shortVenue(s2)}`; };
const value = (s) => paint(s, { fg: T.ink, bold: true });

// ------------------------------------------------------------------ chrome
function statusPill(S) {
  const spin = SPIN[S.frame % SPIN.length];
  if (S.phase === 'boot') return paint(spin + ' ', { fg: T.blue }) + W.pill('STARTING', T.blue);
  if (S.phase === 'blocked') return W.pill(S.integrity && !S.integrity.ok ? 'INTEGRITY FAIL' : 'SETUP NEEDED', T.red);
  if (S.phase === 'error' || S.error) return W.pill('NODE ERROR', T.red);
  if (S.paused) return W.pill('PAUSED', T.amber);
  if (S.scanning) return paint(spin + ' ', { fg: T.gold }) + W.pill(S.view === 'follow' ? 'ENGINE SCANNING' : 'SCANNING', T.gold);
  if (S.view === 'follow' && !S.followProblem) return W.pill('ENGINE LIVE', T.green);
  if (S.res && S.res.status === 'STANDBY_GAS_WAIT') return W.pill('STANDBY · GAS', T.amber);
  return W.pill('WATCHING', T.green);
}

function header(S, w) {
  const left = paint(' ◆ CHRONOS', { fg: T.gold, bold: true }) + (w >= 70 ? paint(`  console · Arbitrum One · ${S.mode && S.mode.mode === 'LIVE' ? 'LIVE: sending profitable trades' : 'shadow: nothing is sent'}`, { fg: S.mode && S.mode.mode === 'LIVE' ? T.green : T.dim }) : '');
  const blk = S.res ? paint(`#${S.res.blockNumber}`, { fg: T.text }) : '';
  const clock = paint(new Date().toLocaleTimeString('en-US', { hour12: false }), { fg: T.dim });
  const upd = S.update ? paint(`v${S.update.version} available: chronos update`, { fg: T.amber, bold: true }) + '  ' : '';
  const right = (w >= 90 ? upd : '') + statusPill(S) + (w >= 56 && blk ? '  ' + blk : '') + (w >= 64 ? '  ' + clock : '') + ' ';
  return left + ' '.repeat(Math.max(1, w - A.vlen(left) - A.vlen(right))) + right;
}

function tabsLine(S, w) {
  const full = TABS.map((t, i) => (i === S.tab ? paint(` ${i + 1} ${t} `, { fg: '#0E1114', bg: T.gold, bold: true }) : paint(` ${i + 1} ${t} `, { fg: T.dim }))).join('');
  if (A.vlen(full) <= w - 1) return ' ' + full;
  return ' ' + TABS.map((t, i) => (i === S.tab ? paint(` ${i + 1} ${t} `, { fg: '#0E1114', bg: T.gold, bold: true }) : paint(` ${i + 1} `, { fg: T.dim }))).join('');
}

function footer(S, w) {
  const keys = S.tab === 1 ? '↑↓ select · enter details · s save' : '↑↓ scroll';
  let hint = `1-6 tabs · ${keys} · e setup · r rescan · p pause · ? help · q quit`;
  if (S.phase === 'blocked' || S.phase === 'error') hint = 'e guided setup · r retry · q quit';
  let right = '';
  if (S.toast && Date.now() - S.toastAt < 6000) right = paint(S.toast, { fg: T.gold });
  else if (S.phase === 'running' && !S.scanning && !S.paused) right = paint(`next scan ${ago(Math.max(0, S.nextAt - Date.now()))}`, { fg: T.dim });
  w -= 1;
  const l = paint(' ' + hint, { fg: T.faint });
  if (A.vlen(l) + A.vlen(right) + 2 > w) return A.vlen(right) ? ' ' + A.truncate(right, w - 2) : A.truncate(l, w);
  return l + ' '.repeat(w - A.vlen(l) - A.vlen(right) - 1) + right;
}

// ------------------------------------------------------------------ boot screen
function bootScreen(S, w, h) {
  const out = ['', A.center(paint('◆  C H R O N O S', { fg: T.gold, bold: true }), w), A.center(paint('flash-loan opportunity console · Arbitrum One', { fg: T.dim }), w), ''];
  const bw = Math.min(w - 2, 72);
  const lines = STEPS.map(([k, name]) => {
    const s = S.steps[k];
    const icon = s.status === 'ok' ? paint('✓', { fg: T.green, bold: true }) : s.status === 'fail' ? paint('✗', { fg: T.red, bold: true }) : s.status === 'run' ? paint(SPIN[S.frame % SPIN.length], { fg: T.gold }) : paint('·', { fg: T.faint });
    return `${icon}  ${paint(name, { fg: s.status === 'wait' ? T.dim : T.ink })}${s.detail ? paint('  ' + s.detail, { fg: T.dim }) : ''}`;
  });
  const doneN = STEPS.filter(([k]) => S.steps[k].status === 'ok').length;
  const secs = S.bootStartedAt ? ((Date.now() - S.bootStartedAt) / 1000).toFixed(1) : '0.0';
  lines.push('', W.meter(doneN, STEPS.length, bw - 24, { invert: true }) + paint(`  ${doneN}/${STEPS.length} · ${secs} s`, { fg: T.dim }));
  W.box('Starting up', lines, bw).forEach((l) => out.push(A.center(l, w)));
  if (S.phase === 'blocked') {
    const pl = [...A.wrap(S.blockIntro, bw - 4).map((x) => paint(x, { fg: T.ink })), ''];
    for (const p of S.problems) A.wrap('✗ ' + p, bw - 6).forEach((x, i) => pl.push(i ? '  ' + x : paint(x, { fg: T.red })));
    pl.push('', ...A.wrap(`.env used: ${S.envFile || 'none found'}`, bw - 4).map((x) => paint(x, { fg: T.dim })), ...A.wrap(S.blockFix, bw - 4).map((x) => paint(x, { fg: T.gold })));
    out.push('');
    W.box(S.blockTitle, pl, bw, { accent: T.red }).forEach((l) => out.push(A.center(l, w)));
  }
  if (S.phase === 'error') {
    out.push('');
    W.box('Could not start', A.wrap(S.error || 'unknown error', bw - 4).map((x) => paint(x, { fg: T.red })).concat(['', paint('Nothing was sent. Check the node (System → Nodes) and press r to retry.', { fg: T.dim })]), bw, { accent: T.red }).forEach((l) => out.push(A.center(l, w)));
  }
  return out.slice(0, h);
}

// ------------------------------------------------------------------ overview
function cards(S, w) {
  const across = w >= 100 ? 4 : w >= 56 ? 2 : 1;
  const cw = Math.floor((w - (across - 1)) / across);
  const iw = cw - 4;
  const r = S.res; const H = S.history;
  const cfg = S.cfg || {};
  const gas = r ? r.gasGwei : null;
  const pr = profitable(r);
  const best = pr.length ? pr[0].netUsd : null;
  const sum = S.session.summary(S.thresholds);
  const waiting = paint('waiting for first scan', { fg: T.faint });
  const c = [
    W.box('GAS', [
      gas === null ? waiting : value(gas.toFixed(4)) + label(' gwei'),
      W.meter(gas, cfg.GAS_CEILING_GWEI, Math.max(4, iw - 11)) + label(` max ${cfg.GAS_CEILING_GWEI}`),
      W.sparkline(H.map((x) => x.gas), iw, T.blue),
    ], cw),
    W.box('BEST OPPORTUNITY', [
      best === null ? (r ? label('none profitable now') : waiting) : W.money(best) + label(' net'),
      pr.length ? A.truncate(paint(routeName(pr[0]), { fg: T.text }), iw) : label(r ? `${r.candidates.length} routes checked` : ''),
      W.sparkline(H.map((x) => x.best), iw, T.green),
    ], cw),
    W.box('APPROVED', [
      r ? paint(String(r.approved), { fg: r.approved ? T.green : T.ink, bold: true }) + label(` of ${r.optimised} checked`) : waiting,
      label(`${sum.episodes} episode${sum.episodes === 1 ? '' : 's'} so far`),
      W.sparkline(H.map((x) => x.approved), iw, T.gold),
    ], cw),
    W.box('ENGINE', [
      S.scanning ? paint(`scanning ${S.progress && S.progress.total ? Math.round((100 * S.progress.done) / S.progress.total) + '%' : '…'}`, { fg: T.gold }) + label(S.progress ? (S.progress.phase === 'screen' ? ' · routes' : ' · sizing') : '') : r ? value(`scan #${sum.scans}`) + label(` · ${(r.tookMs / 1000).toFixed(1)} s`) : waiting,
      S.scanning && S.progress && S.progress.total ? W.meter(S.progress.done, S.progress.total, iw, { invert: true }) : r ? label(`${r.marketsFound} pools · ${r.routesEnumerated} routes`) : label(''),
      W.sparkline(H.map((x) => x.ms), iw, T.dim),
    ], cw),
  ];
  const rows = [];
  for (let i = 0; i < c.length; i += across) rows.push(...W.hjoin(c.slice(i, i + across), 1));
  return rows;
}

function routesCompact(S, w, maxRows) {
  const r = S.res;
  const cols = w >= 70 ? [{ label: 'ROUTE' }, { label: 'SIZE', w: 9, align: 'right' }, { label: 'NET', w: 10, align: 'right' }, { label: 'STATUS', w: 13 }]
    : [{ label: 'ROUTE' }, { label: 'NET', w: 9, align: 'right' }, { label: 'STATUS', w: 11 }];
  let lines;
  if (!r) lines = [label('Waiting for the first scan. Quotes come straight from the chain; nothing is estimated.')];
  else if (!profitable(r).length) lines = A.wrap(`No profitable, flash-loanable opportunity at block ${r.blockNumber}. ${r.candidates.length} route(s) checked; unprofitable ones are not shown. The money panel above says what the closest one is missing.`, w - 4).map((x) => label(x));
  else {
    const rows = profitable(r).map((c) => (w >= 70 ? [routeName(c), fmtUsd(c.amountUsd), W.money(c.netUsd), shortReason(c)] : [routeName(c), W.money(c.netUsd), shortReason(c)]));
    lines = W.table(cols, rows, w - 4, { maxRows });
  }
  return W.box(`OPPORTUNITIES · ${r ? profitable(r).length : 0}`, lines, w, { right: r ? label(`block ${r.blockNumber}`) : '' });
}

function verdictBox(S, w) {
  const sm = S.session.summary(S.thresholds); const t = S.thresholds;
  const iw = w - 4; const mw = Math.max(8, Math.min(30, iw - 34));
  const row = (name, v, goal, fmt) => padRow(label(name), W.meter(v, goal, mw, { invert: true }) + '  ' + paint(`${fmt(v)} / ${Number.isFinite(goal) ? fmt(goal) : 'unset'}`, { fg: T.text }), iw);
  const vcol = sm.verdict === 'GO TO SHADOW TEST' ? T.green : sm.verdict === 'WAITING' || sm.verdict === 'MEASURING' ? T.blue : sm.verdict === 'NO THRESHOLDS' ? T.amber : T.red;
  const desc = sm.verdict === 'GO TO SHADOW TEST' ? 'worth a shadow test, not live capital' : sm.verdict === 'MEASURING' ? `collecting data · a verdict needs ${Math.ceil(sm.minutesToProjection)} more min` : sm.verdict === 'NO-GO' && !sm.episodes ? 'nothing net-positive yet' : '';
  const head = W.pill(sm.verdict, vcol) + '  ';
  const hw = A.vlen(head);
  const top = desc ? A.wrap(desc, Math.max(12, iw - hw)).map((x, i) => (i === 0 ? head : ' '.repeat(hw)) + label(x)) : [W.pill(sm.verdict, vcol)];
  const wait = Math.ceil(sm.minutesToProjection);
  return W.box('GO / NO-GO', [
    ...top,
    row('episodes', sm.episodes, t.GO_MIN_EPISODES, (x) => String(Math.round(x))),
    row('distinct blocks', sm.distinctBlocks, t.GO_MIN_DISTINCT_BLOCKS, (x) => String(Math.round(x))),
    sm.perDayUpperBound === null ? padRow(label('$/day (upper bound)'), label(iw - 22 >= 42 ? `needs ${wait} more min of data before projecting` : `after ${wait} more min`), iw)
      : row('$/day (upper bound)', sm.perDayUpperBound, t.GO_MIN_USD_PER_DAY, (x) => '$' + x.toFixed(2)),
  ], w);
}
function padRow(l, r, w) { return A.padEnd(l, 22) + A.truncate(r, Math.max(0, w - 22)); }

function profitBox(S, w) {
  const pr = PROFIT.evaluate(S);
  const iw = w - 4;
  const L = [];
  for (const s of pr.stages) {
    const mark = s.met ? paint('✓ ', { fg: T.green, bold: true }) : s === pr.current ? paint('▸ ', { fg: T.red, bold: true }) : paint('○ ', { fg: T.faint });
    const st = { fg: s.met ? T.text : s === pr.current ? T.ink : T.dim, bold: s === pr.current };
    A.wrap(s.name, iw - 5).forEach((x, i) => L.push((i === 0 ? mark + paint(`${s.n}  `, st) : '     ') + paint(x, st)));
  }
  if (pr.current) A.wrap('next: ' + pr.current.next, iw - 3).forEach((x) => L.push('   ' + paint(x, { fg: T.gold })));
  const rz = S.realized;
  const n = rz && rz.executions ? rz.executions.length : 0;
  const rtxt = !rz ? 'checking…' : !rz.contract ? 'no contract address set, so nothing can be verified' : n ? `net after gas · ${n} verified execution${n === 1 ? '' : 's'}` : 'no verified executions (receipts only)';
  const rhead = '   ' + label('realized: ') + (n ? W.money(rz.totalNetUsd) + ' ' : '');
  const rw = A.vlen(rhead);
  A.wrap(rtxt, Math.max(12, iw - rw)).forEach((x, i) => L.push((i === 0 ? rhead : ' '.repeat(rw)) + label(x)));
  return W.box('PATH TO PROFIT', L, w, { accent: pr.profiting ? T.green : T.red, right: pr.profiting ? paint('PROFITING', { fg: T.green, bold: true }) : paint(`stage ${pr.current.n} of 7`, { fg: T.red, bold: true }) });
}

/** The first thing on screen: are we making money, what blocks it, how to fix it, how long it should take. */
function moneyBox(S, w, { full = false } = {}) {
  const m = MONEY.view(S);
  const iw = w - 4;
  const lw = iw >= 60 ? 16 : 15;
  const L = [];
  const yes = m.making;
  // a label (and pill) followed by text that wraps under itself on a narrow screen instead of being cut off
  const after = (head, text, fn) => { const hw = A.vlen(head); A.wrap(text, Math.max(12, iw - hw)).forEach((x, i) => L.push((i === 0 ? head : ' '.repeat(hw)) + fn(x))); };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (yes) after(A.padEnd(label('Making money?'), lw) + W.pill('YES', T.green) + '  ' + W.money(m.realizedNetUsd) + ' ', `net after gas · ${plural(m.verifiedExecutions, 'verified execution', 'verified executions')}`, label);
  else {
    const rz = S.realized; const n = rz && rz.executions ? rz.executions.length : 0;
    after(A.padEnd(label('Making money?'), lw) + W.pill('NO', T.red) + '  ', !rz ? 'receipts not checked yet' : !rz.contract ? 'no contract address set, so no profit can be verified'
      : !n ? 'no Arbitrage receipts from your contract yet' : `${plural(n, 'verified execution', 'verified executions')}, net after gas ${MONEY.fmt$(rz.totalNetUsd)}: losing money`, label);
  }
  const bw = Math.max(10, iw - lw - 12);
  L.push(A.padEnd(label('Path to profit'), lw) + W.meter(m.stageN - (yes ? 0 : 1), 7, bw, { invert: true }) + paint(`  ${yes ? 7 : m.stageN - 1}/7 done`, { fg: T.text }));
  if (m.blocker) {
    after(A.padEnd(label('Blocking now'), lw), `${m.blocker.n} · ${m.blocker.title}`, (x) => paint(x, { fg: T.ink, bold: true }));
    const cap = full ? 99 : 2;
    const sect = (name, arr, col) => arr.slice(0, cap).forEach((t, i) => A.wrap(t, iw - 8).forEach((x, k) => L.push((i === 0 && k === 0 ? paint(A.padEnd('  ' + name, 8), { fg: col, bold: true }) : '        ') + paint(x, { fg: T.text }))));
    sect('why', m.blocker.why, T.amber);
    sect('fix', m.blocker.fix, T.green);
    sect('time', [m.blocker.eta], T.blue);
  }
  const up = m.upside;
  const seen = ` · ${plural(up.episodes, 'opportunity', 'opportunities')} in ${plural(up.scans, 'scan', 'scans')}`;
  if (up.perDayUpperBound === null) after(A.padEnd(label('Upside'), lw), `$/day shown after ${Math.ceil(up.minutesToProjection)} more min of data${seen}`, label);
  else after(A.padEnd(label('Upside'), lw) + W.money(up.perDayUpperBound), `/day upper bound (zero competition)${seen}`, label);
  return W.box('MONEY', L, w, { accent: yes ? T.green : T.red, right: yes ? paint('PROFITING', { fg: T.green, bold: true }) : paint(`stage ${m.stageN} of 7`, { fg: T.red, bold: true }) });
}

/** Shadow ↔ live: the current mode and exactly which conditions the next automatic switch is waiting for. */
function modeBox(S, w, { full = false } = {}) {
  const m = S.mode; const iw = w - 4;
  if (!m) return W.box('MODE', A.wrap('Shadow test and live execution run in the 24/7 engine (start it: chronos service install). This window only scans.', iw).map((x) => label(x)), w);
  const L = [];
  if (m.starting) return W.box('MODE', A.wrap('SHADOW · the engine is starting: it reads Arbitrum One (Aave, venues, pools) before its first scan. Nothing is sent. The switch-to-live rules appear after that scan.', iw).map((x) => label(x)), w);
  const live = m.mode === 'LIVE';
  const head = W.pill(m.mode, live ? T.green : T.blue) + '  '; const hw = A.vlen(head);
  const desc = live ? 'sending profitable trades · shadow keeps simulating every opportunity' : m.heldUntil ? `held until ${new Date(m.heldUntil).toISOString().slice(11, 16)} UTC after: ${m.heldWhy}` : 'simulating every approved opportunity with your contract · nothing is sent';
  A.wrap(desc, Math.max(12, iw - hw)).forEach((x, i) => L.push((i === 0 ? head : ' '.repeat(hw)) + label(x)));
  const $ = (v) => (v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`);
  const fmt = (c, v) => (v === null || v === undefined ? '—' : typeof v === 'string' ? v : /rate/.test(c.name) ? `${Math.round(v * 100)}%` : /\$|net|gas lost/.test(c.name) ? $(v) : /balance/.test(c.name) ? `${(+v).toFixed(4)} ETH` : String(v));
  const lw = iw >= 70 ? 24 : 20;
  const mw = Math.max(6, Math.min(20, iw - lw - 20));
  if (!live) {
    L.push(label('switches to LIVE when all are met:'));
    for (const c of m.promote || []) {
      const mark = c.met ? paint('✓ ', { fg: T.green, bold: true }) : paint('○ ', { fg: T.faint });
      const bar = c.frac !== undefined ? W.meter(c.frac, 1, mw, { invert: true }) + ' ' : '';
      const val = c.name === 'executor ready' ? (c.met ? 'yes' : String(c.have)) : `${fmt(c, c.have)} / ${fmt(c, c.need)}`;
      L.push(mark + A.padEnd(label(c.name), lw) + bar + paint(A.truncate(val, Math.max(8, iw - lw - (bar ? mw + 1 : 0) - 2)), { fg: c.met ? T.text : T.ink }));
    }
  } else {
    L.push(label('switches back to SHADOW if any of these happens:'));
    for (const d of m.demote || []) L.push((d.bad ? paint('✗ ', { fg: T.red, bold: true }) : paint('✓ ', { fg: T.green })) + A.padEnd(label(d.name), lw) + paint(`${fmt(d, d.have)} · limit ${d.need}`, { fg: T.text }));
  }
  const sh = S.shadowStats; const t = m.today || {};
  const wrapAfter = (head, text) => { const hw = A.vlen(head); A.wrap(text, Math.max(12, iw - hw)).forEach((x, i) => L.push((i === 0 ? head : ' '.repeat(hw)) + label(x))); };
  wrapAfter(A.padEnd(label('simulated'), 12) + (sh && sh.perDayUsd !== null ? W.money(sh.perDayUsd) : ''), `${sh && sh.perDayUsd !== null ? '/day' : '$/day after 10 min'} · ${sh ? sh.wins : 0} win(s) in ${sh ? sh.sims : 0} simulation(s), 24 h`);
  wrapAfter(A.padEnd(label('realized'), 12) + W.money(t.netUsd || 0) + ' ', `today · ${t.sent || 0} sent · ${t.reverted || 0} reverted · gas ${$(t.gasUsd || 0)}`);
  const x = S.execInfo;
  if (x) A.wrap(`executor ${x.address ? x.address.slice(0, 8) + '…' + x.address.slice(-4) : '—'} · ${x.ready ? `ready · ${(+x.gasEth).toFixed(4)} ETH for gas` : x.why || 'not ready'}`, iw).forEach((y) => L.push(label(y)));
  if (full && S.shadowRuns && S.shadowRuns.length) {
    L.push(''); L.push(label('last shadow runs'));
    for (const r of S.shadowRuns.slice(-6).reverse()) L.push(label(`  ${new Date(r.at).toLocaleTimeString('en-US', { hour12: false })} `) + (r.win ? paint(`✓ ${$(r.netUsd)} net`, { fg: T.green }) : paint(A.truncate(r.stage === 'preflight' ? `✗ needs: ${(r.failed || []).map((f) => f.name).join(', ') || r.error}` : `✗ ${r.error || 'below floor ' + $(r.netUsd)}`, iw - 12), { fg: T.amber })));
  }
  return W.box('MODE · shadow ↔ live', L, w, { accent: live ? T.green : T.blue, right: live ? paint('LIVE', { fg: T.green, bold: true }) : label('automatic') });
}

/** Balances that a second, independent source confirmed; anything unconfirmed has no number. */
function balancesBox(S, w) {
  const b = S.balances; const iw = w - 4;
  if (!b) return [];
  const L = [];
  const amt = (v) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v >= 1 ? v.toFixed(4) : v.toPrecision(4));
  for (const r of b.rows) {
    const ok = [...(r.eth.verified ? [`${amt(r.eth.amount)} ETH`] : []), ...r.tokens.filter((t) => t.verified).map((t) => `${amt(t.amount)} ${t.symbol}`)];
    const notYet = (r.eth.verified ? 0 : 1) + r.tokens.filter((t) => !t.verified).length;
    const parts = ok.length ? [...ok, ...(notYet ? [`${notYet} unverified (not shown)`] : [])] : ['not verified yet (no number shown)'];
    A.wrap(parts.join(' · '), Math.max(12, iw - 18)).forEach((x, i) => L.push((i === 0 ? A.padEnd(label(r.label), 18) : ' '.repeat(18)) + paint(x, { fg: /unverified/.test(x) ? T.amber : T.text })));
  }
  if (!b.rows.length) L.push(label(b.why || 'no addresses to check'));
  A.wrap(b.source ? `✓ verified against ${b.source} · block ${b.block}` : `not verified: ${b.why}`, iw).forEach((x) => L.push(label(x)));
  return W.box('BALANCES · on-chain, verified', L, w);
}

function compactCards(S, w) {
  const r = S.res; const cfg = S.cfg || {};
  const sum = S.session.summary(S.thresholds);
  const iw = w - 4;
  return W.box('LIVE', [
    label('gas    ') + (r ? value(r.gasGwei.toFixed(4)) + label(` / ${cfg.GAS_CEILING_GWEI} gwei`) : label('—')),
    label('best   ') + (profitable(r).length ? W.money(profitable(r)[0].netUsd) + ' ' + A.truncate(paint(routeName(profitable(r)[0]), { fg: T.text }), iw - 18) : label(r ? 'none profitable now' : '—')),
    label('passed ') + (r ? value(String(r.approved)) + label(` of ${r.optimised} · ${sum.episodes} episode${sum.episodes === 1 ? '' : 's'}`) : label('—')),
    label('engine ') + (S.scanning && S.progress && S.progress.total ? W.meter(S.progress.done, S.progress.total, Math.max(6, iw - 14), { invert: true }) + label(` ${Math.round((100 * S.progress.done) / S.progress.total)}%`) : r ? value(`scan #${sum.scans}`) + label(` · ${(r.tookMs / 1000).toFixed(1)} s`) : label('starting')),
  ], w);
}

function overview(S, w, h) {
  const out = [...moneyBox(S, w), ...modeBox(S, w)];
  out.push(...(w >= 70 ? cards(S, w) : compactCards(S, w)));
  out.push(...balancesBox(S, w));
  const rest = h - out.length;
  const vb = verdictBox(S, w);
  const routesRows = Math.max(1, rest - vb.length - 3);
  if (rest > 6) out.push(...routesCompact(S, w, Math.min(8, routesRows)));
  if (h - out.length >= vb.length) out.push(...vb);
  const left = h - out.length;
  if (left >= 5 && S.history.length) {
    const hs = S.history.slice(-(left - 3)).reverse();
    const cols = w >= 70 ? [{ label: 'TIME', w: 8 }, { label: 'BLOCK', w: 10, align: 'right' }, { label: 'GAS GWEI', w: 9, align: 'right' }, { label: 'BEST NET', w: 10, align: 'right' }, { label: 'APPROVED', w: 9, align: 'right' }, { label: 'QUOTES', w: 7, align: 'right' }, { label: 'TOOK' }]
      : [{ label: 'TIME', w: 8 }, { label: 'BEST', w: 9, align: 'right' }, { label: 'OK', w: 3, align: 'right' }, { label: 'GAS' }];
    const rows = hs.map((x) => (w >= 70 ? [new Date(x.t).toLocaleTimeString('en-US', { hour12: false }), String(x.block), Number(x.gas).toFixed(4), W.money(x.best), String(x.approved), String(x.quotes), label(`${(x.ms / 1000).toFixed(1)} s`)]
      : [new Date(x.t).toLocaleTimeString('en-US', { hour12: false }), W.money(x.best), String(x.approved), Number(x.gas).toFixed(4)]));
    out.push(...W.box('RECENT SCANS', W.table(cols, rows, w - 4), w));
  }
  return out;
}

// ------------------------------------------------------------------ routes
function routeDetail(S, c, w) {
  const cfg = S.cfg || {};
  const iw = w - 4;
  const L = [];
  L.push(value(routeName(c)));
  L.push('');
  L.push(label('borrow   ') + paint(`${fmtUsd(c.amountUsd, 2)} of ${c.borrowSymbol} from Aave V3`, { fg: T.text }));
  if (c.legs && c.legsCount > 2) {
    c.legs.forEach((l, i) => L.push(label(`leg ${i + 1}    `) + paint(`${l.from} → ${l.to} on ${shortVenue(l.market)}`, { fg: T.text }) + label(`  impact ${l.impactBps ?? '—'} bps`)));
    L.push(label('impact   ') + label(`cap ${cfg.MAX_SLIPPAGE_BPS} bps per leg`));
  } else {
    L.push(label('leg 1    ') + paint(`buy ${c.otherSymbol} on ${shortVenue(c.buyOn)}`, { fg: T.text }));
    L.push(label('leg 2    ') + paint(`sell back to ${c.borrowSymbol} on ${shortVenue(c.sellOn)}`, { fg: T.text }));
    L.push(label('impact   ') + paint(`${c.impact1 ?? '—'} bps / ${c.impact2 ?? '—'} bps`, { fg: T.text }) + label(`  (cap ${cfg.MAX_SLIPPAGE_BPS} bps per leg)`));
  }
  if (c.flip) L.push(label('found by ') + paint(`flip (${c.flip.startsWith('borrow') ? 'other borrow token' : 'other direction'})`, { fg: T.text }));
  if (c.spotEdgeBps !== null && c.spotEdgeBps !== undefined) L.push(label('price edge') + ' ' + paint(`${c.spotEdgeBps} bps above break-even before size`, { fg: T.text }));
  if (c.alt) L.push(label('Balancer ') + paint(`fee ${c.alt.feeBps} bps → net ${c.alt.netUsd.toFixed(4)} (needs your contract to borrow from Balancer: your approval)`, { fg: T.text }));
  L.push('');
  L.push(label('gross    ') + W.money(c.grossUsd, { digits: 4 }));
  L.push(label('flash fee') + ' ' + W.money(-c.premiumUsd, { digits: 4 }));
  L.push(label('gas      ') + W.money(-c.gasUsdAssumed, { digits: 4 }) + label(`  ${Math.round((cfg.GAS_UNITS_ASSUMED * (c.legsCount || 2)) / 2)} units × live price${(c.legsCount || 2) > 2 ? ' (scaled per leg; shadow measures it)' : ''}`));
  L.push(label('net      ') + W.money(c.netUsd, { digits: 4 }));
  L.push('');
  L.push(paint('Guardrails', { fg: T.gold, bold: true }));
  const checks = [['flash-loanable on Aave', /flash-loanable/], [`gas ≤ ${cfg.GAS_CEILING_GWEI} gwei`, /STANDBY_GAS_WAIT/], ['both venues executable by your contract', /NOT_EXECUTABLE/], [`net ≥ $${cfg.MIN_NET_PROFIT_USD}`, /below floor/], [`impact ≤ ${cfg.MAX_SLIPPAGE_BPS} bps per leg`, /impact/], ['within Aave available liquidity', /liquidity/]];
  for (const [name, re] of checks) {
    const bad = c.reasons.find((x) => re.test(x));
    L.push((bad ? paint('✗ ', { fg: T.red, bold: true }) : paint('✓ ', { fg: T.green, bold: true })) + paint(name, { fg: bad ? T.ink : T.text }));
    if (bad) A.wrap(bad, iw - 4).forEach((x) => L.push('    ' + label(x)));
  }
  L.push('');
  if (c.runParams) {
    L.push(paint('Contract call it would make (NOT sent)', { fg: T.gold, bold: true }));
    JSON.stringify(c.runParams, null, 2).split('\n').forEach((x) => { for (let i = 0; i < x.length; i += iw) L.push(paint(x.slice(i, i + iw), { fg: T.text })); });
  } else L.push(label('No contract call is prepared: at least one guardrail failed.'));
  L.push('', label(`Quote at block ${S.res ? S.res.blockNumber : '—'}. Press s to save this route to data/routes/.`));
  return L;
}

function routes(S, w, h) {
  const r = S.res;
  const list = profitable(r);
  if (!list.length) return routesCompact(S, w, h - 3);
  S.sel = Math.max(0, Math.min(S.sel, list.length - 1));
  const split = S.detail && w >= 110;
  const tw = split ? Math.floor(w * 0.52) : w;
  const wide = tw >= 96;
  const cols = wide ? [{ label: '#', w: 3, align: 'right' }, { label: 'ROUTE' }, { label: 'SIZE', w: 9, align: 'right' }, { label: 'GROSS', w: 9, align: 'right' }, { label: 'FLASH', w: 8, align: 'right' }, { label: 'GAS', w: 7, align: 'right' }, { label: 'NET', w: 10, align: 'right' }, { label: 'IMPACT', w: 9, align: 'right' }, { label: 'STATUS', w: 13 }]
    : [{ label: 'ROUTE' }, { label: 'NET', w: 9, align: 'right' }, { label: 'STATUS', w: 11 }];
  const rows = list.map((c, i) => (wide ? [String(i + 1), routeName(c), fmtUsd(c.amountUsd), W.money(c.grossUsd), W.money(-c.premiumUsd), W.money(-c.gasUsdAssumed, { digits: 3 }), W.money(c.netUsd), `${c.impact1 ?? '—'}/${c.impact2 ?? '—'}`, shortReason(c)]
    : [routeName(c), W.money(c.netUsd), shortReason(c)]));
  const maxRows = h - 3;
  const offset = Math.max(0, Math.min(S.sel - Math.floor(maxRows / 2), list.length - maxRows));
  const tbl = W.box(`OPPORTUNITIES · ${list.length}`, W.table(cols, rows, tw - 4, { selected: S.sel, maxRows, offset }), tw, { right: label(`block ${r.blockNumber}`) });
  if (!S.detail) return tbl;
  const dw = split ? w - tw - 1 : w;
  const det = routeDetail(S, list[S.sel], dw);
  const maxD = h - 2;
  const dbox = W.box('DETAILS · esc to close', det.slice(S.scroll[1], S.scroll[1] + maxD), dw);
  return split ? W.hjoin([tbl, dbox], 1) : dbox;
}

// ------------------------------------------------------------------ measure
// ------------------------------------------------------------------ HD visuals (tab 3)
function visuals(S, w) {
  const HD = require('./hd.cjs');
  const H = S.history || []; const r = S.res; const I = (r && r.indicators) || {};
  const floor = S.cfg ? S.cfg.MIN_NET_PROFIT_USD : (I.breakEven && I.breakEven.minNetUsd) || null;
  const inner = w - 4; const out = [];
  const panel = (title, lines, right = '') => out.push(...W.box(title, lines, w, { right }), '');
  // P0: only real, on-chain data. Nothing is drawn before the first real scan; every screen says which Arbitrum One
  // block it comes from and how old it is; data older than three scan intervals is marked STALE in red.
  if (!r || !Number.isFinite(r.blockNumber) || !S.lastScanAt) return [paint('  No real scan yet. Charts appear after the engine\'s first scan of Arbitrum One; nothing is drawn before that.', { fg: T.dim })];
  const age = Date.now() - S.lastScanAt; const stale = age > staleMs({ interval: S.interval });
  out.push(...(stale
    ? [paint(` STALE · last real scan ${ago(age)} ago (block #${r.blockNumber}) `, { fg: '#0E1114', bg: T.red, bold: true }), paint(' nothing below is current · start the engine: chronos phone', { fg: T.red })]
    : [paint(' ● LIVE ', { fg: '#0E1114', bg: T.green, bold: true }) + paint(` Arbitrum One · block #${r.blockNumber}`, { fg: T.text }), paint(` scanned ${ago(age)} ago · real quotes only`, { fg: T.dim })]), '');
  // 1. best net per scan: area above/below zero, the profit floor dotted
  const best = H.map((x) => (Number.isFinite(x.best) ? x.best : null));
  const last = best.filter(Number.isFinite).slice(-1)[0];
  panel('Best route · net after every cost', [...HD.chart([{ values: best, color: (v) => (floor !== null && v >= floor ? T.green : v >= 0 ? T.amber : T.red), fill: 'zero' }], inner, 8, { unit: '$', hlines: floor !== null ? [{ value: floor, color: T.gold }, { value: 0, color: T.faint }] : [{ value: 0, color: T.faint }] }),
    paint('now ', { fg: T.dim }) + paint(Number.isFinite(last) ? HD.short(last, '$') : '—', { fg: Number.isFinite(last) && floor !== null && last >= floor ? T.green : Number.isFinite(last) && last >= 0 ? T.amber : T.red, bold: true }) + paint(` · floor ${floor !== null ? HD.short(floor, '$') : '—'} (gold) · ${H.length} scans`, { fg: T.dim })]);
  // 2. how far each filter holds routes back (routes it blocked, and the best net if only that filter were lifted)
  const bb = I.blockedBy || [];
  if (bb.length) {
    const top = Math.max(...bb.map((b) => b.routes)); const lw = Math.min(20, Math.max(...bb.map((b) => b.filter.length)));
    panel('What holds routes back · this scan', bb.slice(0, 6).map((b) => A.padEnd(paint(b.filter.slice(0, lw), { fg: T.text }), lw) + ' ' + HD.gauge(b.routes, top, Math.max(6, inner - lw - 22), ['#4A3A2A', T.amber, T.red]) + ' ' + A.padStart(paint(`${b.routes}`, { fg: T.ink }), 4) + paint(b.bestNetIfOnlyThis !== null ? ` → ${HD.short(b.bestNetIfOnlyThis, '$')}` : '', { fg: b.bestNetIfOnlyThis > 0 ? T.green : T.dim })));
  }
  // 3. spread heat over time: the widest price gaps between venues, per pair, scan by scan (two pairs per line)
  const pairs = []; for (const x of H.slice(-60)) for (const [p] of x.sp || []) if (!pairs.includes(p)) pairs.push(p);
  const rows = pairs.slice(0, 10).map((p) => ({ label: p, values: H.slice(-(inner - Math.min(24, Math.floor(inner / 2.4)) - 1)).map((x) => { const f = (x.sp || []).find((y) => y[0] === p); return f ? f[1] : null; }) }));
  if (rows.length) { const mx = Math.max(1, ...rows.flatMap((x) => x.values).filter(Number.isFinite)); panel('Price gap between venues · bps per scan', [...HD.heatmap(rows, inner, { max: mx, labelWidth: Math.min(24, Math.floor(inner / 2.4)) }), paint('cold ', { fg: T.dim }) + HD.gauge(1, 1, 16, HD.HEAT) + paint(` hot · max ${mx.toFixed(1)} bps`, { fg: T.dim })]); }
  // 4. the best route now, drawn token to token
  if (I.best && I.best.path) {
    const c = (r.candidates || [])[0];
    panel('Best route now', [...HD.route(I.best.path, c && c.legs ? c.legs.map((l) => l.market) : [], I.best.netUsd, floor, inner), paint(`size ${HD.short(I.best.amountUsd, '$')} · net ${HD.short(I.best.netUsd, '$')}${Number.isFinite(I.best.altNetUsd) ? ` · on the other lender ${HD.short(I.best.altNetUsd, '$')}` : ''}`, { fg: T.dim })]);
  }
  // 5. engine vitals: smooth gauges against their limits
  const be = I.breakEven || {}; const lastH = H[H.length - 1] || {};
  const g = (label, v, max, txt, stops) => A.padEnd(paint(label, { fg: T.text }), 14) + HD.gauge(v, max, Math.max(8, inner - 32), stops) + ' ' + paint(txt, { fg: T.dim });
  panel('Engine vitals', [
    g('scan time', lastH.ms, (S.interval || 20) * 1000, `${Number.isFinite(lastH.ms) ? (lastH.ms / 1000).toFixed(1) : '—'} s of ${S.interval || 20} s`, [T.green, T.amber, T.red]),
    g('gas price', be.gasGwei, be.gasCeilingGwei, `${Number.isFinite(be.gasGwei) ? be.gasGwei.toFixed(3) : '—'} / ${be.gasCeilingGwei ?? '—'} gwei`, [T.green, T.amber, T.red]),
    g('quote errors', lastH.fails, Math.max(1, lastH.quotes || 1), `${lastH.fails ?? '—'} of ${lastH.quotes ?? '—'}`, [T.green, T.amber, T.red]),
    g('near misses', I.cycles ? I.cycles.nearMiss10bps : null, Math.max(1, I.cycles ? I.cycles.pricesAllow + I.cycles.nearMiss10bps : 1), `${I.cycles ? I.cycles.nearMiss10bps : '—'} within 10 bps`, [T.faint, T.blue, T.green]),
  ]);
  // 6. scan speed and gas over time
  panel('Scan time (s) and gas (gwei) · per scan', [...HD.chart([{ values: H.map((x) => (Number.isFinite(x.ms) ? x.ms / 1000 : null)), color: T.blue }], inner, 4, { min: 0 }), ...HD.chart([{ values: H.map((x) => (Number.isFinite(x.gas) ? x.gas : null)), color: T.gold }], inner, 3, { min: 0, hlines: Number.isFinite(be.gasCeilingGwei) ? [{ value: be.gasCeilingGwei, color: T.red }] : [] })]);
  // 6b. the road to cash, as the VP verified it this cycle
  if (Array.isArray(S.road)) panel('Road to cash · verified by the VP', require('../lib/milestones.cjs').lines(S.road).map((l, i) => paint(l.slice(0, inner), { fg: i === 0 ? T.gold : /^  ✓/.test(l) ? T.green : /^  ▶/.test(l) ? T.text : T.dim })), '');
  // 6c. the 100 indicators and the price-direction model (the VP's measured view)
  if (S.indicators) panel('Indicators · 40 success / 32 failure', [...require('../lib/indicators.cjs').lines(S.indicators), ...require('../lib/direction.cjs').lines(S.direction)].map((l, i) => paint(l.slice(0, inner), { fg: i === 0 ? T.gold : /failures firing|falling/.test(l) ? T.red : /rising|forecast/.test(l) ? T.green : T.text })), '');
  // 7. path to profit and road to mainnet across all your engines (your portal database, refreshed every 5 minutes)
  const ins = require('../lib/insights.cjs').summarize(S.insights);
  if (ins.length) panel('Path to profit · all engines', ins.map((l) => paint(l.slice(0, inner), { fg: /SILENT/.test(l) ? T.red : T.text })), S.insights && S.insights.fetchedAt ? `${ago(Date.now() - S.insights.fetchedAt)} ago` : '');
  // 8. who can lend how much, per asset (Aave vs Balancer)
  const fl = (I.flashLiquidity || []).slice(0, 8);
  if (fl.length) {
    const mx = Math.max(1, ...fl.flatMap((x) => [x.aaveUsd || 0, x.altUsd || 0])); const bw = Math.max(6, Math.floor((inner - 10) / 2) - 8);
    panel('Flash-loan liquidity · Aave | Balancer', fl.map((x) => A.padEnd(paint(x.symbol, { fg: T.text }), 8) + HD.gauge(x.aaveUsd, mx, bw, ['#2E5E8C', T.blue]) + A.padStart(paint(HD.short(x.aaveUsd, '$'), { fg: T.dim }), 8) + ' ' + HD.gauge(x.altUsd, mx, bw, ['#3A2E5E', '#A98BE0']) + A.padStart(paint(HD.short(x.altUsd, '$'), { fg: T.dim }), 8)));
  }
  return out;
}

function measure(S, w) {
  const sm = S.session.summary(S.thresholds);
  const out = [...moneyBox(S, w, { full: true }), ...modeBox(S, w, { full: true }), ...profitBox(S, w), ...verdictBox(S, w)];
  const iw = w - 4;
  const kv = (k, v) => A.padEnd(label(k), 26) + v;
  out.push(...W.box('SESSION', [
    kv('watching for', value(ago(Date.now() - S.session.startedAt))),
    kv('scans', value(String(sm.scans)) + label(`   ${sm.errors} errors · ${sm.standby} under gas standby`)),
    kv('opportunity episodes', value(String(sm.episodes)) + label(`   in ${sm.distinctBlocks} distinct block${sm.distinctBlocks === 1 ? '' : 's'}`)),
    kv('net at first sight (sum)', W.money(sm.sumNetUsd)),
    kv('projected per day', sm.perDayUpperBound === null ? label(`after ${Math.ceil(sm.minutesToProjection)} more min of data`) : W.money(sm.perDayUpperBound) + label('   upper bound, zero competition')),
  ], w));
  out.push(...indicatorsBox(S, w));
  const ep = S.session.episodes.slice(-12).reverse();
  out.push(...W.box('EPISODES', ep.length ? W.table([{ label: 'TIME', w: 8 }, { label: 'BLOCK', w: 10, align: 'right' }, { label: 'ROUTE' }, { label: 'NET', w: 10, align: 'right' }], ep.map((e) => [new Date(e.at).toLocaleTimeString('en-US', { hour12: false }), String(e.block), prettyRoute(e.route), W.money(e.netUsd)]), iw)
    : [label('None yet. An episode starts when a route first passes every guardrail and ends when it stops passing.')], w));
  const ed = S.session.edge();
  const el = [];
  el.push(A.padEnd(label('scan speed'), 26) + (ed.medianScanMs === null ? label('after the first scan') : value(`${(ed.medianScanMs / 1000).toFixed(1)} s`) + label(` ≈ ${Math.round(ed.scanBlocks)} Arbitrum blocks (~0.25 s each)`)));
  el.push(A.padEnd(label('opportunity lifetime'), 26) + (ed.closedEpisodes ? value(`median ${ed.medianLifetimeScans} scan${ed.medianLifetimeScans === 1 ? '' : 's'}`) + label(` · ${Math.round(ed.vanishedWithinOneScan * 100)}% gone before the next scan (${ed.closedEpisodes} closed)`) : label('needs closed episodes')));
  const slow = ed.scanBlocks !== null && ed.scanBlocks > 8;
  el.push('', paint('What this means', { fg: T.gold, bold: true }));
  A.wrap(slow ? `Each scan spans about ${Math.round(ed.scanBlocks)} blocks. Bots that react within a block or two will usually take an opportunity before this console sees it twice. A high "gone before the next scan" share is that competition, measured.` : 'Scan speed is within a few blocks. The lifetime figure shows how contested the routes you see are.', iw).forEach((x) => el.push(paint(x, { fg: T.text })));
  el.push('', paint('Levers that change the edge', { fg: T.gold, bold: true }));
  for (const l of ['Speed (partly built): cloud/gcp-setup.sh runs the engine on a Google Cloud VM in us-east4 instead of the phone; a websocket block feed is not built.', 'Cost (measured): the scan reads Balancer V2\'s flash fee and what it can lend every scan and shows each route\'s net through it; your contract borrows only from Aave, so using Balancer needs a contract change you approve.', 'Niche (built): long-tail pools and fee tiers that large bots skip; the scanner already enumerates every pool pair, and lifetime above shows where routes stay open.', 'Inclusion (built): the live executor bids a share of the surplus above your floor as priority fee (EXEC_TIP_SHARE_BPS).']) A.wrap('• ' + l, iw).forEach((x, i) => el.push(i ? '  ' + label(x) : label(x)));
  out.push(...W.box('EDGE · measured, not assumed', el, w));
  out.push(...W.box('HOW TO READ THIS', A.wrap('Quotes are visible to every searcher and Arbitrum orders transactions by priority-fee auction, so per-day figures are an upper bound. A GO means a shadow test is worth running (the real contract simulated every block, nothing sent), not that profit is coming.', iw).map((x) => label(x)), w));
  return out;
}

// ------------------------------------------------------------------ profitability indicators (all from the last scan's block)
function indicatorsBox(S, w) {
  const I = S.res && S.res.indicators;
  if (!I) return W.box('PROFITABILITY INDICATORS', [label('After the first scan. Every figure here is read from the chain at that scan\'s block.')], w);
  const iw = w - 4;
  const kv = (k, v) => A.padEnd(label(k), 26) + v;
  const bp = (x) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : ''}${x} bps`);
  const L = [];
  const c = I.cycles;
  L.push(kv('cycles checked', value(String(c.checked)) + label(` · prices allow ${c.pricesAllow} · within 10 bps ${c.nearMiss10bps}`)));
  L.push(kv('by legs (prices allow)', value((c.byLegs || []).map((x) => `${x.legs}: ${x.pricesAllow}`).join('  '))));
  L.push(kv('quoted for real', value(String(c.quoted)) + label(` (${c.flipsQuoted} flips) · positive at screen size ${c.positiveAtScreenSize}`)));
  L.push(kv('optimised / approved', value(`${c.optimised} / ${c.approved}`)));
  const be = I.breakEven;
  L.push(kv('gas to beat (2/3/4 legs)', value(be.gasUsdByLegs.map((x) => '$' + x.gasUsd.toFixed(3)).join(' / ')) + label(` at ${be.gasGwei.toFixed(4)} gwei (ceiling ${be.gasCeilingGwei})`)));
  L.push(kv('flash fee', value(Object.entries(be.flashFeeBps).map(([k, v]) => `${k} ${v} bps`).join(' · '))));
  if (I.best) L.push(kv('best route now', W.money(I.best.netUsd) + label(` ${I.best.path.join('→')} at $${Math.round(I.best.amountUsd)}${I.best.altNetUsd !== null ? ` · via Balancer ${I.best.altNetUsd >= 0 ? '+' : '−'}$${Math.abs(I.best.altNetUsd).toFixed(3)}` : ''}`)));
  if (I.raw) {
    L.push('', paint('Before the filters (every route, screen size $' + I.raw.screenSizeUsd + ')', { fg: T.gold, bold: true }));
    L.push(kv('gross gap > 0', value(String(I.raw.grossPositive)) + label(` routes · ${I.raw.beatsFlashFee} also beat the flash fee · best gross ${I.raw.bestGrossUsd === null ? '—' : (I.raw.bestGrossUsd >= 0 ? '+' : '−') + '$' + Math.abs(I.raw.bestGrossUsd).toFixed(3)}`)));
    for (const b of (I.blockedBy || []).slice(0, 6)) L.push(kv('blocked by ' + b.filter, value(String(b.routes)) + label(` routes${b.onlyThis ? ` · ${b.onlyThis} by this alone, best would net ${(b.bestNetIfOnlyThis >= 0 ? '+' : '−') + '$' + Math.abs(b.bestNetIfOnlyThis).toFixed(3)}` : ''}`)));
  }
  if (I.bestEdges.length) { L.push('', paint('Closest cycles by pool prices (edge vs break-even, before size)', { fg: T.gold, bold: true })); for (const e of I.bestEdges.slice(0, 5)) L.push(A.truncate(`${A.padEnd(bp(e.edgeBps), 11)} ${e.path.join('→')}  ${e.venues.map(shortVenue).join(' › ')}`, iw)); }
  if (I.spreads.length) { L.push('', paint('Widest cross-pool spreads (same pair, before fees)', { fg: T.gold, bold: true })); for (const x of I.spreads.slice(0, 5)) L.push(A.truncate(`${A.padEnd(x.bps + ' bps', 11)} ${x.pair.join('/')}  ${shortVenue(x.cheap)} vs ${shortVenue(x.dear)} · ${x.pools} pools`, iw)); }
  if (I.moves.length) { L.push('', paint('Biggest price moves since the previous read (full scan or fast re-check)', { fg: T.gold, bold: true })); for (const x of I.moves.slice(0, 5)) L.push(A.truncate(`${A.padEnd(x.bps + ' bps', 11)} ${shortVenue(x.market)}`, iw)); }
  if (I.flips.length) { L.push('', paint('Flips (other direction / other borrow token), quoted', { fg: T.gold, bold: true })); for (const f of I.flips.slice(0, 5)) L.push(A.truncate(`${A.padEnd((f.netUsd >= 0 ? '+' : '−') + '$' + Math.abs(f.netUsd).toFixed(3), 11)} ${f.path.join('→')} · ${f.flip}${f.approved ? ' · approved' : ''}`, iw)); }
  const fl = I.flashLiquidity.filter((x) => x.aaveUsd || x.altUsd).slice(0, 5);
  if (fl.length) { L.push('', paint('Flash liquidity now (USD)', { fg: T.gold, bold: true })); for (const x of fl) L.push(A.truncate(`${A.padEnd(x.symbol, 9)} Aave ${x.aaveUsd === null ? '—' : '$' + Math.round(x.aaveUsd).toLocaleString('en-US')}${x.altUsd ? ' · Balancer $' + Math.round(x.altUsd).toLocaleString('en-US') : ''}`, iw)); }
  return W.box('PROFITABILITY INDICATORS · this scan\'s block', L, w);
}

// ------------------------------------------------------------------ policies
function policies(S, w) {
  const iw = w - 4;
  const P = pol.evaluatePolicies({ envFile: S.envFile, cfg: S.cfg || { problems: S.problems }, record: S.record, lastRes: S.res, integrity: S.integrity, realized: S.realized });
  const pl = [];
  P.forEach((p, i) => {
    const head = paint(p.id.padEnd(7), { fg: T.gold, bold: true }) + paint(p.name, { fg: T.ink, bold: true });
    const pi = W.pill(p.status);
    pl.push(head + ' '.repeat(Math.max(1, iw - A.vlen(head) - A.vlen(pi))) + pi);
    A.wrap(p.rule, iw - 7).forEach((x) => pl.push('       ' + paint(x, { fg: T.text })));
    A.wrap(p.detail + (p.vars.length ? `   [${p.vars.join(', ')}]` : ''), iw - 7).forEach((x) => pl.push('       ' + label(x)));
    if (i < P.length - 1) pl.push('');
  });
  const out = W.box('POLICIES', pl, w, { right: label(S.envFile ? path.basename(path.dirname(S.envFile)) + '/.env' : 'no .env') });
  const params = pol.listParameters({ envFile: S.envFile, cfg: S.cfg });
  const kw = Math.min(26, Math.max(...params.map((p) => p.key.length)) + 2);
  const ql = [];
  for (const p of params) {
    const icon = p.ok ? paint('✓', { fg: T.green }) : p.required ? paint('✗', { fg: T.red, bold: true }) : paint('·', { fg: T.faint });
    ql.push(`${icon} ${A.padEnd(paint(p.key, { fg: p.ok || !p.required ? T.ink : T.red }), kw)}${A.padEnd(p.ok ? value(p.value) : label(p.required ? 'missing (required)' : 'not set'), 18)}${label(p.help)}`);
  }
  out.push(...W.box('PARAMETERS · from .env', ql, w));
  return out;
}

// ------------------------------------------------------------------ system
function system(S, w) {
  const iw = w - 4; const out = [];
  const nl = !S.nodes ? [label('probing…')] : !S.nodes.length ? [paint('No RPC url found in .env', { fg: T.red })] : S.nodes.map((n) =>
    (n.ok ? paint('✓ ', { fg: T.green, bold: true }) : paint('✗ ', { fg: T.red, bold: true })) + A.padEnd(paint(n.key, { fg: T.ink }), 20) + A.padEnd(paint(n.ms !== undefined ? `${n.ms} ms` : '', { fg: T.text }), 9) + label(redact(n.block ? `block ${n.block} · ${n.detail}` : n.detail)));
  if (S.cfg && S.cfg.rpcEnvKey) nl.push(label(`scanner uses ${S.cfg.rpcEnvKey} · urls are never shown · n to re-probe`));
  out.push(...W.box('NODES', nl, w));

  const sv = [];
  if (S.services) {
    sv.push(label(`PM2 · ${S.services.source}`));
    for (const a of S.services.apps) sv.push('  ' + A.padEnd(paint(a.name, { fg: T.ink }), 26) + W.tag(String(a.status || '?').toUpperCase(), a.status === 'online' ? T.green : a.status === 'saved' ? T.blue : T.amber) + (a.restarts ? label(`  ${a.restarts} restarts`) : ''));
  }
  if (S.eco.length) {
    sv.push(label('ecosystem.config.cjs'));
    for (const a of S.eco) sv.push('  ' + A.padEnd(paint(a.name, { fg: T.ink }), 26) + (a.exists ? paint('script present', { fg: T.green }) : paint('script missing: ' + a.script, { fg: T.red })));
  }
  out.push(...W.box('SERVICES', sv.length ? sv : [label('reading…')], w));

  const vl = S.st ? S.st.venueReport.map((v) => (v.ok ? paint('✓ ', { fg: T.green, bold: true }) : paint('✗ ', { fg: T.red, bold: true })) + A.padEnd(paint(v.id, { fg: T.ink }), 14) + (v.ok ? W.tag(v.executable ? 'EXECUTABLE' : 'QUOTE-ONLY', v.executable ? T.green : T.blue) : label(v.why))) : [label('after start-up')];
  out.push(...W.box('VENUES', vl, w));

  if (S.st) {
    const fl = S.st.assets.filter((a) => a.flashEnabled).map((a) => a.symbol);
    out.push(...W.box('AAVE V3', [
      label('flash premium  ') + value(`${S.st.aave.premiumBps} bps`) + label('  read from the pool'),
      ...A.wrap(`flash-loanable now (${fl.length}): ${fl.join(', ')}`, iw).map((x) => paint(x, { fg: T.text })),
    ], w));
  }

  const al = [];
  if (S.auditing) al.push(paint('auditing…', { fg: T.gold }));
  else if (!S.audit) al.push(label('press a to check every pool in src/registry.ts against the chain'));
  else if (S.audit.error) al.push(paint(S.audit.error, { fg: T.red }));
  else for (const r of S.audit.results) {
    al.push((r.problems.length ? paint('✗ ', { fg: T.red, bold: true }) : paint('✓ ', { fg: T.green, bold: true })) + paint(`${r.claim.exchange} ${r.claim.pair}`, { fg: T.ink }) + label(`  ${String(r.claim.address).slice(0, 10)}…`));
    if (r.onchain) al.push('    ' + label(`on-chain: ${r.onchain.venue || 'unknown factory'} · ${r.onchain.pair} · fee ${r.onchain.fee}`));
    r.problems.forEach((p) => A.wrap(p, iw - 6).forEach((x) => al.push('    ' + paint(x, { fg: T.red }))));
  }
  out.push(...W.box('REGISTRY AUDIT', al, w));

  const rl = [];
  if (!S.record) rl.push(label('reading…'));
  else if (!S.record.found) rl.push(label(`no record file at ${S.record.file}`));
  else {
    rl.push(label('payout wallet  ') + paint(pol.shortAddr(S.record.payoutWallet) || '—', { fg: T.ink }));
    rl.push(label('confirmed txs  ') + value(String(S.record.txCount)) + label('   flash-loan executions  ') + value(String(S.record.flashExecutions)));
    for (const a of S.record.actions) rl.push((a.isTx ? paint('● ', { fg: T.green }) : paint('○ ', { fg: T.faint })) + A.padEnd(paint(a.key, { fg: T.text }), 36) + label(a.isTx ? `block ${a.block}` : 'read-only check'));
  }
  out.push(...W.box('ON-CHAIN RECORD', rl, w));

  const iv = S.integrity;
  out.push(...W.box('INTEGRITY', iv ? [
    (iv.ok ? paint('✓ ', { fg: T.green, bold: true }) + paint(`${iv.count} code files${iv.depsSealed ? ` and ${iv.depsCount} libraries (ethers + dependencies)` : ''} match SEAL.json`, { fg: T.ink }) : paint('✗ code differs from SEAL.json', { fg: T.red, bold: true })),
    label(iv.sealedAt ? `sealed ${iv.sealedAt}` : 'not sealed'),
    label('error messages are scrubbed of node urls and keys · token symbols are stripped of terminal control codes · history lines are HMAC-signed'),
  ] : [label('checked at start-up')], w));
  const svc = S.service || {}; const eg = S.engine;
  const el = [];
  el.push(label('mode           ') + (S.view === 'follow' ? paint(`following the background engine · pid ${eg ? eg.pid : '?'} · heartbeat ${eg ? ago(Date.now() - eg.heartbeat) : '?'} ago`, { fg: T.green }) : paint('scanning in this window', { fg: T.text })));
  el.push(label('service        ') + (!svc.pm2 ? paint('PM2 not found · npm install -g pm2', { fg: T.amber }) : !svc.installed ? paint('not installed · chronos service install', { fg: T.amber }) : paint(`${svc.status}${svc.restarts ? ` · ${svc.restarts} restarts` : ''}${svc.uptimeMs ? ` · up ${ago(svc.uptimeMs)}` : ''}`, { fg: svc.status === 'online' ? T.green : T.red })));
  el.push(label('boot start     ') + (svc.boot ? paint('on (Termux:Boot)', { fg: T.green }) : paint(svc.bootAppReady ? 'off · chronos service install' : 'off · install Termux:Boot (F-Droid), open it once', { fg: T.amber })));
  const ch = eg && eg.notify ? eg.notify : { termux: !!onPath('termux-notification'), webhook: false };
  el.push(label('alerts         ') + paint(`phone ${ch.termux ? '✓' : '✗ (Termux:API + pkg install termux-api)'} · webhook ${ch.webhook ? '✓' : '✗ (CHRONOS_WEBHOOK_URL=off)'}`, { fg: ch.termux || ch.webhook ? T.text : T.amber }));
  const rq = S.res && S.res.rpc; const mc = S.st ? S.st.multicall : null;
  el.push(label('batching       ') + paint(mc === null || mc === undefined ? '—' : mc ? `Multicall3 on${rq ? ` · last scan: ${rq.calls} calls in ${rq.requests} requests, all at block ${S.res.quotesPinnedToBlock}` : ''}` : 'off (no Multicall3 at this address): one request per call', { fg: T.text }));
  out.push(...W.box('BACKGROUND ENGINE', el, w));
  const rz = S.realized;
  const rl2 = !rz ? [label('checked after start-up, then every 10 minutes')] : !rz.contract ? [paint('no Chronos contract yet: chronos mainnet (saves CHRONOS_FLASH_ARB_ADDRESS)', { fg: T.amber }), label('profit can only be verified from receipts of your own deployed contract')] : [
    label('contract       ') + paint(pol.shortAddr(rz.contract), { fg: T.ink }) + label(`   ${rz.checked} transaction(s) checked · ${rz.confirmed} confirmed`),
    label('verified       ') + (rz.executions.length ? W.money(rz.totalNetUsd) + label(` net after gas across ${rz.executions.length} execution(s)`) : label('no Arbitrage events from this contract yet')),
    ...(rz.taxReserveUsd ? [label('T1 reserve     ') + W.money(rz.taxReserveUsd, { sign: false }) + label('  (30% of gross − gas)')] : []),
  ];
  out.push(...W.box('REALIZED PROFIT · receipts only', rl2, w));
  out.push(...W.box('CAPABILITIES', sys.CAPABILITIES.map((c) => A.padEnd(paint(c.name, { fg: T.ink }), 34) + A.padEnd(W.tag(c.status), 11) + label(c.detail)), w));
  return out;
}

// ------------------------------------------------------------------ help
function helpOverlay(w, h) {
  const bw = Math.min(w - 2, 70);
  const k = (key, what) => A.padEnd(paint(key, { fg: T.gold, bold: true }), 14) + paint(what, { fg: T.text });
  const lines = [k('1 … 6', 'switch tab (Overview, Routes, Visuals, Measure, Policies, System)'), k('← → tab', 'previous / next tab'), k('↑ ↓  j k', 'select a route, or scroll'), k('enter', 'route details: legs, costs, guardrails, contract call'),
    k('esc', 'close details or help'), k('r', 'scan now (or retry start-up)'), k('p', 'pause / resume scanning'), k('s', 'save selected route to data/routes/'), k('a', 'audit src/registry.ts on-chain'), k('n', 're-probe every RPC node'), k('L', 'scan in this window instead of following the engine'), k('e', 'setup: import / paste keys, settings, action checklist'), k('q', 'quit'),
    '', paint('Reading the numbers', { fg: T.gold, bold: true }), ...A.wrap('NET = what comes back − what was borrowed − Aave flash fee − gas. Gas uses the live gas price × GAS_UNITS_ASSUMED from your .env. Every quote is a real on-chain call; a failed quote is dropped, never estimated. Nothing in this console signs or sends a transaction.', bw - 4).map((x) => label(x))];
  const b = W.box('HELP', lines, bw);
  const top = Math.max(0, Math.floor((h - b.length) / 2));
  return { top, lines: b.map((l) => A.center(l, w)) };
}

// ------------------------------------------------------------------ health banner
function banner(S, w) {
  if (S.phase !== 'running') return null;
  const list = HEALTH.problems(S);
  if (!list.length) return A.padEnd(paint(' ✓ PROFITING · verified on-chain profit and every check passing ', { fg: '#0E1114', bg: T.green, bold: true }), w);
  const faults = list.filter((x) => !x.profit);
  const lead = faults[0] || list[0];
  const head = paint(faults.length ? ` ✗ ${faults.length} PROBLEM${faults.length === 1 ? '' : 'S'} ` : ' ✗ NOT PROFITING ', { fg: '#FFFFFF', bg: T.red, bold: true });
  const first = paint(' ' + (faults.length ? lead.msg : lead.msg.replace(/^NOT PROFITING · /, '')) + (list.length > 1 ? `  (+${list.length - 1} more)` : '') + `  · tab ${lead.tab}`, { fg: T.red, bold: true });
  return A.padEnd(head + first, w);
}

// ------------------------------------------------------------------ frame
function renderFrame(S, w, h) {
  w = Math.max(40, w); h = Math.max(12, h);
  const ban = banner(S, w);
  const body = h - 4 - (ban ? 1 : 0);
  let lines;
  if (S.phase !== 'running') lines = bootScreen(S, w, body);
  else {
    const views = [overview, routes, visuals, measure, policies, system];
    lines = views[S.tab](S, w, body);
    if (S.tab !== 0 && S.tab !== 1) { // scrollable views
      S.scroll[S.tab] = Math.max(0, Math.min(S.scroll[S.tab], Math.max(0, lines.length - body)));
      lines = lines.slice(S.scroll[S.tab], S.scroll[S.tab] + body);
    }
  }
  lines = lines.slice(0, body);
  while (lines.length < body) lines.push('');
  if (S.help) { const o = helpOverlay(w, body); o.lines.forEach((l, i) => { if (o.top + i < body) lines[o.top + i] = l; }); }
  return [header(S, w), S.phase === 'running' ? tabsLine(S, w) : '', ...(ban ? [ban] : []), paint('─'.repeat(w), { fg: T.line }), ...lines, footer(S, w)].map((l) => A.padEnd(l, w));
}

// ------------------------------------------------------------------ runtime
/** Follow the background engine: its signed state becomes this screen's data. */
function staleMs(st) { return Math.max(30000, ((st && st.interval) || 20) * 3000); }
function applyState(S, st) {
  if (Array.isArray(st.trend)) S.history = st.trend;
  S.road = st.road || null; S.indicators = st.indicators || null; S.direction = st.direction || null; S.insights = st.insights || null; S.res = st.res; S.realized = st.realized; S.lastScanAt = st.lastScanAt; S.progress = st.progress || null; S.lastQuotes = st.lastQuotes; S.error = st.error;
  S.consecutiveErrors = st.consecutiveErrors || 0; S.scanning = !!st.scanning; S.paused = !!st.paused; S.interval = st.interval || S.interval;
  if (st.nodes) S.nodes = st.nodes;
  S.deps = { counter: { n: st.lastQuotes ? st.lastQuotes.n : 0, fail: st.lastQuotes ? st.lastQuotes.fail : 0 } };
  S.st = { venueReport: st.venueReport || [], assets: st.assets || [], aave: st.aave || { premiumBps: null }, markets: [], provider: S.st && S.st.provider ? S.st.provider : null, multicall: st.multicall };
  S.engine = { pid: st.pid, heartbeat: st.heartbeat, startedAt: st.startedAt, notify: st.notify, multicall: st.multicall, markets: st.markets, phase: st.phase };
  const ses = st.session || { startedAt: Date.now(), episodes: [], summary: {}, edge: {} };
  S.session = { startedAt: ses.startedAt, episodes: ses.episodes || [], summary: () => ses.summary, edge: () => ses.edge, add: () => [], error: () => {} };
  S.mode = st.mode || null; S.shadowStats = st.shadow || null; S.shadowRuns = st.shadowRuns || []; S.execInfo = st.exec || null; S.balances = st.balances || null; S.update = st.update || null;
}


function main() {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error('chronos: the console needs an interactive terminal. For plain text use: chronos scan');
    process.exit(2);
  }
  const S = createState();
  const hist = history.load(DATA); S.history = hist.records; S.historyRejected = hist.rejected;
  if (hist.rejected) { S.toast = `ignored ${hist.rejected} history line(s) that were not written by this console`; S.toastAt = Date.now(); }
  const out = process.stdout;
  let closed = false;
  const restore = () => { if (closed) return; closed = true; try { process.stdin.setRawMode(false); } catch (_) { /* */ } out.write('\x1b[?25h\x1b[?1049l'); };
  const draw = () => { if (closed || S.inSetup) return; S.frame++; const lines = renderFrame(S, out.columns || 80, out.rows || 24); lines[lines.length - 1] = lines[lines.length - 1].replace(/ $/, ''); out.write('\x1b[H' + lines.join('\x1b[K\r\n') + '\x1b[K'); };
  const toast = (m) => { S.toast = m; S.toastAt = Date.now(); };
  const quit = (code = 0) => {
    restore();
    const sm = S.session.summary(S.thresholds);
    if (sm.scans) console.log(`Chronos console closed · ${sm.scans} scans · ${sm.episodes} opportunity episodes · verdict: ${sm.verdict} · this dashboard sends nothing (the engine sends only in LIVE)`);
    process.exit(code);
  };
  process.on('uncaughtException', (e) => { restore(); console.error('chronos crashed:', redact(e && e.stack ? e.stack : e)); process.exit(1); });
  process.on('unhandledRejection', (e) => { S.error = redact(e && (e.shortMessage || e.message) || e); });
  process.on('SIGTERM', () => quit(0));

  out.write('\x1b[?1049h\x1b[?25l\x1b[2J');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  out.on('resize', draw);
  setInterval(draw, 120);

  const step = (k, status, detail = '') => { S.steps[k] = { status, detail }; };
  async function boot() {
    S.bootStartedAt = Date.now();
    S.phase = 'boot'; S.error = null; S.problems = [];
    STEPS.forEach(([k]) => step(k, 'wait'));
    step('integrity', 'run');
    S.integrity = integrity.verify();
    if (!S.integrity.ok) {
      step('integrity', 'fail', S.integrity.sealed ? 'code differs from the seal' : 'not sealed');
      S.blockTitle = 'Code integrity check failed';
      S.blockIntro = S.integrity.sealed ? 'The console code no longer matches SEAL.json. It will not run code it cannot vouch for.' : 'This install has no SEAL.json yet.';
      S.problems = [...S.integrity.changed.map((f) => 'changed: ' + f), ...S.integrity.missing.map((f) => 'missing: ' + f), ...S.integrity.added.map((f) => 'unexpected new file: ' + f), ...(S.integrity.deps ? [S.integrity.deps] : [])];
      S.blockFix = S.integrity.sealed ? 'If you did not make this change: reinstall from the original archive. If you did, run: chronos unlock, make your edit, chronos test, chronos seal. Then press r.' : 'Run: chronos seal (install.sh does this for you). Then press r.';
      S.phase = 'blocked'; return;
    }
    step('integrity', 'ok', `${S.integrity.count} files match`);
    S.blockTitle = 'Setup needed'; S.blockIntro = 'These settings are missing or invalid in your .env:'; S.blockFix = 'Press e for guided setup: it imports the keys already on this phone and asks only for what is missing.';
    step('config', 'run');
    S.envFile = live.findEnvFile();
    S.cfg = loadConfig(S.envFile);
    S.thresholds = readThresholds(S.envFile); S.interval = S.thresholds.interval;
    const ws = live.workspaceDir(S.envFile);
    S.record = readRecord(ws); S.eco = sys.ecosystemApps(ws);
    sys.pm2List().then((x) => { S.services = x; });
    sys.probeNodes(S.envFile).then((x) => { S.nodes = x; });
    if (S.cfg.problems.length) { step('config', 'fail', `${S.cfg.problems.length} missing`); S.problems = S.cfg.problems; S.phase = 'blocked'; return; }
    step('config', 'ok', S.envFile);
    const ls = LS.read(DATA);
    S.stateTampered = ls.reason === 'signature';
    if (!S.forceLocal && ls.ok && LS.alive(ls.state, staleMs(ls.state)) && ['running', 'paused', 'error'].includes(ls.state.phase)) {
      S.view = 'follow'; applyState(S, ls.state);
      for (const k of ['rpc', 'aave', 'venues', 'discover', 'scan']) step(k, 'ok', 'background engine');
      S.phase = 'running'; toast('following the background engine (pid ' + ls.state.pid + ')');
      return;
    }
    S.view = 'local';
    try {
      S.st = await live.init(S.cfg, step);
      S.phase = 'running'; step('scan', 'run'); S.nextAt = 0;
      checkRealized();
    } catch (e) {
      const cur = STEPS.find(([k]) => S.steps[k].status === 'run');
      if (cur) step(cur[0], 'fail');
      S.phase = 'error'; S.error = redact(e.shortMessage || e.message);
    }
  }

  async function doScan() {
    S.scanning = true; S.scanStart = Date.now();
    try {
      S.progress = { phase: 'start', done: 0, total: 0 };
      const deps = await live.snapshot(S.cfg, S.st); S.deps = deps;
      deps.onProgress = (p) => { S.progress = p; };
      const res = await runScan(S.cfg, deps);
      S.res = res; S.error = null; S.consecutiveErrors = 0; S.lastScanAt = Date.now(); S.lastQuotes = { n: deps.counter.n, fail: deps.counter.fail };
      const fresh = S.session.add(res);
      const best = res.candidates[0];
      const h = { t: Date.now(), block: res.blockNumber, gas: res.gasGwei, best: best ? best.netUsd : null, approved: res.approved, ms: res.tookMs, quotes: deps.counter.n, fails: deps.counter.fail, sp: ((res.indicators && res.indicators.spreads) || []).slice(0, 8).map((x) => [x.pair.join('/'), x.bps]), near: res.indicators && res.indicators.cycles ? res.indicators.cycles.nearMiss10bps : null };
      S.history.push(h); if (S.history.length > 240) S.history.shift();
      try { history.append(DATA, h); } catch (_) { /* optional */ }
      if (fresh.length) toast(`◆ new opportunity ${prettyRoute(fresh[0].route).split('  ')[0]}  net $${fresh[0].netUsd.toFixed(2)}`);
      if (S.steps.scan.status !== 'ok') step('scan', 'ok');
    } catch (e) { S.session.error(); S.consecutiveErrors++; S.error = redact(e.shortMessage || e.message); toast('scan failed: ' + S.error.slice(0, 60)); }
    finally { S.scanning = false; S.progress = null; S.nextAt = Date.now() + S.interval * 1000; }
  }

  setInterval(() => { if (S.view === 'local' && S.phase === 'running' && !S.paused && !S.scanning && Date.now() >= S.nextAt) doScan(); }, 250);

  // follow mode: refresh from the engine's signed state every second; history every 5 s
  let histTick = 0;
  setInterval(() => {
    if (S.view !== 'follow' || S.inSetup) return;
    const ls = LS.read(DATA);
    if (!ls.ok) { S.followProblem = ls.reason === 'signature' ? 'background engine state failed its signature check (ignored)' : 'background engine state is missing'; S.stateTampered = ls.reason === 'signature'; return; }
    S.stateTampered = false;
    if (!LS.alive(ls.state, staleMs(ls.state))) { S.followProblem = `background engine not responding (last heartbeat ${ago(Date.now() - (ls.state.heartbeat || 0))} ago) · press L to scan in this window`; return; }
    S.followProblem = null; applyState(S, ls.state);
    if (++histTick % 5 === 0) { const h = history.load(DATA); S.history = h.records; S.historyRejected = h.rejected; }
  }, 1000);

  // realized profit, from receipts only (local mode; the engine does this itself in follow mode)
  async function checkRealized() {
    if (S.view !== 'local' || !S.st || !S.st.provider) return;
    const env = S.envFile ? parseEnvFile(S.envFile) : {};
    const contract = RZ.contractFrom((k) => (process.env[k] !== undefined ? process.env[k] : env[k]));
    try { S.realized = await RZ.verifyRealized({ provider: S.st.provider, contract: contract && contract.address, hashes: RZ.candidateHashes(S.record, DATA), assets: S.st.assets, wethAddress: live.WETH, taxBps: S.thresholds.taxBps }); } catch (_) { /* retried */ }
  }
  setInterval(checkRealized, 600000);
  const refreshService = () => SVC.statusAsync().then((x) => { S.service = x; }).catch(() => {});
  refreshService(); setInterval(refreshService, 15000);

  // fail loudly: refresh policy failures, ring the bell for each new problem, log changes
  setInterval(() => {
    if (S.inSetup || S.phase !== 'running') return;
    try {
      S.policyFails = pol.evaluatePolicies({ envFile: S.envFile, cfg: S.cfg, record: S.record, lastRes: S.res, integrity: S.integrity }).filter((p) => ['FAIL', 'BLOCKING'].includes(p.status));
    } catch (_) { /* shown via other checks */ }
    const list = HEALTH.problems(S);
    const r = HEALTH.logNew(DATA, list, S.healthSeen);
    if (r.fresh.length) { out.write('\x07'); toast('✗ ' + r.fresh[0].msg.slice(0, 70)); }
    if (!list.length && S.healthSeen.size) S.smoothSince = Date.now();
    S.healthSeen = r.seen;
  }, 1000);
  setInterval(() => { if (S.phase === 'running' && !S.inSetup) sys.probeNodes(S.envFile).then((x) => { S.nodes = x; }); }, 120000);

  function saveRoute() {
    const c = profitable(S.res)[S.sel];
    if (!c) return toast('no route selected');
    const dir = path.join(DATA, 'routes'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `route_${S.res.blockNumber}_${S.sel + 1}.json`);
    fs.writeFileSync(f, JSON.stringify(jsonSafe({ note: `quote at block ${S.res.blockNumber}; nothing was sent`, block: S.res.blockNumber, gasGwei: S.res.gasGwei, route: c }), null, 2));
    toast('saved ' + path.relative(live.ROOT, f));
  }

  async function runAudit() {
    if (!S.st) return toast('audit needs a running console');
    if (!S.st.provider) { try { S.st.provider = await C.connect(S.cfg); } catch (e) { S.audit = { error: redact(e.shortMessage || e.message) }; return; } }
    const file = path.join(live.workspaceDir(S.envFile), 'src', 'registry.ts');
    if (!fs.existsSync(file)) { S.audit = { error: `no registry at ${file}` }; return; }
    S.auditing = true;
    try {
      const venues = JSON.parse(fs.readFileSync(process.env.CHRONOS_VENUES_FILE || path.join(live.ROOT, 'venues.json'), 'utf8')).venues;
      S.audit = { results: await auditRegistry(S.st.provider, file, venues) };
      const bad = S.audit.results.filter((r) => r.problems.length).length;
      toast(`registry audit: ${S.audit.results.length} pool${S.audit.results.length === 1 ? '' : 's'}, ${bad} with problems`);
    } catch (e) { S.audit = { error: redact(e.shortMessage || e.message) }; }
    S.auditing = false;
  }

  async function openSetup() {
    let before = 0; try { before = fs.statSync(S.envFile || '').mtimeMs; } catch (_) { /* none yet */ }
    S.inSetup = true; S.paused = true;
    out.write('\x1b[?25h\x1b[?1049l');
    let ctx = null;
    try { ctx = await require('./setup.cjs').runSetup(); } catch (e) { console.error(redact(e.message)); }
    out.write('\x1b[?1049h\x1b[?25l\x1b[2J');
    process.stdin.setRawMode(true); process.stdin.resume();
    S.inSetup = false; S.paused = false;
    let after = 0; try { after = fs.statSync(live.findEnvFile() || '').mtimeMs; } catch (_) { /* none */ }
    if (after !== before && SVC.restartIfRunning()) toast('settings changed: background engine restarted with them');
    if (ctx && ctx.summary && ctx.summary.length) toast(`◆ online now: ${ctx.summary.slice(0, 2).join(', ')}${ctx.summary.length > 2 ? ` +${ctx.summary.length - 2}` : ''}`);
    boot();
  }

  process.stdin.on('data', (k) => {
    if (S.inSetup) return;
    if (k === '\u0003' || k === 'q') return quit(0);
    if (k === 'e') { openSetup(); return; }
    if (S.help) { S.help = false; return; }
    if (k === '?') { S.help = true; return; }
    if (k === 'r') { if (S.phase === 'running') { if (S.view === 'follow') { LS.control.poke(DATA); toast('engine: scan requested'); } else { S.nextAt = 0; toast('scanning now'); } } else boot(); return; }
    if (k === 'L') { S.forceLocal = true; S.view = 'local'; toast('scanning in this window'); boot(); return; }
    if (S.phase !== 'running') return;
    if (/^[1-6]$/.test(k)) { S.tab = Number(k) - 1; S.detail = false; return; }
    if (k === '\t' || k === '\x1b[C') { S.tab = (S.tab + 1) % TABS.length; S.detail = false; return; }
    if (k === '\x1b[Z' || k === '\x1b[D') { S.tab = (S.tab + TABS.length - 1) % TABS.length; S.detail = false; return; }
    const up = k === '\x1b[A' || k === 'k', down = k === '\x1b[B' || k === 'j';
    if (up || down) {
      const d = up ? -1 : 1;
      if (S.tab === 1 && S.detail) S.scroll[1] = Math.max(0, S.scroll[1] + d);
      else if (S.tab === 1 || S.tab === 0) { S.sel = Math.max(0, S.sel + d); }
      else S.scroll[S.tab] = Math.max(0, S.scroll[S.tab] + d);
      return;
    }
    if (k === '\r' || k === '\n') { if (S.tab === 0) S.tab = 1; S.detail = !S.detail; S.scroll[1] = 0; return; }
    if (k === '\x1b') { S.detail = false; return; }
    if (k === 'p') { if (S.view === 'follow') { LS.control.setPaused(DATA, !S.paused); S.paused = !S.paused; toast(S.paused ? 'engine paused' : 'engine resumed'); } else { S.paused = !S.paused; toast(S.paused ? 'paused' : 'resumed'); } return; }
    if (k === 's') return saveRoute();
    if (k === 'a') { S.tab = 5; runAudit(); return; } // System tab
    if (k === 'n') { S.nodes = null; sys.probeNodes(S.envFile).then((x) => { S.nodes = x; }); toast('probing nodes'); }
  });

  boot();
}

module.exports = { main, renderFrame, createState, STEPS, applyState };
if (require.main === module) main();
