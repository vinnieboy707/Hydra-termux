'use strict';
// Safe .env editing. Keeps every line, comment and order you already have; changes only the keys you set.
// Every save: backup copy (0600, last 5 kept), write to a temp file (0600), atomic rename, chmod 600.
const fs = require('fs');
const path = require('path');
const { parseValue } = require('./config.cjs');

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function load(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (_) { /* new file */ }
  const lines = text.length ? text.replace(/\n$/, '').split('\n') : [];
  return { file, lines, exists: !!text.length || fs.existsSync(file) };
}
function get(doc, key) {
  let val;
  for (const l of doc.lines) { const m = l.match(LINE); if (m && m[1] === key) val = parseValue(m[2]); }
  return val;
}
/** Values may not contain newlines, NUL, quotes or backticks: they could break the file or be read differently by other tools. */
function checkValue(v) {
  if (typeof v !== 'string') return 'not text';
  if (/[\r\n\0"'`]/.test(v)) return 'contains a newline, quote or backtick';
  if (v.length > 4096) return 'too long';
  return null;
}
const fmt = (v) => (/^[A-Za-z0-9_\-.:/@,+%~=?&*!$^]*$/.test(v) ? v : `"${v}"`);
function set(doc, key, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error('invalid variable name');
  const bad = checkValue(value); if (bad) throw new Error(bad);
  let idx = -1;
  doc.lines.forEach((l, i) => { const m = l.match(LINE); if (m && m[1] === key) idx = i; });
  const line = `${key}=${fmt(value)}`;
  if (idx >= 0) doc.lines[idx] = line; else doc.lines.push(line);
}
function unset(doc, key) { doc.lines = doc.lines.filter((l) => { const m = l.match(LINE); return !(m && m[1] === key); }); }

function stamp() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }

function save(doc) {
  const dir = path.dirname(doc.file);
  fs.mkdirSync(dir, { recursive: true });
  let backup = null;
  if (fs.existsSync(doc.file)) {
    backup = `${doc.file}.bak-${stamp()}`;
    fs.copyFileSync(doc.file, backup); fs.chmodSync(backup, 0o600);
    const base = path.basename(doc.file) + '.bak-';
    const olds = fs.readdirSync(dir).filter((f) => f.startsWith(base)).sort();
    for (const f of olds.slice(0, Math.max(0, olds.length - 5))) fs.unlinkSync(path.join(dir, f));
  }
  const tmp = path.join(dir, `.${path.basename(doc.file)}.tmp-${process.pid}`);
  fs.writeFileSync(tmp, doc.lines.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, doc.file);
  fs.chmodSync(doc.file, 0o600);
  return { backup };
}
const mask = (v) => (!v ? '' : v.length <= 8 ? '•'.repeat(v.length) : '•'.repeat(6) + v.slice(-4));
module.exports = { load, get, set, unset, save, checkValue, mask };
