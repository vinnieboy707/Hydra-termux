'use strict';
// Pre-coded resolutions for every known problem. Each one is either AUTOMATIC (safe and reversible: the engine does it
// by itself and records it) or NEEDS YOU (keys, approvals, deploys, code), in which case the engine alerts you with
// the exact command and the guide section. Death loops are broken here: a crash-restart loop puts the engine in safe
// mode (shadow only, slower, fewer moving parts) until it has run cleanly; repeated scan failures re-initialise, then
// back off; the watchdog's restarts are capped (lib/agents.cjs).
const fs = require('fs');
const path = require('path');
const { redact } = require('./safety.cjs');

const MIN = 60000;
// crash loop: this many unclean starts within the window → safe mode, held until it has run cleanly this long
const CRASH = { starts: 4, windowMs: 10 * MIN, holdMs: 30 * MIN };
// scan failures in a row: re-initialise at REINIT, back off from BACKOFF, alert you at ALERT
const SCAN = { REINIT: 3, BACKOFF: 6, ALERT: 10, MAX_INTERVAL_S: 300 };

/** id → how it is resolved. auto: what the engine does by itself; you: what only you can do (null when nothing) */
const REMEDIES = {
  'settings-missing': { auto: null, you: 'chronos setup, then chronos doctor' },
  'nodes-down': { auto: 're-initialises the chain connection after 3 failed scans, then backs off (up to 5 min between scans) so a dead node is not hammered', you: 'fix the url in chronos setup or add ARB_RPC_URL_2' },
  'device-unenrolled': { auto: 'creates this device\'s key and asks to join at engine start', you: 'approve the pairing code in the portal' },
  'device-pending': { auto: 'keeps checking and starts reporting the moment you approve', you: 'portal → Devices → approve' },
  'integrity': { auto: 'refuses to run or send with changed code', you: 'chronos update (reinstalls the verified release) or re-seal a deliberate change' },
  'foreign-files': { auto: 'reports them; never runs them', you: 'move them out of the Chronos folder' },
  'engine-down': { auto: 'the service manager restarts it; a crash loop switches it to safe mode instead of spinning', you: 'chronos service install (first time) or chronos service start' },
  'scans-stale': { auto: 'the watchdog restarts a stalled engine (at most 3 times an hour), then stops and alerts you', you: 'chronos service status, then chronos service restart' },
  'scan-error': { auto: 're-initialises after 3 failures in a row, backs off after 6, alerts you after 10', you: 'read the message; chronos doctor' },
  'no-wss': { auto: 're-checks on a timer instead of every block', you: 'chronos set ARBITRUM_WSS_URL' },
  'no-executor': { auto: 'stays in shadow (tests your contract, sends nothing)', you: 'run cloud/gcp-setup.sh, then set the executor address and KMS key' },
  'no-contract': { auto: 'stays in shadow', you: 'chronos deploy' },
  'no-wallets': { auto: 'payout refuses to run without them', you: 'chronos set TAX_RESERVE_VAULT and PAYOUT_WALLET_ADDRESS' },
  'broken-pools': { auto: 'from 2.9.6 a pool priced more than 20% from the Aave oracle (or its other pools) is left out of routing', you: 'chronos update on every device; nothing else to do' },
  'nothing-approved': { auto: 'keeps scanning every block; shows what each filter blocked', you: 'change a limit only deliberately; chronos research shows what wins on-chain' },
  'crash-loop': { auto: 'safe mode: shadow only, websocket feed and fast lane off, no token discovery, 4× slower scans, until 30 min without a crash', you: 'chronos assist shows the crash cause; fix it, then chronos service restart' },
};

const startsFile = (dir) => path.join(dir, 'live', 'starts.json');
function readStarts(dir) { try { return JSON.parse(fs.readFileSync(startsFile(dir), 'utf8')); } catch (_) { return { starts: [], lastCrash: null, safeUntil: 0 }; } }
function saveStarts(dir, s) { fs.mkdirSync(path.join(dir, 'live'), { recursive: true }); fs.writeFileSync(startsFile(dir), JSON.stringify(s), { mode: 0o600 }); }

/**
 * Called once at engine start. An earlier start that never recorded a clean exit counts as a crash. Returns
 * { safeMode, crashes, cause } where cause is the last recorded crash message (redacted).
 */
function onStart(dir, now = Date.now()) {
  const s = readStarts(dir);
  const crashes = s.starts.filter((x) => !x.clean && now - x.at <= CRASH.windowMs).length;
  if (crashes >= CRASH.starts) s.safeUntil = now + CRASH.holdMs;
  s.starts = [...s.starts.slice(-19), { at: now, clean: false }];
  saveStarts(dir, s);
  return { safeMode: now < (s.safeUntil || 0), crashes, cause: s.lastCrash || null, until: s.safeUntil || 0 };
}
/** a clean stop (signal, restart request, setup exit): not a crash */
function onCleanExit(dir) { const s = readStarts(dir); if (s.starts.length) s.starts[s.starts.length - 1].clean = true; saveStarts(dir, s); }
/** an uncaught error: recorded so the next start (and chronos assist) can say why */
function onCrash(dir, err, now = Date.now()) { const s = readStarts(dir); s.lastCrash = { at: now, msg: redact(String((err && (err.stack || err.message)) || err)).split('\n').slice(0, 3).join(' | ').slice(0, 300) }; saveStarts(dir, s); }

/** what to do after `n` scan failures in a row, given the normal interval (seconds) */
function scanFailure(n, baseInterval) {
  return {
    reinit: n === SCAN.REINIT || (n > SCAN.REINIT && (n - SCAN.REINIT) % SCAN.REINIT === 0),
    interval: n >= SCAN.BACKOFF ? Math.min(SCAN.MAX_INTERVAL_S, baseInterval * 2 ** Math.min(6, n - SCAN.BACKOFF + 1)) : baseInterval,
    alert: n === SCAN.ALERT,
  };
}

/** safe-mode settings: fewer moving parts, never sends */
function safeConfig(cfg) { return { ...cfg, DISCOVER_TOKENS: 0, HOT_SCAN_MS: 0, SAFE_MODE: true }; }

module.exports = { REMEDIES, CRASH, SCAN, onStart, onCleanExit, onCrash, scanFailure, safeConfig, readStarts };
