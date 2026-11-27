'use strict';
// No component without an input or an output: every module is used by something and provides something; every
// command in the help has a handler and every handler is in the help (or is a named alias / internal entry point);
// every script and top-level file is used; every file the package ships is sealed or deliberately data.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ls = (d, re) => fs.readdirSync(path.join(ROOT, d)).filter((f) => re.test(f)).map((f) => `${d}/${f}`);
const ALIASES = { console: 'the dashboard', ui: 'the dashboard', dash: 'the dashboard', 'help-me': 'assist', daemon: 'the engine itself (run by chronos service)', 'sync-key': 'retired: says what replaced it', '-h': 'help', '--help': 'help', providers: 'nodes' };

test('every module is used by another file (input) and exports something (output)', () => {
  const mods = [...ls('lib', /\.cjs$/), ...ls('tui', /\.cjs$/)];
  const users = [...mods, ...ls('bin', /\.cjs$/), ...ls('.', /\.cjs$/)].map((f) => [f, read(f)]);
  const orphans = mods.filter((m) => !users.some(([f, t]) => f !== m && (t.includes(`/${path.basename(m)}'`) || t.includes(`'${path.basename(m)}'`))));
  assert.deepStrictEqual(orphans, [], 'nothing uses these');
  assert.deepStrictEqual(mods.filter((m) => !/module\.exports\s*=/.test(read(m))), [], 'these provide nothing');
});

test('every command in the help has a handler, and every handler is in the help or a named alias', () => {
  const t = read('bin/chronos.cjs');
  const help = [...t.matchAll(/^ {2}chronos ([a-z-]+)/gm)].map((m) => m[1]);
  const cases = [...new Set([...t.matchAll(/case '([a-z-]+|-h|--help)'/g)].map((m) => m[1]))];
  assert.deepStrictEqual(help.filter((c) => !cases.includes(c)), [], 'in the help but nothing handles it');
  assert.deepStrictEqual(cases.filter((c) => !help.includes(c) && !ALIASES[c]), [], 'handled but not in the help');
  for (const a of Object.keys(ALIASES)) assert.ok(cases.includes(a), `alias ${a} no longer exists: remove it from ALIASES`);
});

test('every script and top-level file is used by the code or the docs; every code file ships sealed', () => {
  const corpus = [...ls('lib', /\.cjs$/), ...ls('tui', /\.cjs$/), ...ls('bin', /\.cjs$/), ...ls('docs', /\.md$/), 'README.md', 'go.sh', 'install.sh', ...ls('cloud', /\.sh$/)].map(read).join('\n');
  const top = fs.readdirSync(ROOT).filter((f) => !['node_modules', 'data', 'test', 'vendor', 'package-lock.json', 'SEAL.json'].includes(f) && !fs.statSync(path.join(ROOT, f)).isDirectory());
  assert.deepStrictEqual(top.filter((f) => !['package.json', 'CHANGELOG.md', 'README.md'].includes(f) && !corpus.includes(f)), [], 'top-level files nothing uses');
  for (const s of ls('cloud', /\.sh$/)) assert.ok(corpus.replace(read(s), '').includes(path.basename(s)), `${s} is never mentioned`);
  const sealed = new Set(require('../lib/integrity.cjs').codeFiles());
  const code = [...ls('lib', /\.cjs$/), ...ls('tui', /\.cjs$/), ...ls('bin', /\.cjs$/), ...ls('.', /\.(cjs|sh)$/), ...ls('cloud', /\.sh$/)].map((f) => f.replace(/^\.\//, ''));
  assert.deepStrictEqual(code.filter((f) => !sealed.has(f)), [], 'code that would ship unsealed');
});

test('workflows have no dead ends: every resolver action is carried out, every remedy reachable, every VP task handled, every real check registered', () => {
  const R = require('../lib/resolver.cjs'); const RM = require('../lib/remedy.cjs'); const RC = require('../lib/realcheck.cjs');
  const daemon = read('lib/daemon.cjs'); const company = read('lib/company.cjs'); const assist = read('lib/assist.cjs');
  const cases = [...daemon.matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]);
  assert.deepStrictEqual(Object.keys(R.ACTIONS).filter((a) => !cases.includes(a)), [], 'resolver actions with no code that carries them out');
  const used = new Set(Object.values(R.PROBLEMS).flatMap((p) => p.ladder || p.actions || []));
  assert.deepStrictEqual(Object.keys(R.ACTIONS).filter((a) => !used.has(a)), [], 'resolver actions no problem ever tries');
  assert.deepStrictEqual(Object.keys(RM.REMEDIES).filter((k) => !assist.includes(`'${k}'`)), [], 'remedies chronos assist can never show');
  const tasks = [...company.matchAll(/tasks\.push\('([a-z-]+)'\)/g)].map((m) => m[1]);
  assert.ok(tasks.length >= 4);
  assert.deepStrictEqual(tasks.filter((t) => !daemon.includes(`task === '${t}'`)), [], 'VP tasks nothing carries out');
  const reg = JSON.parse(read('test/counterparts.json')); const paired = new Set(['contract-deployed', ...Object.values(reg).filter((g) => typeof g === 'object').flatMap((g) => Object.values(g).flatMap((e) => e.checks || []))]);
  assert.deepStrictEqual(Object.keys(RC.CHECKS).filter((c) => !paired.has(c)), [], 'real checks no stand-in points to');
});

test('every code file parses (a broken file fails here in seconds, before anything slower runs)', () => {
  const vm = require('vm'); const bad = [];
  for (const d of ['lib', 'tui', 'bin', 'test', '.']) for (const f of fs.readdirSync(path.join(ROOT, d)).filter((x) => x.endsWith('.cjs'))) {
    const src = read(path.join(d, f)).replace(/^#!.*\n/, '\n');
    try { new vm.Script(`(function (exports, require, module, __filename, __dirname) {${src}\n})`, { filename: `${d}/${f}` }); } catch (e) { bad.push(`${d}/${f}: ${e.message}`); }
  }
  assert.deepStrictEqual(bad, []);
});
