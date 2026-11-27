'use strict';
// Runs the engine as a background service with PM2 (which you already use), starts it again at phone boot with
// Termux:Boot, and holds a Termux wake lock so Android does not stop it while the screen is off.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const { onPath } = require('./notify.cjs');
const live = require('./live.cjs');

const NAME = 'chronos-engine';
const DATA = live.DATA;
const CONF = path.join(DATA, 'pm2.config.cjs');
const BOOT_DIR = () => path.join(os.homedir(), '.termux', 'boot');
const BOOT_FILE = () => path.join(BOOT_DIR(), 'chronos-engine');

function pm2(args, opts = {}) { return execFileSync(onPath('pm2') || 'pm2', args, { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'], ...opts }); }
function jlist() {
  try { const out = pm2(['jlist']); return JSON.parse(out.slice(out.indexOf('['))); } catch (_) { return null; }
}
function status() {
  const have = !!onPath('pm2');
  const list = have ? jlist() : null;
  const app = list ? list.find((a) => a.name === NAME) : null;
  return {
    pm2: have, installed: !!app, status: app ? app.pm2_env.status : null, restarts: app ? app.pm2_env.restart_time : null,
    uptimeMs: app && app.pm2_env.pm_uptime ? Date.now() - app.pm2_env.pm_uptime : null,
    boot: fs.existsSync(BOOT_FILE()), bootAppReady: fs.existsSync(BOOT_DIR()), wakeLock: !!onPath('termux-wake-lock'),
  };
}
function writeConfig(envFile) {
  fs.mkdirSync(path.join(DATA, 'logs'), { recursive: true });
  const app = {
    name: NAME, script: path.join(live.ROOT, 'bin', 'chronos.cjs'), args: 'daemon', cwd: live.ROOT, interpreter: process.execPath,
    env: { ENV_FILE: envFile || '' }, autorestart: true, restart_delay: 30000, max_restarts: 1000,
    stop_exit_codes: [78], kill_timeout: 8000, time: true, merge_logs: true,
    out_file: path.join(DATA, 'logs', 'engine.out.log'), error_file: path.join(DATA, 'logs', 'engine.err.log'),
  };
  fs.writeFileSync(CONF, `// written by chronos service install\nmodule.exports = { apps: [${JSON.stringify(app, null, 2)}] };\n`, { mode: 0o600 });
  return CONF;
}
function install({ envFile } = {}) {
  const steps = [];
  if (!onPath('pm2')) return { ok: false, steps: [{ ok: false, msg: 'PM2 not found. Install it with: npm install -g pm2   then run: chronos service install' }] };
  const conf = writeConfig(envFile || live.findEnvFile());
  try { pm2(['delete', NAME]); } catch (_) { /* not running yet */ }
  pm2(['start', conf, '--update-env']); steps.push({ ok: true, msg: `PM2 runs ${NAME} (restarts on crash; stops on setup/integrity problems)` });
  try { pm2(['save']); steps.push({ ok: true, msg: 'PM2 process list saved' }); } catch (e) { steps.push({ ok: false, msg: 'pm2 save failed' }); }
  if (fs.existsSync(BOOT_DIR())) {
    const sh = process.env.PREFIX ? path.join(process.env.PREFIX, 'bin', 'sh') : '/bin/sh';
    fs.writeFileSync(BOOT_FILE(), `#!${sh}\n# written by chronos service install: start the engine when the phone boots\ntermux-wake-lock\npm2 resurrect\n`, { mode: 0o700 });
    steps.push({ ok: true, msg: 'starts at phone boot (Termux:Boot)' });
  } else steps.push({ ok: false, warn: true, msg: 'boot start not set: install Termux:Boot (F-Droid), open it once, then run: chronos service install' });
  const wl = onPath('termux-wake-lock');
  if (wl) { try { execFile(wl, [], { timeout: 5000 }, () => {}); steps.push({ ok: true, msg: 'Termux wake lock held (keeps the engine alive with the screen off)' }); } catch (_) { /* optional */ } }
  else steps.push({ ok: false, warn: true, msg: 'termux-wake-lock not found (only exists inside Termux)' });
  return { ok: true, steps, conf };
}
function control(cmd) {
  if (!onPath('pm2')) throw new Error('PM2 not found');
  if (cmd === 'uninstall') { try { pm2(['delete', NAME]); } catch (_) { /* gone */ } try { pm2(['save']); } catch (_) { /* */ } try { fs.unlinkSync(BOOT_FILE()); } catch (_) { /* */ } return 'removed'; }
  if (cmd === 'logs') return pm2(['logs', NAME, '--lines', '60', '--nostream']);
  pm2([cmd, NAME]); return cmd;
}
function statusAsync() {
  return new Promise((resolve) => {
    const bin = onPath('pm2');
    const base = { pm2: !!bin, installed: false, status: null, restarts: null, uptimeMs: null, boot: fs.existsSync(BOOT_FILE()), bootAppReady: fs.existsSync(BOOT_DIR()), wakeLock: !!onPath('termux-wake-lock') };
    if (!bin) return resolve(base);
    execFile(bin, ['jlist'], { timeout: 8000 }, (err, out) => {
      if (err) return resolve(base);
      try { const app = JSON.parse(out.slice(out.indexOf('['))).find((a) => a.name === NAME); if (!app) return resolve(base); resolve({ ...base, installed: true, status: app.pm2_env.status, restarts: app.pm2_env.restart_time, uptimeMs: app.pm2_env.pm_uptime ? Date.now() - app.pm2_env.pm_uptime : null }); } catch (_) { resolve(base); }
    });
  });
}
function restartIfRunning() { const s = status(); if (s.installed && s.status === 'online') { try { pm2(['restart', NAME, '--update-env']); return true; } catch (_) { return false; } } return false; }
/**
 * Ask PM2 to restart the engine without waiting for it (PM2 can take many seconds on a phone, which looked like a
 * frozen terminal): → 'requested' | 'not running' | 'no pm2'. The engine loads the new .env when it comes back.
 */
function restartSoon() {
  const bin = onPath('pm2'); if (!bin) return 'no pm2';
  const s = status(); if (!(s.installed && s.status === 'online')) return 'not running';
  try { const c = require('child_process').spawn(bin, ['restart', NAME, '--update-env'], { detached: true, stdio: 'ignore' }); c.unref(); return 'requested'; } catch (_) { return 'not running'; }
}
module.exports = { status, statusAsync, install, control, restartIfRunning, restartSoon, NAME, CONF };
