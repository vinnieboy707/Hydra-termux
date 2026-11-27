'use strict';
// Device roles: one primary (your laptop) does the heavy work, the others stand by.
//   primary   full scanning, tempo, the VP and its AI brain, research, audits, and the only device that sends trades
//   standby   a warm backup: scans every 4th interval, no tempo, no AI calls, no research, never sends
// A standby takes over (acts as primary) when no primary has reported for 10 minutes, and hands back as soon as one
// reports again. When several standbys are live, only the first by name takes over, so two devices never send.
// The role lives in ~/.chronos/role on each device (never synced): `chronos role primary` / `chronos role standby`.
// No file = primary (a single device keeps working exactly as before).
const fs = require('fs');
const os = require('os');
const path = require('path');

const FILE = () => process.env.CHRONOS_ROLE_FILE || path.join(os.homedir(), '.chronos', 'role');
const ROLES = ['primary', 'standby'];
const TAKEOVER_MS = 10 * 60000, LIVE_MS = 3 * 60000;
// a primary that has not heard from your database for this long stops sending (it keeps scanning): a standby can only
// take over after TAKEOVER_MS of silence, so a cut-off primary always stops at least 3 minutes before any backup starts
const SEND_DB_MS = 7 * 60000;
// what a standby changes (settings it reads differently; your .env is untouched and stays identical everywhere)
const STANDBY_ENV = Object.freeze({ CHRONOS_VP_AI_MAX_PER_DAY: '0', CHRONOS_TEMPO_MAX: '0' });
const STANDBY_INTERVAL_FACTOR = 4;

function read() { try { const r = fs.readFileSync(FILE(), 'utf8').trim(); return ROLES.includes(r) ? r : 'primary'; } catch (_) { return 'primary'; } }
function write(role) {
  if (!ROLES.includes(role)) throw new Error('role must be primary or standby');
  fs.mkdirSync(path.dirname(FILE()), { recursive: true, mode: 0o700 }); fs.writeFileSync(FILE(), role + '\n', { mode: 0o600 });
  return role;
}

/**
 * What this device does now. role: its own role · me: its heartbeat service name · engines: [{ service, ts, role }]
 * from your database (heartbeats; the insights function) · null engines = database not reachable (keep the role).
 * → { acting: 'primary'|'standby', why }
 */
function decide({ role, me, engines, now = Date.now() }) {
  if (role !== 'standby') return { acting: 'primary', why: 'this device is the primary' };
  if (!Array.isArray(engines)) return { acting: 'standby', why: 'standing by (your database is not reachable right now: no takeover without it)' };
  const t = (e) => new Date(e.ts).getTime();
  const primaries = engines.filter((e) => e.role === 'primary' && e.service !== me && now - t(e) < TAKEOVER_MS);
  if (primaries.length) return { acting: 'standby', why: `standing by for ${primaries[0].service}` };
  // the primary is silent: the first live standby by name takes over (this one counts as live)
  const live = [...new Set([me, ...engines.filter((e) => (e.role === 'standby' || e.acting === 'primary') && now - t(e) < LIVE_MS).map((e) => e.service)])].sort();
  return live[0] === me
    ? { acting: 'primary', why: 'taking over: no primary has reported for 10 minutes' }
    : { acting: 'standby', why: `the primary is silent; ${live[0]} takes over` };
}

/**
 * May this device send trades right now? Only the acting primary, and (when your devices share a database) only while
 * it has heard from that database within SEND_DB_MS: two devices never sign with the same key at the same time.
 * dbEnabled false = a single device without a shared database (roles do not apply; it is the only sender).
 */
function canSend({ acting, dbEnabled, lastDbOkAt, now = Date.now() }) {
  if (acting !== 'primary') return { ok: false, why: 'standing by: only the acting primary sends' };
  if (!dbEnabled) return { ok: true, why: 'single device' };
  if (!lastDbOkAt || now - lastDbOkAt > SEND_DB_MS) return { ok: false, why: `no word from your database for ${lastDbOkAt ? Math.round((now - lastDbOkAt) / 60000) + ' min' : 'this run yet'}: not sending, so a standby that takes over can never send at the same time` };
  return { ok: true, why: 'primary, database reachable' };
}

module.exports = { read, write, decide, canSend, SEND_DB_MS, ROLES, STANDBY_ENV, STANDBY_INTERVAL_FACTOR, TAKEOVER_MS, LIVE_MS, FILE };
