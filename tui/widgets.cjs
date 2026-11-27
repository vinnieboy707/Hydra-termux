'use strict';
// Dashboard building blocks: boxes, tables, bars, money and status chips drawn with the shared ANSI theme.
const { T, paint, withBg, vlen, padEnd, padStart, center, truncate } = require('./ansi.cjs');

const SPARK = '▁▂▃▄▅▆▇█';
function sparkline(values, width, color = T.gold) {
  const v = values.slice(-width);
  const nums = v.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (!nums.length) return paint('·'.repeat(Math.min(width, 3)), { fg: T.faint }) + ' '.repeat(Math.max(0, width - 3));
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const s = v.map((x) => (typeof x !== 'number' || !Number.isFinite(x) ? ' ' : SPARK[hi === lo ? 3 : Math.round(((x - lo) / (hi - lo)) * 7)])).join('');
  return paint(s, { fg: color }) + ' '.repeat(Math.max(0, width - v.length));
}

function meter(value, max, width, { invert = false } = {}) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return paint('─'.repeat(width), { fg: T.faint });
  const r = Math.max(0, value / max);
  const n = Math.min(width, Math.round(Math.min(r, 1) * width));
  const col = invert ? (r >= 1 ? T.green : r >= 0.5 ? T.amber : T.dim) : (r >= 1 ? T.red : r >= 0.7 ? T.amber : T.green);
  return paint('━'.repeat(n), { fg: col }) + paint('─'.repeat(width - n), { fg: T.faint });
}

function box(title, lines, width, { accent = T.gold, right = '' } = {}) {
  const inner = width - 4;
  const t = title ? ' ' + paint(title, { fg: accent, bold: true }) + ' ' : '';
  const r = right ? ' ' + right + ' ' : '';
  const fill = Math.max(0, width - 3 - vlen(t) - vlen(r));
  const L = (s) => paint(s, { fg: T.line });
  const out = [L('╭─') + t + L('─'.repeat(fill)) + r + L('╮')];
  for (const l of lines) out.push(L('│') + ' ' + padEnd(l, inner) + ' ' + L('│'));
  out.push(L('╰' + '─'.repeat(width - 2) + '╯'));
  return out;
}

/** Lay boxes side by side (each an array of lines with equal width). */
function hjoin(blocks, gap = 1) {
  const h = Math.max(...blocks.map((b) => b.length));
  const widths = blocks.map((b) => Math.max(...b.map(vlen)));
  const out = [];
  for (let i = 0; i < h; i++) out.push(blocks.map((b, j) => padEnd(b[i] || '', widths[j])).join(' '.repeat(gap)));
  return out;
}

/** Table: cols = [{label, w (fixed) | flex, align}], rows = arrays of cell strings. */
function table(cols, rows, width, { selected = -1, maxRows = Infinity, offset = 0 } = {}) {
  const fixed = cols.reduce((s, c) => s + (c.w || 0), 0) + cols.length - 1 + 2;
  const flexN = cols.filter((c) => !c.w).length || 1;
  const flexW = Math.max(6, Math.floor((width - fixed) / flexN));
  const ws = cols.map((c) => c.w || flexW);
  const cell = (s, i) => (cols[i].align === 'right' ? padStart(s, ws[i]) : padEnd(s, ws[i]));
  const out = ['  ' + cols.map((c, i) => cell(paint(c.label, { fg: T.dim }), i)).join(' ')];
  rows.slice(offset, offset + maxRows).forEach((r, k) => {
    const idx = k + offset; const isSel = idx === selected;
    let line = (isSel ? paint('▸ ', { fg: T.gold, bold: true }) : '  ') + r.map(cell).join(' ');
    line = padEnd(line, width);
    out.push(isSel ? withBg(line, T.sel) : line);
  });
  return out;
}

const money = (n, { sign = true, digits = 2 } = {}) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return paint('—', { fg: T.faint });
  const s = (sign && n > 0 ? '+' : n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(digits);
  return paint(s, { fg: n > 0 ? T.green : n < 0 ? T.red : T.dim, bold: Math.abs(n) > 0 });
};

const PILL = { ENFORCED: T.green, PASS: T.green, READY: T.green, LIVE: T.green, ok: T.green, SET: T.blue, 'READ-ONLY': T.blue, CLI: T.blue, SEPARATE: T.blue,
  CHECK: T.amber, STANDBY: T.amber, 'NOT BUILT': T.amber, MISSING: T.red, FAIL: T.red, BLOCKING: T.red, ABSENT: T.dim, OFF: T.red };
const pill = (s, color) => paint(` ${s} `, { fg: '#0E1114', bg: color || PILL[s] || T.dim, bold: true });
const tag = (s, color) => paint(s, { fg: color || PILL[s] || T.dim, bold: true });

module.exports = { sparkline, meter, box, hjoin, table, money, pill, tag, center, truncate };
