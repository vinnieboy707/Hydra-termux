'use strict';
// Small interactive prompts for the setup screens: arrow-key menus, masked secret entry, validated input.
// Secrets are never echoed: each character shows as •, and only the last 4 characters are confirmed back.
const A = require('./ansi.cjs');
const { T, paint } = A;
const out = process.stdout;

// Raw mode only while a prompt is open: on every answer the terminal is handed back (cooked mode, input paused), so
// the command can finish and Ctrl+C works again. Leaving it raw is what made the terminal look frozen after a key.
function keys(handler) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume(); stdin.setEncoding('utf8');
    const on = (d) => {
      const r = handler(d);
      if (r !== undefined) { stdin.removeListener('data', on); if (stdin.isTTY) stdin.setRawMode(false); stdin.pause(); resolve(r); }
    };
    stdin.on('data', on);
  });
}
const cols = () => Math.max(40, out.columns || 80);
const rows = () => Math.max(12, out.rows || 24);

let drawn = 0;
function paintBlock(lines) {
  if (drawn) out.write(`\x1b[${drawn}F\x1b[J`); else out.write('\x1b[J');
  const w = cols();
  const t = lines.map((l) => A.truncate(l, w - 1));
  out.write(t.join('\n') + '\n');
  drawn = t.length;
}
function release() { drawn = 0; }

/** items: [{label, hint, value, color}] → resolves to value, or null on esc/q. */
async function select(title, items, { subtitle = '', index = 0, footer = '↑↓ move · enter choose · esc back' } = {}) {
  let i = Math.max(0, Math.min(index, items.length - 1));
  const render = () => {
    const room = Math.max(4, rows() - 6 - (subtitle ? 1 : 0));
    const start = Math.max(0, Math.min(i - Math.floor(room / 2), items.length - room));
    const L = [paint(title, { fg: T.gold, bold: true })];
    if (subtitle) L.push(paint(subtitle, { fg: T.dim }));
    L.push('');
    items.slice(start, start + room).forEach((it, k) => {
      const idx = start + k; const sel = idx === i;
      const lab = (sel ? paint('▸ ', { fg: T.gold, bold: true }) : '  ') + paint(it.label, { fg: sel ? T.ink : (it.color || T.text), bold: sel });
      L.push(it.hint ? A.padEnd(lab, Math.min(44, cols() - 20)) + ' ' + paint(it.hint, { fg: it.hintColor || T.dim }) : lab);
    });
    if (items.length > room) L.push(paint(`  ${i + 1} / ${items.length}`, { fg: T.faint }));
    L.push('', paint(footer, { fg: T.faint }));
    paintBlock(L);
  };
  out.write('\x1b[?25l'); render();
  const r = await keys((k) => {
    if (k === '\u0003') return { abort: true };
    if (k === '\x1b' || k === 'q') return { v: null };
    if (k === '\x1b[A' || k === 'k') { i = (i + items.length - 1) % items.length; render(); return undefined; }
    if (k === '\x1b[B' || k === 'j') { i = (i + 1) % items.length; render(); return undefined; }
    if (k === '\r' || k === '\n') return { v: items[i].value };
    if (/^[1-9]$/.test(k) && Number(k) <= items.length) { i = Number(k) - 1; render(); return { v: items[i].value }; }
    return undefined;
  });
  release(); out.write('\x1b[?25h');
  if (r.abort) { out.write('\n'); process.exit(130); }
  return r.v;
}

/** Masked entry. Paste works. Returns the string, or null if cancelled with esc / ctrl-c. */
async function secret(label, hint = '') {
  out.write('\n' + paint(label, { fg: T.ink, bold: true }) + (hint ? '\n' + paint(hint, { fg: T.dim }) : '') + '\n' + paint('› ', { fg: T.gold }));
  let v = '';
  const echo = () => { const n = [...v].length; out.write('\r\x1b[K' + paint('› ', { fg: T.gold }) + paint('•'.repeat(Math.min(n, cols() - 16)) + (n > cols() - 16 ? '…' : ''), { fg: T.text }) + paint(n ? `  ${n} chars` : '  paste or type · enter to finish · esc to cancel', { fg: T.faint })); };
  echo();
  const r = await keys((d) => {
    for (const ch of d.replace(/\x1b\[200~|\x1b\[201~/g, '')) {
      if (ch === '\u0003' || ch === '\x1b') return { v: null };
      if (ch === '\r' || ch === '\n') { if (v.length) return { v }; continue; }
      if (ch === '\x7f' || ch === '\b') { v = [...v].slice(0, -1).join(''); continue; }
      if (ch >= ' ') v += ch;
    }
    echo(); return undefined;
  });
  out.write('\n');
  return r.v === null ? null : r.v.trim();
}

/** Visible single-line input with a default and a validator returning an error string or null. */
async function input(label, { def = '', check = () => null, hint = '' } = {}) {
  for (;;) {
    out.write('\n' + paint(label, { fg: T.ink, bold: true }) + (hint ? '\n' + paint(hint, { fg: T.dim }) : '') + '\n');
    let v = '';
    const echo = () => out.write('\r\x1b[K' + paint('› ', { fg: T.gold }) + v + (v ? '' : paint(def ? `${def}  (enter keeps this)` : '', { fg: T.faint })));
    echo();
    const r = await keys((d) => {
      for (const ch of d.replace(/\x1b\[200~|\x1b\[201~/g, '')) {
        if (ch === '\u0003' || ch === '\x1b') return { v: null };
        if (ch === '\r' || ch === '\n') return { v: v || def };
        if (ch === '\x7f' || ch === '\b') { v = v.slice(0, -1); continue; }
        if (ch >= ' ') v += ch;
      }
      echo(); return undefined;
    });
    out.write('\n');
    if (r.v === null) return null;
    const err = check(r.v.trim());
    if (!err) return r.v.trim();
    out.write(paint('✗ ' + err, { fg: T.red }) + '\n');
  }
}

async function confirm(q, def = false) {
  out.write('\n' + paint(q, { fg: T.ink }) + paint(def ? '  [Y/n] ' : '  [y/N] ', { fg: T.dim }));
  const r = await keys((k) => { if (k === '\u0003' || k === '\x1b') return false; if (/^[yY]$/.test(k)) return true; if (/^[nN]$/.test(k)) return false; if (k === '\r') return def; return undefined; });
  out.write((r ? 'yes' : 'no') + '\n');
  return r;
}
async function pause(msg = 'press any key to continue') { out.write('\n' + paint(msg, { fg: T.faint })); await keys(() => true); out.write('\n'); }

module.exports = { select, secret, input, confirm, pause, release, paintBlock };
