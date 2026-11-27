'use strict';
// Finds API keys already sitting in env-style files on this device (your workspace, Drive-synced folders,
// Downloads) so you do not have to paste them again. Values stay on the device: nothing is printed or sent,
// except the single test call each key gets before it is saved.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseEnvFile } = require('./config.cjs');

const SKIP_DIRS = new Set(['node_modules', '.git', '.cache', '.npm', '.local', 'artifacts', 'cache', 'coverage', '_quarantine', 'logs']);
const NAME_RE = [/^\.env(\..+)?$/i, /\.env$/i, /\.env\.txt$/i, /^env(\.txt)?$/i, /secrets?.*\.(txt|env)$/i];
const DRIVE_HINT = /gdrive|google.?drive|env_sources|[\\/]Download[\\/]|storage[\\/]downloads/i;

function candidateFiles({ home = os.homedir(), extra = [], exclude = [] } = {}) {
  const found = new Set();
  const ex = new Set(exclude.map((f) => path.resolve(f)));
  const walk = (dir, depth) => {
    if (depth < 0) return;
    let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of es) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('chronos-console')) walk(p, depth - 1); continue; }
      if (!e.isFile() || /\.bak-\d/.test(e.name) || /\.example$/i.test(e.name)) continue;
      if (NAME_RE.some((re) => re.test(e.name)) || (/env_sources/i.test(dir) && /\.(txt|env)$/i.test(e.name))) {
        try { if (fs.statSync(p).size < 512 * 1024 && !ex.has(path.resolve(p))) found.add(p); } catch (_) { /* skip */ }
      }
    }
  };
  walk(home, 5);
  // a file named directly (CHRONOS_IMPORT_FROM) is read whatever its name; a folder is searched two levels deep
  for (const d of ['/sdcard/Download', path.join(home, 'storage', 'downloads'), path.join(home, 'Downloads'), ...extra]) {
    let st = null; try { st = fs.statSync(d); } catch (_) { continue; }
    if (st.isFile()) { if (st.size < 512 * 1024 && !ex.has(path.resolve(d))) found.add(d); } else walk(d, 2);
  }
  return [...found].sort();
}

/** For each wanted key: the distinct values found and which files hold them. */
function scan(wantedKeys, opts) {
  const files = candidateFiles(opts);
  const byKey = {};
  for (const f of files) {
    const env = parseEnvFile(f);
    for (const k of wantedKeys) {
      const v = env[k];
      if (!v || /^(your|xxx|changeme|<|\$\{)/i.test(v) || /\s/.test(v)) continue; // placeholders and junk are ignored
      byKey[k] = byKey[k] || new Map();
      if (!byKey[k].has(v)) byKey[k].set(v, []);
      byKey[k].get(v).push(f);
    }
  }
  const result = {};
  for (const [k, m] of Object.entries(byKey)) result[k] = [...m.entries()].map(([value, sources]) => ({ value, sources, fromDrive: sources.some((s) => DRIVE_HINT.test(s)) }));
  return { files, result };
}
module.exports = { scan, candidateFiles, DRIVE_HINT };
