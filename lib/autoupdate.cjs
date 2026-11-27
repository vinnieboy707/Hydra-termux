'use strict';
// Automatic updates on the phone. When your release service has a newer release (published only by a device you
// allowed to publish, signed by it, sha256-checked on download), the engine runs the same installer as
// `chronos update` (go.sh) in the background: it downloads and verifies the archive, installs it over this one keeping
// your .env and data/, reseals the code and restarts the engine. Contract changes are never part of an update (they
// need chronos deploy and your YES). Off with CHRONOS_AUTO_UPDATE=off (then you are only notified). Not on the cloud
// engine (it is installed from your Cloud Storage bucket by gcp-setup.sh): there you are notified.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/** → { install: boolean, why } */
function decide({ env, termux, busy, lastTried, version }) {
  if ((env('CHRONOS_AUTO_UPDATE') || 'on') === 'off') return { install: false, why: 'automatic updates are off (CHRONOS_AUTO_UPDATE=off)' };
  if (!termux) return { install: false, why: 'this engine is not on your phone (the cloud engine updates when you run gcp-setup.sh again)' };
  if (busy) return { install: false, why: 'a trade is in flight; trying again next hour' };
  if (lastTried === version) return { install: false, why: 'an automatic install of this version already ran; if it did not finish, run chronos update' };
  return { install: true, why: '' };
}

/** a private copy of go.sh to run, outside the folder the install overwrites */
function runnableCopy(root, dataDir) {
  const to = path.join(dataDir, 'go-run.sh');
  fs.copyFileSync(path.join(root, 'go.sh'), to); fs.chmodSync(to, 0o700);
  return to;
}

/** starts go.sh detached (it outlives this engine's restart); its output goes to data/update.log */
function install({ root, dataDir, spawnImpl = spawn }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const out = fs.openSync(path.join(dataDir, 'update.log'), 'a', 0o600);
  const script = runnableCopy(root, dataDir); // the install replaces go.sh: never run a file that is being overwritten
  // no terminal attached: go.sh skips its interactive steps by itself
  const child = spawnImpl('sh', [script], { detached: true, stdio: ['ignore', out, out] });
  child.unref();
  return child;
}

/**
 * A newer Chronos archive you saved into Downloads (phone only): → { file, version } or null. The engine then shows a
 * notification with an Install button (one tap runs chronos update, which checks the archive's seal, installs it and
 * publishes it for your other devices). Never installed without that tap: any app can write into Downloads.
 */
function newerDownload({ home, current, cmp, versionOf }) {
  const dirs = [path.join(home, 'storage', 'downloads'), '/sdcard/Download'];
  let best = null;
  for (const d of dirs) {
    let names = []; try { names = fs.readdirSync(d).filter((f) => /^chronos-console.*\.tgz$/.test(f)); } catch (_) { continue; }
    for (const f of names) {
      let v = null; try { v = versionOf(path.join(d, f)); } catch (_) { v = null; }
      if (v && cmp(v, current) > 0 && (!best || cmp(v, best.version) > 0)) best = { file: path.join(d, f), version: v };
    }
  }
  return best;
}

module.exports = { decide, install, runnableCopy, newerDownload };
