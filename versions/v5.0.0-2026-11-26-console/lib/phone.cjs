'use strict';
// `chronos phone`: keeps the engine running on an Android phone, checked and fixed in one go.
// Why it is needed: the engine runs under PM2 inside Termux. When Android closes Termux (swiped away, battery
// optimisation, low memory), PM2 and the engine die with it, and nothing brings them back until the phone reboots
// (and only with Termux:Boot). So:
//   1. engine running under PM2 (started if not)
//   2. a hook in ~/.bashrc: every time Termux opens, a stopped engine is started again (in the background, instantly)
//   3. Termux wake lock held (CPU stays on with the screen off)
//   4. Termux:Boot: starts the engine when the phone boots
//   5. battery: Termux set to "Unrestricted" (opens the Android screen; only you can flip it)
//   6. Termux:API: notifications on the phone
//   7. the engine is reaching your portal (heartbeat sent and accepted in the last few minutes)
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK_START = '# >>> chronos: keep the engine running (written by chronos phone) >>>';
const HOOK_END = '# <<< chronos <<<';
const HOOK = `${HOOK_START}
if command -v pm2 >/dev/null 2>&1; then
  ( ( pm2 pid chronos-engine 2>/dev/null | grep -q '^[1-9]' || { termux-wake-lock 2>/dev/null; pm2 resurrect >/dev/null 2>&1; } ) >/dev/null 2>&1 & ) # silent: no job notice
fi
${HOOK_END}`;

/** the ~/.bashrc text with exactly one current hook (replaces an older one; everything else untouched) */
function withHook(text) {
  const t = text || '';
  const a = t.indexOf(HOOK_START), b = t.indexOf(HOOK_END);
  const rest = a >= 0 && b > a ? t.slice(0, a) + t.slice(b + HOOK_END.length).replace(/^\n/, '') : t;
  return (rest && !rest.endsWith('\n') ? rest + '\n' : rest) + HOOK + '\n';
}

/**
 * d (injectable): service → { status(), install() }, run(cmd, args) → exit code, onPath(bin), home, state() → engine
 * state file or null, now, ask(question) → boolean, log(text), openBattery() → boolean
 * Returns checks: [{ name, ok, fixed, todo }]
 */
async function checkPhone(d) {
  const out = []; const add = (name, ok, extra = {}) => { const c = { name, ok, ...extra }; out.push(c); d.log(`  ${ok ? '✓' : c.todo ? '!' : '✗'} ${name}${c.fixed ? ' — ' + c.fixed : ''}${c.todo ? ' — ' + c.todo : ''}`); return c; };

  // 1. engine under PM2
  let s = d.service.status();
  if (!s.pm2) add('engine supervisor (PM2)', false, { todo: 'npm install -g pm2, then chronos phone again' });
  else if (s.status === 'online') add('engine running', true, { fixed: s.uptimeMs ? `up ${Math.round(s.uptimeMs / 60000)} min` : '' });
  else {
    const r = d.service.install();
    s = d.service.status();
    add('engine running', s.status === 'online', s.status === 'online' ? { fixed: 'it was stopped; started it now' } : { todo: (r.steps || []).filter((x) => !x.ok).map((x) => x.msg).join('; ') || 'chronos service install' });
  }

  // 2. restart hook in ~/.bashrc
  const rc = path.join(d.home, '.bashrc');
  const before = fs.existsSync(rc) ? fs.readFileSync(rc, 'utf8') : '';
  const after = withHook(before);
  if (after !== before) { fs.writeFileSync(rc, after, { mode: 0o600 }); add('engine restarts whenever you open Termux', true, { fixed: 'added to ~/.bashrc' }); }
  else add('engine restarts whenever you open Termux', true);

  // 3. wake lock
  if (d.onPath('termux-wake-lock')) { d.run('termux-wake-lock', []); add('wake lock held (runs with the screen off)', true); }
  else add('wake lock', false, { todo: 'only available inside Termux' });

  // 4. Termux:Boot
  if (s.boot) add('starts when the phone boots (Termux:Boot)', true);
  else if (s.bootAppReady) { d.service.install(); add('starts when the phone boots (Termux:Boot)', d.service.status().boot, { fixed: 'set up' }); }
  else add('starts when the phone boots', false, { todo: 'install Termux:Boot from F-Droid (same source as Termux), open it once, then chronos phone again' });

  // 5. battery optimisation (Android only lets you change it)
  if (d.onPath('termux-wake-lock') && await d.ask('Open Android battery settings so you can set Termux to "Unrestricted" (Android otherwise closes it and the engine with it)?')) {
    const opened = d.openBattery();
    add('battery: Android settings for Termux', opened, opened ? { fixed: 'opened: choose Termux → Unrestricted (or "Don\'t optimise"); only you can switch it' } : { todo: 'Settings → Apps → Termux → Battery → Unrestricted' });
  } else add('battery: Termux unrestricted', false, { todo: 'Settings → Apps → Termux → Battery → Unrestricted' });

  // 6. Termux:API for notifications
  add('phone notifications (Termux:API)', !!d.onPath('termux-notification'), d.onPath('termux-notification') ? {} : { todo: 'install the Termux:API app (F-Droid) and run: pkg install termux-api' });

  // 7. reaching the portal: the engine's own state shows a recent accepted send
  const st = d.state();
  const sy = st && st.sync;
  if (!st || !st.heartbeat || d.now - st.heartbeat > 120000) add('engine reaching your portal', false, { todo: 'the engine has not written its state in the last 2 minutes; give it a minute after starting, then chronos phone again' });
  else if (!sy || !sy.lastOk) add('engine reaching your portal', false, { todo: sy && sy.lastErr ? `last error: ${sy.lastErr}` : 'nothing sent yet; give it a minute' });
  else add('engine reaching your portal', d.now - sy.lastOk < 300000, d.now - sy.lastOk < 300000 ? { fixed: `last accepted ${Math.round((d.now - sy.lastOk) / 1000)} s ago${sy.rejected ? ` · ${sy.rejected} row(s) refused and set aside` : ''}` } : { todo: `last accepted ${Math.round((d.now - sy.lastOk) / 60000)} min ago${sy.lastErr ? ': ' + sy.lastErr : ''}` });
  return out;
}

function realDeps({ ask }) {
  const live = require('./live.cjs');
  const { onPath } = require('./notify.cjs');
  const { spawnSync } = require('child_process');
  return {
    service: require('./service.cjs'), onPath, home: os.homedir(), now: Date.now(), ask, log: (s) => process.stdout.write(s + '\n'),
    run: (cmd, args) => { const r = spawnSync(onPath(cmd) || cmd, args, { stdio: 'ignore', timeout: 15000 }); return r.status; },
    state: () => { try { return JSON.parse(fs.readFileSync(path.join(live.DATA, 'live', 'state.json'), 'utf8')); } catch (_) { return null; } },
    openBattery: () => { const am = onPath('am'); if (!am) return false; return spawnSync(am, ['start', '-a', 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'], { stdio: 'ignore', timeout: 15000 }).status === 0; },
  };
}

module.exports = { checkPhone, withHook, realDeps, HOOK_START, HOOK_END };
