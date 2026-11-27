'use strict';
// The VP's documentation archive: every Chronos document (README, CHANGELOG, docs/*.md, docs/reference/*.md: the
// chain, the protocols, Blockscout, the node providers) split into sections and searched by relevance (BM25), so an
// agent answers from the documentation that ships with the code, never from memory. Built once per process from the
// files on disk; the docs are updated with every code change (chronos docs --check refuses a stale release).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STOP = new Set('the a an and or of to in on for is are be it this that with as by at from your you not no if then than when what which can its it\'s into each every one'.split(' '));
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_.\-]+/g, ' ').split(' ').filter((w) => w.length > 1 && !STOP.has(w));

function files(root = ROOT) {
  const out = ['README.md', 'CHANGELOG.md'].map((f) => path.join(root, f));
  for (const d of ['docs', path.join('docs', 'reference')]) { try { for (const f of fs.readdirSync(path.join(root, d))) if (f.endsWith('.md')) out.push(path.join(root, d, f)); } catch (_) { /* none */ } }
  return out.filter((f) => fs.existsSync(f));
}

/** sections: [{ file, heading, text }] — split at headings, long sections cut at ~1,500 characters */
function sections(root = ROOT) {
  const out = [];
  for (const f of files(root)) {
    const rel = path.relative(root, f); let head = rel; let buf = [];
    const push = () => { const t = buf.join('\n').trim(); if (t) for (let i = 0; i < t.length; i += 1500) out.push({ file: rel, heading: head, text: t.slice(i, i + 1500) }); buf = []; };
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) { const m = /^#{1,4}\s+(.*)/.exec(line); if (m) { push(); head = m[1].trim(); } else buf.push(line); }
    push();
  }
  return out;
}

// ── your own files: the workspace, folders you name, Drive copies, MCP configurations ─────────────────────────
// Never a secret: files whose name says env/key/secret/password/wallet/keystore/mnemonic/seed are skipped, every
// text is passed through the redactor (urls with keys, private keys, API tokens), and MCP configurations keep only
// each server's name and command (never its env or headers).
const SECRET_NAME = /(^\.env|\.env$|\.env\.|secret|passw|private.?key|keystore|mnemonic|seed|wallet.?backup|credential|\.pem$|\.key$|id_rsa|chronos-keys\.enc)/i;
const TEXT_EXT = /\.(md|markdown|txt|sol|ts|js|cjs|mjs|py|sh|ya?ml|toml)$/i;
const SKIP_DIR = new Set(['node_modules', '.git', '.cache', '.npm', 'dist', 'build', 'coverage', 'artifacts', 'cache', 'logs', 'data', '_quarantine']);
const MCP_FILES = ['.mcp.json', 'mcp.json', '.claude.json', '.cursor/mcp.json', '.gemini/settings.json', '.config/claude/claude_desktop_config.json', 'Library/Application Support/Claude/claude_desktop_config.json', '.codeium/windsurf/mcp_config.json'];
function scrub(text) {
  const { redact } = require('./safety.cjs');
  return redact(String(text)).replace(/\b0x[0-9a-fA-F]{64}\b/g, '[64-hex redacted]').replace(/\b(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}/g, '[token redacted]').replace(/\b[A-Za-z0-9_-]{32,}\b/g, (m) => (/[0-9]/.test(m) && /[A-Za-z]/.test(m) ? '[token redacted]' : m));
}
/** text files under dir (depth 4, ≤ 256 KB each, ≤ 1,500 files), secrets skipped */
function walkText(dir, depth = 4, out = []) {
  if (depth < 0 || out.length >= 1500) return out;
  let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of es) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name) && !e.name.startsWith('chronos-console') && !SECRET_NAME.test(e.name)) walkText(p, depth - 1, out); continue; }
    if (!e.isFile() || SECRET_NAME.test(e.name) || !TEXT_EXT.test(e.name)) continue;
    try { if (fs.statSync(p).size <= 256 * 1024) out.push(p); } catch (_) { /* skip */ }
  }
  return out;
}
/** MCP servers you configured (name + command only) as one section per file */
function mcpSections(home) {
  const out = [];
  for (const f of MCP_FILES) {
    const p = path.join(home, f); let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { continue; }
    const servers = { ...(j.mcpServers || {}), ...Object.values(j.projects || {}).reduce((a, x) => ({ ...a, ...((x && x.mcpServers) || {}) }), {}) };
    const lines = Object.entries(servers).map(([n, s]) => `- ${n}: ${s && s.url ? 'remote ' + scrub(String(s.url).replace(/\?.*$/, '')) : scrub([s && s.command, ...((s && s.args) || [])].filter(Boolean).join(' ')).slice(0, 200)}`);
    if (lines.length) out.push({ file: '~/' + f, heading: `MCP servers configured in ~/${f} (${lines.length})`, text: lines.join('\n') });
  }
  return out;
}
/** sections of your own files: { file, heading, text } */
function ownSections({ home = require('os').homedir(), roots = [] } = {}) {
  const out = [...mcpSections(home)];
  for (const r of roots.filter(Boolean)) {
    for (const f of walkText(r)) {
      let t; try { t = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
      if (/\u0000/.test(t)) continue; // binary
      t = scrub(t); const rel = f.startsWith(home) ? '~/' + path.relative(home, f) : f;
      for (let i = 0; i < t.length && i < 60000; i += 1500) out.push({ file: rel, heading: path.basename(f), text: t.slice(i, i + 1500) });
    }
  }
  return out;
}

class Archive {
  /** root: the Chronos code · own: { home, roots } to add your workspace, named folders and Drive copies */
  constructor(root = ROOT, own = null) {
    this.docs = [...sections(root), ...(own ? ownSections(own) : [])].map((s) => ({ ...s, terms: words(s.heading + ' ' + s.heading + ' ' + s.text) }));
    this.df = new Map(); for (const d of this.docs) for (const w of new Set(d.terms)) this.df.set(w, (this.df.get(w) || 0) + 1);
    this.avg = this.docs.reduce((s, d) => s + d.terms.length, 0) / Math.max(1, this.docs.length);
  }
  /** the k most relevant sections for a question → [{ file, heading, text, score }] */
  search(query, k = 4) {
    const q = [...new Set(words(query))]; const N = this.docs.length; const k1 = 1.2, b = 0.75;
    const scored = this.docs.map((d) => {
      const tf = new Map(); for (const w of d.terms) tf.set(w, (tf.get(w) || 0) + 1);
      let s = 0; for (const w of q) { const f = tf.get(w) || 0; if (!f) continue; const idf = Math.log(1 + (N - this.df.get(w) + 0.5) / (this.df.get(w) + 0.5)); s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.terms.length) / this.avg))); }
      return { file: d.file, heading: d.heading, text: d.text, score: s };
    }).filter((x) => x.score > 0).sort((a, z) => z.score - a.score);
    return scored.slice(0, k);
  }
  get size() { return this.docs.length; }
}

let shared = null;
/**
 * the archive of the installed code plus your own files (built once, rebuilt by refresh()): get = the .env reader.
 * Your files: the workspace (the folder holding your .env), CHRONOS_ARCHIVE_FROM (comma-separated folders), and
 * ~/.chronos/archive (Drive documents copied by chronos archive sync), and your MCP configurations.
 */
function archive(get = () => undefined, { refresh = false, workspace = null } = {}) {
  if (shared && !refresh) return shared;
  const os = require('os'); const home = os.homedir();
  const roots = [workspace, ...String(get('CHRONOS_ARCHIVE_FROM') || '').split(',').map((x) => x.trim()), path.join(home, '.chronos', 'archive')];
  shared = new Archive(ROOT, { home, roots: [...new Set(roots.filter((r) => r && fs.existsSync(r)))] });
  return shared;
}

module.exports = { Archive, archive, sections, ownSections, mcpSections, words, scrub, SECRET_NAME };
