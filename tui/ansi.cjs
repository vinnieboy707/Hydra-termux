'use strict';
// Minimal ANSI toolkit: colour (truecolor with 256-colour fallback), width-safe truncation and padding.
const ESC = '\x1b[';
const env = process.env;
const NO_COLOR = !!env.NO_COLOR || env.TERM === 'dumb';
const TRUE = /truecolor|24bit/i.test(env.COLORTERM || '') || !!env.TERMUX_VERSION || env.FORCE_TRUECOLOR === '1';
const RESET = NO_COLOR ? '' : ESC + '0m';

const T = { // palette: graphite + champagne gold
  gold: '#D4AF6A', goldDim: '#8C7442', ink: '#ECE8E1', text: '#C9CDD3', dim: '#7D848E', faint: '#3B414A', line: '#2C3138',
  green: '#4CC38A', red: '#EF6B62', amber: '#E8B44C', blue: '#7AA7E0', sel: '#1F2833', panel: '#15191E',
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const to256 = ([r, g, b]) => { const c = (v) => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.floor((v - 35) / 40))); return 16 + 36 * c(r) + 6 * c(g) + c(b); };
const code = (hex, bg) => (NO_COLOR || !hex ? '' : TRUE ? `${ESC}${bg ? 48 : 38};2;${rgb(hex).join(';')}m` : `${ESC}${bg ? 48 : 38};5;${to256(rgb(hex))}m`);

function paint(s, o = {}) {
  if (NO_COLOR) return String(s);
  let p = '';
  if (o.bold) p += ESC + '1m';
  if (o.dim) p += ESC + '2m';
  if (o.underline) p += ESC + '4m';
  p += code(o.fg) + code(o.bg, true);
  return p ? p + s + RESET : String(s);
}
/** Apply a background across a string that already contains colour resets. */
function withBg(s, hex) { if (NO_COLOR) return s; const b = code(hex, true); return b + String(s).split(RESET).join(RESET + b) + RESET; }

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const strip = (s) => String(s).replace(ANSI_RE, '');
const vlen = (s) => [...strip(s)].length;

function truncate(s, w) {
  s = String(s);
  if (w <= 0) return '';
  if (vlen(s) <= w) return s;
  let out = '', n = 0, i = 0;
  const re = /\x1b\[[0-9;?]*[A-Za-z]/y;
  while (i < s.length) {
    re.lastIndex = i; const m = re.exec(s);
    if (m) { out += m[0]; i = re.lastIndex; continue; }
    const ch = String.fromCodePoint(s.codePointAt(i));
    if (n >= w - 1) { out += '…'; break; }
    out += ch; n++; i += ch.length;
  }
  return out + RESET;
}
const padEnd = (s, w) => { const t = truncate(s, w); return t + ' '.repeat(Math.max(0, w - vlen(t))); };
const padStart = (s, w) => { const t = truncate(s, w); return ' '.repeat(Math.max(0, w - vlen(t))) + t; };
const center = (s, w) => { const t = truncate(s, w); const l = Math.floor((w - vlen(t)) / 2); return ' '.repeat(Math.max(0, l)) + t + ' '.repeat(Math.max(0, w - vlen(t) - l)); };

function wrap(text, w) {
  const out = []; let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (!word) continue;
    if (vlen(line) + vlen(word) + (line ? 1 : 0) > w) { if (line) out.push(line); line = word; } else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

module.exports = { ESC, T, paint, withBg, strip, vlen, truncate, padEnd, padStart, center, wrap, NO_COLOR, RESET };
