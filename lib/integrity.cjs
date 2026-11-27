'use strict';
// Tamper / accident protection for the console's own code.
//  seal()   records a SHA-256 of every code file, the bundled library archive and every runtime library installed
//           from the lockfile (ethers and its dependencies) in SEAL.json
//  verify() recomputes them; any change, missing or extra code file is reported and the console refuses to start
//  lock()   makes code files read-only so an accidental edit or `>` redirect fails; unlock() reverses it
//  tidy()   at install time only: moves files an older version left behind out of the code folders
// This protects against accidents and casual tampering on your own device. Someone with your phone unlocked and
// shell access could still unlock and re-seal; that is the honest limit of any local check.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SEAL = path.join(ROOT, 'SEAL.json');
const CODE_DIRS = ['bin', 'lib', 'tui'];
const CODE_FILES = ['scan.cjs', 'measure.cjs', 'registry_audit.cjs', 'calibrate_gas.cjs', 'venues.json', 'package.json', 'package-lock.json', 'contract_abi.json', 'install.sh', 'go.sh', 'vendor/deps.tgz', 'vendor/build-deps.sh', 'cloud/gcp-setup.sh', 'cloud/mainnet-cloud.sh', 'server/schema.sql', 'server/functions/ingest/index.ts', 'server/functions/ingest/auth.ts', 'server/functions/vault/index.ts', 'server/functions/vault/auth.ts', 'sync/workspace-sync.sh', 'sync/laptop-setup.sh', 'server/DEPLOYED.json', 'server/functions/decisions/index.ts', 'server/functions/decisions/auth.ts', 'server/functions/release/index.ts', 'server/functions/alerts/index.ts', 'server/functions/alerts/auth.ts', 'server/functions/insights/index.ts', 'server/functions/insights/auth.ts', 'contract/ChronosFlashArb.json', 'contract/ChronosFlashArb.sol', 'contract/ChronosFlashArbV2.json', 'contract/ChronosFlashArbV2.sol', 'contracts/v2/ChronosFlashArbV2.json', 'contracts/v2/ForkProbe.json', 'contracts/v2/real.json'];

// Symbolic links are listed too (and hashed as links, never followed), so a link slipped into the code folders
// shows up as an unexpected file instead of being silently skipped.
function walk(dir, out = [], skip = () => false) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!skip(e.name)) walk(p, out, skip); } else if (e.isFile() || e.isSymbolicLink()) out.push(p);
  }
  return out;
}
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
function codeFiles() {
  const files = [];
  for (const d of CODE_DIRS) if (fs.existsSync(path.join(ROOT, d))) files.push(...walk(path.join(ROOT, d)));
  for (const f of CODE_FILES) { try { fs.lstatSync(path.join(ROOT, f)); files.push(path.join(ROOT, f)); } catch (_) { /* not shipped in this copy */ } }
  return files.map(rel).sort();
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function content(p) { const st = fs.lstatSync(p); return st.isSymbolicLink() ? Buffer.from('symlink:' + fs.readlinkSync(p)) : fs.readFileSync(p); }

// Runtime libraries = every package the lockfile marks as not dev-only (ethers and what it loads).
function depPackages() {
  let lock;
  try { lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')); } catch (_) { return []; }
  return Object.entries(lock.packages || {}).filter(([k, v]) => k.startsWith('node_modules/') && !v.dev).map(([k]) => k).sort();
}
function depsDigest() {
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'ethers'))) return null;
  const pkgs = depPackages().filter((k) => fs.existsSync(path.join(ROOT, k)));
  const h = crypto.createHash('sha256');
  for (const k of pkgs) {
    // nested node_modules are separate lockfile entries and are hashed on their own
    for (const f of walk(path.join(ROOT, k), [], (name) => name === 'node_modules').sort()) { h.update(rel(f) + '\0'); h.update(content(f)); h.update('\0'); }
  }
  return { digest: h.digest('hex'), packages: pkgs.length };
}
function compute() {
  const files = {};
  for (const f of codeFiles()) files[f] = sha(content(path.join(ROOT, f)));
  return { files, deps: depsDigest() };
}
// Every file in the folder except your data, installed libraries and the seal itself. Recorded at seal time as the
// set the release shipped; anything that appears later is reported as foreign (it is not Chronos code).
const NOT_SHIPPED = /^(data|node_modules|\.git)(\/|$)|^SEAL\.json$|^test\/\.mutant-in-progress\.json$/;
function allFiles() {
  const out = [];
  const go = (d) => { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of es) { const p = path.join(d, e.name); const r = rel(p); if (NOT_SHIPPED.test(r)) continue; if (e.isDirectory()) go(p); else out.push(r); } };
  go(ROOT);
  return out.sort();
}
function seal() {
  const c = compute();
  fs.writeFileSync(SEAL, JSON.stringify({ sealedAt: new Date().toISOString(), node: process.version, ...c, shipped: allFiles() }, null, 2) + '\n');
  return c;
}
function verify() {
  let s;
  try { s = JSON.parse(fs.readFileSync(SEAL, 'utf8')); } catch (_) { return { ok: false, sealed: false, changed: [], missing: [], added: [], deps: null, depsSealed: false, depsInstalled: false, depsCount: 0, count: 0 }; }
  const c = compute();
  const changed = [], missing = [], added = [];
  for (const [f, h] of Object.entries(s.files || {})) { if (!(f in c.files)) missing.push(f); else if (c.files[f] !== h) changed.push(f); }
  for (const f of Object.keys(c.files)) if (!(f in (s.files || {}))) added.push(f);
  // files in the Chronos folder that the release did not ship (an older seal without the list reports none)
  const shipped = Array.isArray(s.shipped) ? new Set(s.shipped) : null;
  const foreign = shipped ? allFiles().filter((f) => !shipped.has(f)) : [];
  const sd = s.deps && s.deps.digest;
  const deps = sd && (!c.deps || c.deps.digest !== sd) ? 'installed libraries (node_modules) differ from the sealed copy · reinstall with: sh install.sh' : null;
  return { ok: !changed.length && !missing.length && !added.length && !deps, sealed: true, foreign, depsSealed: !!sd, depsInstalled: !!c.deps, depsCount: c.deps ? c.deps.packages : 0, sealedAt: s.sealedAt, changed, missing, added, deps, count: Object.keys(c.files).length };
}
function setMode(readOnly) {
  for (const f of codeFiles().concat(['SEAL.json'])) {
    const p = path.join(ROOT, f);
    let st; try { st = fs.lstatSync(p); } catch (_) { continue; }
    if (st.isSymbolicLink()) continue; // never follow a link out of the folder
    const exec = f.startsWith('bin/') || f.endsWith('.sh');
    fs.chmodSync(p, readOnly ? (exec ? 0o555 : 0o444) : (exec ? 0o755 : 0o644));
  }
}
// Install-time only, after extracting a new version over an old one: files the new seal does not list are moved
// (not deleted) to data/leftovers-<time>/. Refuses to touch anything if a sealed file is changed or missing.
function tidy(dataDir = process.env.CHRONOS_DATA_DIR || path.join(ROOT, 'data')) {
  const v = verify();
  if (!v.sealed || v.changed.length || v.missing.length || !v.added.length) return { moved: [], dest: null, v };
  const dest = path.join(dataDir, 'leftovers-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14));
  for (const f of v.added) {
    const from = path.join(ROOT, f), to = path.join(dest, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    try { fs.renameSync(from, to); } catch (e) { if (e.code !== 'EXDEV') throw e; fs.copyFileSync(from, to); fs.unlinkSync(from); }
  }
  return { moved: v.added, dest, v: verify() };
}
module.exports = { seal, verify, tidy, allFiles, lock: () => setMode(true), unlock: () => setMode(false), codeFiles, depPackages, ROOT };
