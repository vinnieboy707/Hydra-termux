'use strict';
// Every environment variable the code reads is documented exactly once: your settings (lib/catalog.cjs), the
// execution policy, the deploy policy, or lib/envkeys.cjs (advanced, locations, platform, test hooks). Nothing listed
// there is stale. The example .env lists every setting you can set.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function walk(dir, ext) { const out = []; for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) out.push(...walk(p, ext)); else if (ext.test(e.name)) out.push(p); } return out; }
function readKeys() {
  const keys = new Map(); const add = (k, f) => { if (!keys.has(k)) keys.set(k, f); };
  for (const f of [...walk('lib', /\.cjs$/), ...walk('tui', /\.cjs$/), ...walk('bin', /\.cjs$/)]) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const re of [/process\.env\.([A-Z][A-Z0-9_]+)/g, /process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g, /\b(?:envGet|get)\(['"]([A-Z][A-Z0-9_]{3,})['"]\)/g, /\bE\.get\(\w+, ['"]([A-Z][A-Z0-9_]{3,})['"]\)/g, /\bopt\(['"]([A-Z][A-Z0-9_]{3,})['"]/g]) for (const m of s.matchAll(re)) add(m[1], f);
  }
  for (const f of ['go.sh', 'install.sh', ...walk('cloud', /\.sh$/)]) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const local = new Set([...s.matchAll(/(?:^|[\s;(])([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]).filter((k) => !new RegExp(`\\$\\{${k}:-`).test(s))); // assigned by the script itself
    for (const m of s.matchAll(/\$\{?([A-Z][A-Z0-9_]+)/g)) if (!local.has(m[1]) && /^CHRONOS_/.test(m[1]) || ['HOME', 'PATH', 'PREFIX', 'TERMUX_VERSION', 'TMPDIR', 'ENV_FILE'].includes(m[1])) add(m[1], f);
  }
  return keys;
}
function documented() {
  const C = require('../lib/catalog.cjs'); const P = require('../lib/execpolicy.cjs'); const D = require('../lib/deploy.cjs'); const K = require('../lib/envkeys.cjs');
  return { settings: new Set([...C.SECRETS.map((s) => s.key), ...C.SETTINGS.map((s) => s.key), ...P.POLICY.map((p) => p.key), ...D.DEPLOY_POLICY.map((p) => p.key)]), extra: new Set(K.ENV_KEYS.map((k) => k.key)) };
}

test('every environment variable the code reads is documented (settings, policies or lib/envkeys.cjs)', () => {
  const keys = readKeys(); const d = documented();
  assert.ok(keys.size > 40, 'the scan finds the variables');
  const missing = [...keys].filter(([k]) => !d.settings.has(k) && !d.extra.has(k)).map(([k, f]) => `${k} (read in ${f})`);
  assert.deepStrictEqual(missing, []);
});

test('nothing in lib/envkeys.cjs is stale, documented twice, or without a description', () => {
  const keys = readKeys(); const d = documented(); const K = require('../lib/envkeys.cjs').ENV_KEYS;
  assert.deepStrictEqual(K.filter((k) => !keys.has(k.key)).map((k) => k.key), [], 'listed but no longer read');
  assert.deepStrictEqual(K.filter((k) => d.settings.has(k.key)).map((k) => k.key), [], 'already one of your settings');
  for (const k of K) { assert.ok(['advanced', 'location', 'platform', 'test'].includes(k.kind), k.key); assert.ok(k.what && k.what.length > 10, k.key); }
});

test('the example .env lists every setting you can set (secrets only as names, never values)', () => {
  const ex = fs.readFileSync(path.join(ROOT, '.env.scanner.example'), 'utf8');
  const C = require('../lib/catalog.cjs'); const P = require('../lib/execpolicy.cjs'); const D = require('../lib/deploy.cjs');
  for (const k of [...C.SETTINGS.map((s) => s.key), ...C.SECRETS.map((s) => s.key), ...P.POLICY.map((p) => p.key), ...D.DEPLOY_POLICY.map((p) => p.key)]) assert.match(ex, new RegExp(`^#? ?${k}=`, 'm'), k);
  for (const s of C.SECRETS.filter((x) => x.secret)) assert.match(ex, new RegExp(`^# ${s.key}=$`, 'm'), `${s.key} is a secret: name only, set it with chronos set`);
});
