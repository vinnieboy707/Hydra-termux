'use strict';
// One workspace on every device (sync/workspace-sync.sh): when your .env changes because you edited it on another
// device, the engine here notices within 10 s, checks the new file, and restarts itself with it. A file that does not
// parse, or that lost a required setting, is not applied: the engine keeps running on what it has and tells you.
// Only a real change of a value restarts it (a sync that rewrites identical text does nothing), and changes that come
// in quick succession are applied once, 15 s after the last one.
const fs = require('fs');
const crypto = require('crypto');

const REQUIRED = ['MIN_NET_PROFIT_USD', 'SIZE_LADDER_USD'];
const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

/** the file's settings as a stable fingerprint, or { error } */
function read(file) {
  let text; try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return { error: 'cannot read the settings file' }; }
  const vals = {};
  for (const l of text.split('\n')) { if (/^\s*(#|$)/.test(l)) continue; const m = l.match(LINE); if (!m) return { error: 'a line is not KEY=value' }; vals[m[1]] = m[2].trim(); }
  const missing = REQUIRED.filter((k) => !vals[k]);
  if (missing.length) return { error: `missing ${missing.join(', ')}` };
  const keys = Object.keys(vals).sort();
  return { hash: crypto.createHash('sha256').update(keys.map((k) => `${k}=${vals[k]}`).join('\n')).digest('hex'), keys: keys.length };
}

class SettingsWatch {
  /** file: the .env · onChange(): restart · tell(title, text) · now, everyMs, settleMs: tests */
  constructor({ file, onChange, tell = () => {}, now = () => Date.now(), everyMs = 10000, settleMs = 15000 }) {
    this.file = file; this.onChange = onChange; this.tell = tell; this.now = now; this.everyMs = everyMs; this.settleMs = settleMs;
    const r = file ? read(file) : { error: 'no settings file' };
    this.hash = r.hash || null; this.pending = null; this.applied = 0; this.refused = 0; this.lastError = r.error || null;
  }
  /** one check → 'none' | 'waiting' | 'applied' | 'refused' */
  check() {
    if (!this.file) return 'none';
    const r = read(this.file);
    if (r.error) { if (this.lastError !== r.error) { this.lastError = r.error; this.refused++; this.tell('Synced settings not applied', `${r.error}: the engine keeps its current settings until the file is fixed`); } return 'refused'; }
    this.lastError = null;
    if (r.hash === this.hash) { this.pending = null; return 'none'; }
    if (!this.pending || this.pending.hash !== r.hash) { this.pending = { hash: r.hash, at: this.now() }; return 'waiting'; }
    if (this.now() - this.pending.at < this.settleMs) return 'waiting';
    this.hash = r.hash; this.pending = null; this.applied++;
    try { this.onChange(); } catch (_) { /* the restart is best effort; the next start reads the file anyway */ }
    return 'applied';
  }
  start() { this.timer = setInterval(() => this.check(), this.everyMs); if (this.timer.unref) this.timer.unref(); return this; }
  stop() { clearInterval(this.timer); }
  status() { return { file: !!this.file, applied: this.applied, refused: this.refused, waiting: !!this.pending, error: this.lastError }; }
}

module.exports = { SettingsWatch, read, REQUIRED };
