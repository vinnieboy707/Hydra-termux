'use strict';
// Pulls ONLY env-style files from your Google Drive onto this phone, using the rclone "gdrive:" remote your own
// scripts/google_sources_sync.cjs already uses. They land in ~/.chronos/drive_pull (0700, outside your workspace so
// no backup script re-uploads them), get imported, and are deleted again. Nothing passes through any chat.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { onPath } = require('./notify.cjs');

// a pattern with no "/" matches a file at any depth, the top of your Drive included ("**/.env" missed a top-level .env)
const INCLUDE = ['.env', '.env.*', '*.env', '*.env.txt', '*ENV SECRETS*', '**/env_sources/**'];
const EXCLUDE = ['**/node_modules/**', '**/.git/**', '**/*.example', '**/*.example.*'];

function run(bin, args, timeout) {
  return new Promise((resolve) => execFile(bin, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => resolve({ err, stdout: String(stdout || ''), stderr: String(stderr || '') })));
}
// flags for every Drive copy: list the Drive in one pass (much faster on a big Drive), stay under Google's request
// limits, download files Google flags as "abusive" (it refuses them otherwise), skip broken shortcuts
const COMMON = ['--fast-list', '--tpslimit', '8', '--drive-acknowledge-abuse', '--drive-skip-shortcuts', '--drive-skip-dangling-shortcuts', '--drive-export-formats', 'txt', '--ignore-case', '--stats', '0'];

/**
 * What went wrong, in words, with the fix (rclone's own last error line is kept, secrets removed). Harmless problems
 * (two files with the same name, a Google file that cannot be exported) are not failures: everything else arrived.
 */
function explain(r, timeoutMs, folder = null) {
  const all = `${r.stderr}\n${r.err ? r.err.message : ''}`;
  const pick = (t) => (String(t || '').split(/\r?\n/).filter((l) => /ERROR|Failed|error/i.test(l)).pop() || '').replace(/^.*?(ERROR|Failed)/, '$1');
  const last = pick(r.stderr) || pick(r.err && r.err.message); // rclone's own line first, Node's wrapper only if there is none
  // anything that looks like a credential is cut out before it is shown (key=…, token=…, long opaque strings)
  const detail = require('./safety.cjs').redact(last).replace(/\b(key|token|secret|password|access_token|refresh_token)\s*[=:]\s*\S+/gi, '$1=…').replace(/\b[A-Za-z0-9_\-]{24,}\b/g, '…').slice(0, 160);
  if (r.err && (r.err.killed || r.err.signal === 'SIGTERM')) return { fatal: true, why: `Drive took over ${Math.round(timeoutMs / 60000)} min to list (a large Drive). Fix: chronos set CHRONOS_DRIVE_ENV_FOLDER "<the Drive folder that holds your env files>"` };
  if (/invalid_grant|token.*(expired|revoked)|couldn't fetch token|oauth2: cannot fetch token|unauthenticated|401/i.test(all)) return { fatal: true, why: 'your Drive sign-in for rclone expired. Fix: rclone config reconnect gdrive: (then sign in once in the browser)' };
  if (/rateLimitExceeded|userRateLimitExceeded|quotaExceeded|429/i.test(all)) return { fatal: false, why: 'Google limited the requests for a moment; anything missed comes on the next update' };
  if (folder && /directory not found/i.test(all)) return { fatal: true, why: 'the Drive folder set in CHRONOS_DRIVE_ENV_FOLDER does not exist. Fix: chronos set CHRONOS_DRIVE_ENV_FOLDER with the exact folder name' };
  if (/Using --filter is recommended/i.test(all) && !/ERROR : (?!Using --filter)/.test(all)) return { fatal: false, why: 'rclone warned about filter order (fixed in 2.9.18: Chronos now passes ordered --filter rules)' };
  if (/Duplicate object found|duplicate/i.test(all)) return { fatal: false, why: 'two Drive files share a name (one copy used); harmless' };
  if (/cannotDownloadAbusiveFile|exportSizeLimitExceeded|can't export|not exportable/i.test(all)) return { fatal: false, why: 'a Google file could not be exported; it is not an env file and was skipped' };
  if (/no such host|network is unreachable|dial tcp|i\/o timeout|connection refused/i.test(all)) return { fatal: false, why: 'no connection to Google Drive right now; it tries again on the next update' };
  return { fatal: true, why: `rclone: ${detail || 'failed without a message'}. Details: ~/.chronos/logs/rclone.log` };
}
/**
 * rclone filter rules in a fixed order (2.9.18): every exclusion first, then what to take, then "- **" for the rest.
 * Passing --include and --exclude together leaves their order undefined; rclone reports it as an ERROR and the pull
 * arrived empty (the "rclone: ERROR : Using --filter is recommended…" warning on every update).
 */
function filters(exclude, include) { return [...exclude.map((x) => ['--filter', '- ' + x]), ...include.map((x) => ['--filter', '+ ' + x]), ['--filter', '- **']].flat(); }
function remoteWith(remote, folder) { const f = String(folder || '').trim().replace(/^\/+|\/+$/g, ''); return f ? `${remote}${f}` : remote; }
function logTo() { const d = path.join(os.homedir(), '.chronos', 'logs'); try { fs.mkdirSync(d, { recursive: true, mode: 0o700 }); } catch (_) { /* */ } return path.join(d, 'rclone.log'); }
async function remoteReady(remote = 'gdrive:') {
  const bin = onPath('rclone');
  if (!bin) return { ok: false, why: 'Drive not linked (optional: rclone is not installed; keys on this device were searched instead)' };
  const r = await run(bin, ['listremotes'], 15000);
  if (r.err) return { ok: false, why: 'rclone listremotes failed' };
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).includes(remote) ? { ok: true, bin } : { ok: false, why: `Drive not linked (optional: keys on this device were searched instead; to add Drive, rclone config → name it gdrive)` };
}
async function pullEnvFiles({ remote = 'gdrive:', timeoutMs = 240000, folder = process.env.CHRONOS_DRIVE_ENV_FOLDER, runImpl = null } = {}) {
  const ready = runImpl ? { ok: true, bin: 'rclone' } : await remoteReady(remote);
  if (!ready.ok) return { ok: false, skipped: true, why: ready.why, files: [] };
  const dir = path.join(os.homedir(), '.chronos', `drive_pull_${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const args = ['copy', remoteWith(remote, folder), dir, ...COMMON, '--max-size', '512k', '--retries', '2', '--low-level-retries', '3', '--log-file', logTo(), '--log-level', 'ERROR'];
  args.push(...filters(EXCLUDE, INCLUDE));
  const r = await (runImpl || run)(ready.bin, args, timeoutMs);
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  try { walk(dir); } catch (_) { /* empty */ }
  for (const f of files) { try { fs.chmodSync(f, 0o600); } catch (_) { /* best effort */ } }
  if (!r.err) return { ok: true, dir, files, why: null, args };
  const x = explain(r, timeoutMs, folder);
  return { ok: !x.fatal || files.length > 0, dir, files, why: x.why + (x.fatal && files.length ? ' (some files arrived and were used)' : ''), fatal: x.fatal, args };
}
/**
 * Your Drive documents for the VP's archive (chronos archive sync): Markdown, text and code files, and Google Docs
 * exported as text, into ~/.chronos/archive/drive (kept; refreshed each sync). Never: env/secret/password/wallet/key
 * files, archives, files you marked "DELETE - ", anything over 1 MB. Indexed by lib/knowledge.cjs with secrets redacted.
 */
async function pullArchive({ remote = 'gdrive:', timeoutMs = 300000 } = {}) {
  const ready = await remoteReady(remote);
  if (!ready.ok) return { ok: false, skipped: true, why: ready.why, files: [] };
  const dir = path.join(os.homedir(), '.chronos', 'archive', 'drive'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const args = ['copy', remote, dir, ...COMMON, '--max-size', '1M', '--retries', '2', '--log-file', logTo(), '--log-level', 'ERROR'];
  args.push(...filters([...EXCLUDE, '**/.env*', '**/*env*', '**/*secret*', '**/*passw*', '**/*wallet*', '**/*key*', '**/*mnemonic*', '**/*seed*', '**/*credential*', '**/DELETE - *', '**/*.gz', '**/*.zip', '**/*.tar*'], ['**/*.md', '**/*.txt', '**/*.sol', '**/*.ts', '**/*.js', '**/*.py', '**/*.yaml', '**/*.yml']));
  const r = await run(ready.bin, args, timeoutMs);
  const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  try { walk(dir); } catch (_) { /* empty */ }
  for (const f of files) { try { fs.chmodSync(f, 0o600); } catch (_) { /* best effort */ } }
  if (!r.err) return { ok: true, dir, files, why: null };
  const x = explain(r, timeoutMs);
  return { ok: !x.fatal || files.length > 0, dir, files, why: x.why };
}
function cleanup(dir) { if (dir && dir.includes(`${path.sep}.chronos${path.sep}drive_pull_`)) fs.rmSync(dir, { recursive: true, force: true }); }
module.exports = { pullEnvFiles, pullArchive, cleanup, remoteReady, explain, filters, INCLUDE, COMMON };
