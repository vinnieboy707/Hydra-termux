'use strict';
// Live commentary (2.9.17): the engine explains what it is doing, in plain words, as it happens, and `chronos narrate`
// reads it aloud. The engine writes every line to data/live/narration.jsonl (numbered), whether or not anyone is
// listening, so pausing, quitting and coming back later always picks up at the first line you have not heard
// (data/live/narration.cursor). Nothing here moves money, changes a setting or leaves the device.
const fs = require('fs');
const path = require('path');

const MAX_LINES = 3000, KEEP_LINES = 1500;
const fileOf = (dataDir) => path.join(dataDir, 'live', 'narration.jsonl');
const cursorOf = (dataDir) => path.join(dataDir, 'live', 'narration.cursor');

const money = (v) => { const n = Number(v); if (!Number.isFinite(n)) return 'an unknown amount'; const a = Math.abs(n); const s = a >= 1 ? `${a.toFixed(2)} dollars` : `${Math.round(a * 100)} cents`; return (n < 0 ? 'minus ' : '') + s; };
const num = (v) => Number(v || 0).toLocaleString('en-US');
const sym = (s) => String(s || '').replace(/[^A-Za-z0-9.]/g, '') || 'a token';

/** reads the journal: [{ n, at, level, text }] (a damaged line is skipped, never fatal) */
function readAll(dataDir) {
  let raw = ''; try { raw = fs.readFileSync(fileOf(dataDir), 'utf8'); } catch (_) { return []; }
  const out = []; for (const l of raw.split('\n')) { if (!l) continue; try { const x = JSON.parse(l); if (Number.isFinite(x.n) && typeof x.text === 'string') out.push(x); } catch (_) { /* skip */ } }
  return out;
}
const readCursor = (dataDir) => { try { const n = Number(fs.readFileSync(cursorOf(dataDir), 'utf8')); return Number.isFinite(n) ? n : 0; } catch (_) { return 0; } };
const writeCursor = (dataDir, n) => { try { fs.mkdirSync(path.dirname(cursorOf(dataDir)), { recursive: true }); fs.writeFileSync(cursorOf(dataDir), String(n), { mode: 0o600 }); } catch (_) { /* best effort */ } };

/** the engine side: compares what it is doing now with the last look and writes what changed, in words */
class Commentary {
  constructor(dataDir, { now = () => Date.now(), scanEverySec = 60 } = {}) {
    this.dataDir = dataDir; this.now = now; this.scanEveryMs = Math.max(10, scanEverySec) * 1000;
    const all = readAll(dataDir); this.n = all.length ? all[all.length - 1].n : 0;
    this.prev = null; this.lastScanSaid = 0; this.lastBest = null; this.lastBlocker = null;
  }
  say(text, level = 'info') {
    this.n++; const line = JSON.stringify({ n: this.n, at: new Date(this.now()).toISOString(), level, text }) + '\n';
    try {
      const f = fileOf(this.dataDir); fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.appendFileSync(f, line, { mode: 0o600 });
      if (this.n % 200 === 0) { const all = readAll(this.dataDir); if (all.length > MAX_LINES) fs.writeFileSync(f, all.slice(-KEEP_LINES).map((x) => JSON.stringify(x)).join('\n') + '\n', { mode: 0o600 }); }
    } catch (_) { /* commentary never stops the engine */ }
    return this.n;
  }
  /** S: the engine's state (lib/daemon.cjs). Called after every scan and every few seconds. */
  observe(S, { version = '', floorUsd = null } = {}) {
    const p = this.prev; const t = this.now();
    const cur = {
      mode: S.mode && S.mode.mode, paused: !!S.paused, safe: !!S.safe, error: S.error || null, scanAt: S.lastScanAt || null,
      execReady: S.execInfo ? !!S.execInfo.ready : null, execWhy: S.execInfo && S.execInfo.why ? String(S.execInfo.why) : null,
      researchAt: S.research && S.research.at, realizedN: S.realized && Array.isArray(S.realized.trades) ? S.realized.trades.length : (S.realized && S.realized.count) || 0,
      hotAt: S.hotRes && S.hotRes.at, acting: S.acting || null,
    };
    if (!p) {
      this.say(`Chronos ${version ? 'version ' + version + ' ' : ''}is running${cur.acting ? ` as your ${cur.acting} engine` : ''}, in ${cur.mode === 'LIVE' ? 'live mode: it sends trades that pass every check' : 'shadow mode: it rehearses every trade and sends nothing'}.`, 'notice');
    } else {
      if (cur.mode !== p.mode && cur.mode) this.say(cur.mode === 'LIVE' ? 'Switched to live mode. Trades that pass every check will now be sent.' : `Switched to ${String(cur.mode).toLowerCase()} mode. Nothing is sent.`, 'notice');
      if (cur.paused !== p.paused) this.say(cur.paused ? 'Scanning is paused.' : 'Scanning resumed.', 'notice');
      if (cur.safe !== p.safe) this.say(cur.safe ? 'The engine went into safe mode after repeated problems. It keeps scanning but sends nothing.' : 'Safe mode is over.', 'alert');
      if (cur.error && cur.error !== p.error) this.say(`A problem: ${clip(cur.error)}. The engine keeps going and retries.`, 'alert');
      if (!cur.error && p.error) this.say('That problem cleared.', 'info');
      if (cur.execReady !== p.execReady && cur.execReady !== null) this.say(cur.execReady ? 'Your executor is ready: it is an operator on your contract, has gas, and its key can sign.' : `Your executor is not ready: ${clip(cur.execWhy || 'no reason given')}.`, 'notice');
      if (cur.researchAt && cur.researchAt !== p.researchAt && S.research) this.say(S.research.error ? `Competitor research failed: ${clip(S.research.error)}.` : `Competitor research finished: ${num(S.research.txs)} arbitrage transactions read from the chain, ${num(S.research.profitable)} profitable after gas, ${num(S.research.synced)} saved to your database.`, 'info');
      if (cur.realizedN > p.realizedN) this.say(`A trade settled on chain. Total verified trades: ${num(cur.realizedN)}.`, 'money');
      if (cur.hotAt && cur.hotAt !== p.hotAt && S.hotRes && S.hotRes.approved) this.say(`The fast lane found ${num(S.hotRes.approved)} approved route${S.hotRes.approved === 1 ? '' : 's'} at block ${num(S.hotRes.block)}. Rehearsing now.`, 'money');
    }
    if (cur.scanAt && (!p || cur.scanAt !== p.scanAt) && S.res) this.scan(S.res, floorUsd, t);
    this.prev = cur;
  }
  scan(res, floorUsd, t) {
    const c = (res.candidates || [])[0]; const ind = res.indicators || {}; const cy = ind.cycles || {};
    const approved = res.approved || 0; const best = c ? c.netUsd : null;
    const blocker = ind.topBlocker || (c && c.reasons && c.reasons[0]) || null;
    // a scan is told at most once a minute, unless something worth hearing changed
    const notable = approved > 0 || (best !== null && this.lastBest !== null && best - this.lastBest > 0.05) || blocker !== this.lastBlocker;
    if (!notable && t - this.lastScanSaid < this.scanEveryMs) return;
    this.lastScanSaid = t; this.lastBest = best; this.lastBlocker = blocker;
    const parts = [`Scan at block ${num(res.blockNumber)}${res.tookMs ? `, ${Math.max(1, Math.round(res.tookMs / 1000))} seconds` : ''}: ${num(res.marketsUsable ?? res.marketsFound)} pools, ${num(cy.checked)} routes checked, ${num(cy.pricesAllow)} with a price gap.`];
    if (approved) parts.push(`${num(approved)} route${approved === 1 ? '' : 's'} cleared every check. The best nets ${money(best)}.`);
    else if (c) {
      parts.push(`Closest: ${sym(c.borrowSymbol)} through ${sym(c.otherSymbol)} on ${money(c.amountUsd)}, which would net ${money(best)}${Number.isFinite(floorUsd) ? `, ${money(Math.max(0, floorUsd - best))} short of your ${money(floorUsd)} floor` : ''}.`);
    } else parts.push('No route came close this time.');
    if (ind.deadRoutes) parts.push(`${num(ind.deadRoutes)} route${ind.deadRoutes === 1 ? '' : 's'} through dead pools set aside.`);
    this.say(parts.join(' '), approved ? 'money' : 'scan');
  }
}
const clip = (s) => String(s).replace(/https?:\/\/\S+/g, 'a link').replace(/0x[0-9a-fA-F]{40,}/g, (a) => `${a.slice(0, 6)}`).slice(0, 180);

/** a short spoken summary of lines missed while away (the important ones are kept whole) */
function catchUp(lines) {
  const scans = lines.filter((l) => l.level === 'scan');
  const keep = lines.filter((l) => l.level !== 'scan');
  const head = `While you were away: ${num(lines.length)} updates, ${num(scans.length)} of them routine scan reports.`;
  const last = scans.length ? ` The latest scan: ${scans[scans.length - 1].text}` : '';
  return { summary: head + (keep.length ? ` ${num(keep.length)} worth hearing in full follow.` : ' Nothing else happened.') + last, keep };
}

module.exports = { Commentary, readAll, readCursor, writeCursor, catchUp, fileOf, cursorOf, money };
