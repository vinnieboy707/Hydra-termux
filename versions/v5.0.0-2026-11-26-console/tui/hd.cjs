'use strict';
// High-resolution terminal graphics for the dashboard: braille charts (2×4 dots per character, so a 40×8 chart has
// 80×32 points), truecolor gradients, eighth-block gauges, half-block heatmaps (two rows per line) and route
// diagrams. Every value drawn comes from the engine's own measurements; nothing is interpolated or invented: a gap
// in the data is drawn as a gap.
const { T, paint, vlen, padEnd } = require('./ansi.cjs');

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** colour at t (0..1) along a list of stops */
function lerp(stops, t) {
  if (!Number.isFinite(t)) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(x)); const f = x - i;
  const a = rgb(stops[i]), b = rgb(stops[i + 1]);
  return hex(a.map((v, k) => v + (b[k] - v) * f));
}
const HEAT = ['#1B2A3A', '#2E5E8C', '#4CC38A', '#E8B44C', '#EF6B62'];
const PROFIT = ['#EF6B62', '#E8B44C', '#4CC38A'];

/** compact number for axis labels */
function short(v, unit = '') {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const s = a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'k' : a >= 100 ? v.toFixed(0) : a >= 1 ? v.toFixed(2) : v.toFixed(3);
  return unit === '$' ? (v < 0 ? '-$' + s.replace('-', '') : '$' + s) : s + unit;
}

// ── braille line / area chart ─────────────────────────────────────────────────────────────────────────────────────
const DOT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]]; // [row][col] bits of a braille cell
/**
 * series: [{ values: (number|null)[], color, fill: 'zero'|false }]; hlines: [{ value, color }] drawn dotted.
 * Returns `h` lines of exactly `w` visible characters (an 8-character axis on the left).
 */
function chart(series, w, h, { min = null, max = null, hlines = [], unit = '' } = {}) {
  const axis = 8, cw = Math.max(4, w - axis), ch = Math.max(2, h);
  const W = cw * 2, H = ch * 4;
  const data = series.flatMap((s) => s.values.filter(Number.isFinite));
  const all = data.concat(hlines.map((l) => l.value).filter(Number.isFinite));
  // reference lines alone are not data: say so instead of drawing an empty-looking chart
  if (!data.length) return [padEnd(paint('  no data yet: it fills in scan by scan', { fg: T.faint }), w), ...Array(ch - 1).fill(' '.repeat(w))];
  let lo = min !== null ? min : Math.min(...all), hi = max !== null ? max : Math.max(...all);
  if (hi === lo) { hi += Math.abs(hi) * 0.1 || 1; lo -= Math.abs(lo) * 0.1 || 1; }
  const y = (v) => Math.round((1 - (v - lo) / (hi - lo)) * (H - 1));
  const cells = Array.from({ length: ch }, () => Array.from({ length: cw }, () => ({ bits: 0, color: null })));
  const set = (px, py, color) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const c = cells[py >> 2][px >> 1]; c.bits |= DOT[py & 3][px & 1]; c.color = color; };
  for (const l of hlines) if (Number.isFinite(l.value) && l.value >= lo && l.value <= hi) for (let px = 0; px < W; px += 3) set(px, y(l.value), l.color || T.faint);
  for (const s of series) {
    const v = s.values.slice(-W); const off = W - v.length; let prev = null;
    v.forEach((val, i) => {
      if (!Number.isFinite(val)) { prev = null; return; }
      const px = off + i, py = y(val);
      const col = typeof s.color === 'function' ? s.color(val) : s.color;
      if (s.fill === 'zero' && lo < 0 && hi > 0) { const z = y(0); for (let k = Math.min(z, py); k <= Math.max(z, py); k++) set(px, k, col); }
      if (prev) { const [x0, y0] = prev; const n = Math.max(Math.abs(px - x0), Math.abs(py - y0)); for (let k = 1; k <= n; k++) set(Math.round(x0 + ((px - x0) * k) / n), Math.round(y0 + ((py - y0) * k) / n), col); }
      set(px, py, col); prev = [px, py];
    });
  }
  return cells.map((row, r) => {
    const label = r === 0 ? short(hi, unit) : r === ch - 1 ? short(lo, unit) : lo < 0 && hi > 0 && (y(0) >> 2) === r ? short(0, unit) : '';
    return paint(label.padStart(axis - 1) + ' ', { fg: T.dim }) + row.map((c) => (c.bits ? paint(String.fromCharCode(0x2800 + c.bits), { fg: c.color }) : ' ')).join('');
  });
}

// ── gauges ────────────────────────────────────────────────────────────────────────────────────────────────────────
const EIGHTH = ' ▏▎▍▌▋▊▉█';
/** a smooth bar (1/8-character steps) coloured along a gradient; value 0..max */
function gauge(value, max, width, stops = PROFIT) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return paint('╌'.repeat(width), { fg: T.faint });
  const r = Math.max(0, Math.min(1, value / max)); const units = Math.round(r * width * 8);
  let out = '';
  for (let i = 0; i < width; i++) {
    const u = Math.max(0, Math.min(8, units - i * 8));
    out += u ? paint(EIGHTH[u], { fg: lerp(stops, (i + 0.5) / width) }) : paint('·', { fg: T.line });
  }
  return out;
}

// ── vertical histogram (eighth blocks, several lines tall) ───────────────────────────────────────────────────────
const VBLK = ' ▁▂▃▄▅▆▇█';
function columns(values, h, colors) {
  const max = Math.max(1e-9, ...values.filter(Number.isFinite));
  const lines = [];
  for (let r = h - 1; r >= 0; r--) {
    lines.push(values.map((v, i) => { const u = Math.round((Math.max(0, v) / max) * h * 8) - r * 8; const c = Math.max(0, Math.min(8, u)); return c ? paint(VBLK[c], { fg: colors[i] }) : ' '; }).join(''));
  }
  return lines;
}

// ── half-block heatmap: two value rows per text line ─────────────────────────────────────────────────────────────
/** rows: [{ label, values: number[] }], max: value at the hottest colour; returns ceil(rows/2) lines */
function heatmap(rows, width, { max = null, labelWidth = 12 } = {}) {
  const vals = rows.flatMap((r) => r.values).filter(Number.isFinite);
  const top = max !== null ? max : Math.max(1e-9, ...vals);
  const color = (v) => (Number.isFinite(v) ? lerp(HEAT, v / top) : T.panel);
  const cols = Math.max(1, width - labelWidth - 1);
  const out = [];
  for (let i = 0; i < rows.length; i += 2) {
    const a = rows[i], b = rows[i + 1];
    const half = b ? Math.floor((labelWidth - 3) / 2) : labelWidth - 1; // ▀ marks the top half's pair, ▄ the bottom's
    const lab = padEnd(paint('▀', { fg: T.dim }) + paint(a.label.slice(0, half), { fg: T.text }) + (b ? paint(' ▄', { fg: T.dim }) + paint(b.label.slice(0, half), { fg: T.text }) : ''), labelWidth) + ' ';
    let line = '';
    for (let k = 0; k < Math.min(cols, Math.max(a.values.length, b ? b.values.length : 0)); k++) line += paint('▀', { fg: color(a.values[k]), bg: b ? color(b.values[k]) : T.panel });
    out.push(lab + line);
  }
  return out;
}

// ── route diagram ─────────────────────────────────────────────────────────────────────────────────────────────────
/** tokens and venues of a cycle, the arrows coloured by how close the route is to profit (net vs floor) */
function route(path, venues, netUsd, floorUsd, width) {
  const t = Number.isFinite(netUsd) && Number.isFinite(floorUsd) ? (netUsd >= floorUsd ? 1 : netUsd >= 0 ? 0.6 : Math.max(0, 0.5 + netUsd / (2 * Math.max(1, Math.abs(netUsd))))) : 0;
  const col = lerp(PROFIT, t);
  const parts = [];
  path.forEach((tok, i) => {
    parts.push(paint(` ${tok} `, { fg: '#0E1114', bg: i === 0 || i === path.length - 1 ? T.gold : T.blue, bold: true }));
    if (i < path.length - 1) parts.push(paint(` ─${String(venues[i] || '').split(':')[0]}─▶ `, { fg: col }));
  });
  const one = parts.join('');
  if (vlen(one) <= width) return [one];
  // narrow screens: one hop per line
  const lines = [];
  for (let i = 0; i < path.length - 1; i++) lines.push(paint(` ${path[i]} `, { fg: '#0E1114', bg: i === 0 ? T.gold : T.blue, bold: true }) + paint(` ─${String(venues[i] || '').split(':')[0]}─▶ `, { fg: col }) + paint(` ${path[i + 1]} `, { fg: '#0E1114', bg: i + 1 === path.length - 1 ? T.gold : T.blue, bold: true }));
  return lines;
}

module.exports = { chart, gauge, columns, heatmap, route, lerp, short, HEAT, PROFIT };
