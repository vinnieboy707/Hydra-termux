'use strict';
// Documentation that cannot drift from the code. Reference sections of the docs are GENERATED from the code itself
// (settings catalog, execution policy, CLI help, module headers, test and planted-bug counts) between
// <!-- GENERATED:name --> markers; `chronos docs` rewrites them, `chronos docs --check` (run by the test suite and by
// packaging) fails when any doc is stale, a module has no header, or CHANGELOG.md has no entry for this version.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const cell = (s) => String(s === undefined || s === null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** the first comment line under 'use strict' (or the shebang): a module's one-line purpose */
function header(file) {
  const lines = read(file).split('\n');
  for (const l of lines.slice(0, 6)) {
    const m = l.match(/^\s*(?:\/\/|\/\*\*?|\*)\s?(.*?)\s*(?:\*\/)?$/);
    if (m && m[1] && !/^#!|^'use strict'/.test(l) && !/^eslint/.test(m[1])) return m[1].replace(/^[—-]\s*/, '');
  }
  return null;
}

function modules() {
  const out = [];
  for (const dir of ['bin', 'lib', 'tui']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith('.cjs')).sort()) out.push({ file: `${dir}/${f}`, purpose: header(`${dir}/${f}`) });
  }
  for (const f of ['go.sh', 'install.sh', 'cloud/gcp-setup.sh', 'scan.cjs', 'measure.cjs', 'registry_audit.cjs', 'calibrate_gas.cjs']) {
    if (fs.existsSync(path.join(ROOT, f))) out.push({ file: f, purpose: f.endsWith('.sh') ? (read(f).split('\n').find((l) => /^# \S/.test(l)) || '').replace(/^#\s*/, '') || null : header(f) });
  }
  return out;
}

function testFiles() {
  const m = read('bin/chronos.cjs').match(/'test\/[\w.-]+\.test\.cjs'/g) || [];
  return [...new Set(m.map((x) => x.slice(1, -1)))];
}
function tests() {
  return testFiles().map((f) => ({ file: f, tests: (read(f).match(/^test\(/gm) || []).length, about: header(f) }));
}
function mutants() { return (read('test/mutate.cjs').match(/^ \['/gm) || []).length; }

const blocks = {
  modules: () => ['| File | Purpose |', '| --- | --- |', ...modules().map((m) => `| \`${m.file}\` | ${cell(m.purpose || '(no header)')} |`)].join('\n'),
  commands: () => {
    const help = read('bin/chronos.cjs').match(/const HELP = `([\s\S]*?)`;/)[1];
    const rows = help.split('\n').map((l) => l.match(/^ {2}(chronos(?: [^ ]+(?: [^ ]+)?)?)\s{2,}(.+)$/)).filter(Boolean);
    const tail = help.split('\n').filter((l) => /^ {2}Sends happen|^ {2}and chronos payout/.test(l)).map((l) => l.trim()).join(' ');
    return ['| Command | What it does |', '| --- | --- |', ...rows.map((r) => `| \`${r[1].trim()}\` | ${cell(r[2].trim())} |`), '', tail].join('\n');
  },
  settings: () => {
    const C = require('./catalog.cjs');
    const groups = [...new Set(C.SETTINGS.map((s) => s.group))];
    const out = [];
    for (const g of groups) {
      out.push(`### ${g}`, '', '| Setting | Range | Suggested | What it controls |', '| --- | --- | --- | --- |');
      for (const s of C.SETTINGS.filter((x) => x.group === g)) out.push(`| \`${s.key}\` | ${s.oneOf ? s.oneOf.join(' / ') : s.min !== undefined ? `${s.min} – ${s.max}${s.int ? ' (whole)' : ''}` : ''} | ${cell(s.suggest)} | ${cell(s.what)} |`);
      out.push('');
    }
    return out.join('\n').trim();
  },
  secrets: () => {
    const C = require('./catalog.cjs');
    return ['| Key | Group | Purpose | Check when entered |', '| --- | --- | --- | --- |', ...C.SECRETS.map((s) => `| \`${s.key}\` | ${cell(s.group)} | ${cell(s.what)} | ${s.test ? 'tested (live where the service allows)' : 'format only'} |`)].join('\n');
  },
  policy: () => {
    const { POLICY } = require('./execpolicy.cjs');
    return ['| Policy | Default | Allowed | What it does |', '| --- | --- | --- | --- |', ...POLICY.map((p) => `| \`${p.key}\` | ${cell(p.def)} | ${p.oneOf ? p.oneOf.join(' / ') : p.min !== undefined ? `${p.min} – ${p.max}` : ''} | ${cell(p.what)} |`)].join('\n');
  },
  ingest: () => {
    const src = read('server/functions/ingest/index.ts'); const rows = [];
    for (const m of src.matchAll(/^\s+(\w+): \{ cols: \[([^\]]+)\](?:, conflict: '([^']+)')?/gm)) rows.push(`| \`${m[1]}\` | ${m[2].replace(/'/g, '').split(',').map((c) => '`' + c.trim() + '`').join(', ')} | ${m[3] ? 'upsert on ' + m[3] : 'insert'} |`);
    return ['| Table | Columns accepted (anything else is dropped) | Write |', '| --- | --- | --- |', ...rows].join('\n');
  },
  routes: () => {
    const ops = (f) => [...read(f).matchAll(/b\?\.op === '(\w+)'/g)].map((m) => '`' + m[1] + '`').join(', ');
    return ['| Route | Method | Who may call | Operations |', '| --- | --- | --- | --- |',
      '| `/functions/v1/release` | GET | anyone (no secrets) | `?f=go.sh`, `?f=device.cjs`: the installer and device helper of the newest release |',
      `| \`/functions/v1/release\` | POST | \`enroll\`: anyone proving its key; others: an enrolled device, signed | ${ops('server/functions/release/index.ts')} |`,
      '| `/functions/v1/ingest` | POST | an approved device, signed | `{table, rows}` for the tables below; `pool_moves` rows are also broadcast on Realtime topic `chronos-pool-moves` (the price-move relay) |',
      `| \`/functions/v1/decisions\` | POST | an approved device, signed | ${ops('server/functions/decisions/index.ts')} |`,
      '| `/functions/v1/insights` | POST | an approved device, signed | `{}` → the 24 h path to profit across your engines (closest routes, what stops them), the road to mainnet step by step, engines the watchdog reports silent, and `chain`: the policies, competitors, venues and chain signals (indicators with verdicts) from every engine\'s studied trades |',
      '| `/functions/v1/alerts` | POST | an approved device, signed | one alert as JSON (the default for `CHRONOS_ALERT_WEBHOOK_URL` and `CHRONOS_WEBHOOK_URL`); escalations, errors, money made or lost and the verify-real test are kept in `reports` (kind `alert`), the rest answered `{kept:false}` |'].join('\n');
  },
  schema: () => {
    const sql = read('server/schema.sql'); const out = ['| Table | Columns |', '| --- | --- |'];
    for (const m of sql.matchAll(/create table public\.(\w+) \(\n([\s\S]*?)\n\);/g)) out.push(`| \`${m[1]}\` | ${m[2].split('\n').map((l) => l.trim()).filter((l) => !/^constraint /.test(l)).map((l) => '`' + l.split(' ')[0] + '`').join(', ')} |`);
    return out.join('\n');
  },
  envkeys: () => {
    const { ENV_KEYS } = require('./envkeys.cjs');
    const title = { advanced: 'Advanced tuning (leave unset unless you have a reason)', location: 'Where things are', platform: 'Set by Termux, the system or Chronos', test: 'Test hooks (never set on a real device)' };
    const out = [];
    for (const k of Object.keys(title)) { out.push(`### ${title[k]}`, '', '| Variable | Default | What it does |', '| --- | --- | --- |', ...ENV_KEYS.filter((x) => x.kind === k).map((x) => `| \`${x.key}\` | ${cell(x.def || '—')} | ${cell(x.what)} |`), ''); }
    return out.join('\n').trim();
  },
  deploypolicy: () => {
    const { DEPLOY_POLICY } = require('./deploy.cjs');
    return ['| Setting | Default | Allowed | What it does |', '| --- | --- | --- | --- |', ...DEPLOY_POLICY.map((p) => `| \`${p.key}\` | ${cell(p.def)} | ${p.min !== undefined ? `${p.min} – ${p.max}` : ''} | ${cell(p.what)} |`)].join('\n');
  },
  charter: () => {
    const { VP_CHARTER: C } = require('./company.cjs');
    const h = (ms) => `${ms / 3600000} h`;
    return [`**Mission.** ${C.mission}`, '', '**Objectives, in priority order** (the VP always works on the first one not yet met):', '', ...C.objectives.map((o, i) => `${i + 1}. ${o}`), '', '**Rules:**', '', ...C.rules.map((r) => `- ${r}`), '', '**Acceptance gate:**', '', `- Runtime changes: ${C.acceptance.runtime}.`, `- Code changes (the builder): ${C.acceptance.code}.`, '', `**Cadence:** a decision at most every ${h(C.cadence.decideEveryMs)}, verified after ${h(C.cadence.verifyMs)}; a build request every ${h(C.cadence.buildRequestEveryMs)} until profit (every ${h(4 * C.cadence.buildRequestEveryMs)} after); research every ${h(C.cadence.researchEveryMs)}.`].join('\n');
  },
  company: () => {
    const C = require('./company.cjs');
    return ['| Department | Mandate | Watches |', '| --- | --- | --- |', ...Object.values(C.DEPARTMENTS).map((d) => `| ${d.title} | ${cell(d.mandate)} | ${cell(d.logs.join(', '))} |`),
      '', 'Settings the VP may change while it holds full control (each execution-policy key is also within its authority, inside its own bounds):', '',
      '| Setting | Safe range |', '| --- | --- |', ...Object.entries(C.VP_SETTINGS).map(([k, v]) => `| \`${k}\` | ${v.min} – ${v.max} |`)].join('\n');
  },
  resolutions: () => {
    const R = require('./resolver.cjs');
    return ['| Problem | Automatic resolutions, in order (each verified, never repeated) | When those are used up, you |', '| --- | --- | --- |',
      ...Object.values(R.PROBLEMS).map((p) => `| ${cell(p.symptom)} | ${p.ladder.length ? p.ladder.map((a) => `\`${a}\``).join(' → ') : 'none: only you can resolve it'} | ${cell(p.you)} |`),
      '', '| Action | What it does |', '| --- | --- |', ...Object.entries(R.ACTIONS).map(([a, w]) => `| \`${a}\` | ${cell(w)} |`)].join('\n');
  },
  venues: () => {
    const V = JSON.parse(read('venues.json')).venues;
    return ['| Venue | Kind | Your contract can trade it | Router | Factory |', '| --- | --- | --- | --- | --- |', ...V.map((v) => v.kind === 'curve'
      ? `| \`${v.id}\` | curve | yes, through contract v2.3+ (each pool allowlisted) | — (direct pool swaps) | ${(v.pools || []).length} listed pools |`
      : `| \`${v.id}\` | ${v.kind} | ${v.executable && v.router ? 'yes' : 'quote only'} | ${v.router ? '`' + v.router + '`' : '—'} | \`${v.factory}\` |`), '', 'Every venue is checked on-chain at engine start (factory, router and quoter must agree; for Curve, each pool must hold the coins listed for it); one that fails is not used.'].join('\n');
  },
  tests: () => {
    const t = tests(); const total = t.reduce((a, x) => a + x.tests, 0);
    return [`**${total} tests in ${t.length} files; ${mutants()} planted bugs in \`test/mutate.cjs\`.** Run \`chronos test\`; run the planted-bug check with \`node test/mutate.cjs "$PWD"\`.`, '', '| Test file | Tests | Covers |', '| --- | --- | --- |', ...t.map((x) => `| \`${x.file}\` | ${x.tests} | ${cell(x.about || '')} |`)].join('\n');
  },
  version: () => `Version **${JSON.parse(read('package.json')).version}**.`,
};

const DOCS = ['README.md', 'CHANGELOG.md', 'docs/README.md', 'docs/COMPANY.md', 'docs/ARCHITECTURE.md', 'docs/CONFIGURATION.md', 'docs/COMMANDS.md', 'docs/OPERATIONS.md', 'docs/SECURITY.md', 'docs/TESTING.md', 'docs/RELEASING.md', 'docs/API.md'];
const RX = /<!-- GENERATED:(\w+) -->[\s\S]*?<!-- \/GENERATED:\1 -->/g;

// navigation shown at the top and bottom of every document: home first, then every other page
const PAGES = [['README.md', 'Project home'], ['docs/README.md', 'Docs home'], ['docs/COMPANY.md', 'Company'], ['docs/ARCHITECTURE.md', 'Architecture'], ['docs/CONFIGURATION.md', 'Configuration'], ['docs/COMMANDS.md', 'Commands'], ['docs/OPERATIONS.md', 'Operations'], ['docs/SECURITY.md', 'Security'], ['docs/TESTING.md', 'Testing'], ['docs/RELEASING.md', 'Releasing'], ['docs/API.md', 'Server API'], ['CHANGELOG.md', 'Changelog']];
function nav(file) {
  const from = path.posix.dirname(file);
  return PAGES.map(([f, t]) => (f === file ? `**${t}**` : `[${t}](${path.posix.relative(from, f) || path.posix.basename(f)})`)).join(' · ');
}

function render(text, file = 'docs/README.md') {
  return text.replace(RX, (_, name) => {
    const body = name === 'nav' ? nav(file) : blocks[name] ? blocks[name]() : null;
    if (body === null) throw new Error(`unknown generated block "${name}"`);
    return `<!-- GENERATED:${name} -->\n${body}\n<!-- /GENERATED:${name} -->`;
  });
}

// GitHub-style heading anchors
const slug = (h) => h.trim().toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-');
function anchors(text) {
  const seen = new Map(); const out = new Set();
  for (const m of text.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) { const b = slug(m[1]); const n = seen.get(b) || 0; out.add(n ? `${b}-${n}` : b); seen.set(b, n + 1); }
  return out;
}
/** every relative link and anchor in a document must resolve; external links must be https */
function links(file, raw) {
  const problems = [];
  const text = (raw === undefined ? read(file) : raw).replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^https?:/.test(target)) { if (!/^https:\/\//.test(target)) problems.push(`${file}: insecure link ${target}`); continue; }
    if (/^mailto:/.test(target)) continue;
    const [p, a] = target.split('#');
    const dest = p ? path.posix.normalize(path.posix.join(path.posix.dirname(file), p)) : file;
    if (!fs.existsSync(path.join(ROOT, dest))) { problems.push(`${file}: dead link ${target}`); continue; }
    if (a && dest.endsWith('.md') && !anchors(read(dest)).has(a)) problems.push(`${file}: no section #${a} in ${dest}`);
  }
  return problems;
}

// every setting name and every chronos command a document mentions must exist in the code
function codeText() {
  const files = [];
  for (const dir of ['bin', 'lib', 'tui', 'cloud']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (/\.(cjs|sh)$/.test(f)) files.push(`${dir}/${f}`);
  return [...files, 'go.sh', 'install.sh', 'scan.cjs', 'measure.cjs'].filter((f) => fs.existsSync(path.join(ROOT, f)) && f !== 'lib/docs.cjs').map(read).join('\n');
}
function consistency(docs = DOCS.filter((f) => fs.existsSync(path.join(ROOT, f))).map((f) => [f, read(f)])) {
  const problems = []; const code = codeText();
  const help = read('bin/chronos.cjs').match(/const HELP = `([\s\S]*?)`;/)[1];
  const commands = new Set([...help.matchAll(/^ {2}chronos(?: ([a-z-]+))?/gm)].map((m) => m[1] || ''));
  for (const [f, t] of docs) {
    const body = t.replace(/<!-- GENERATED:\w+ -->[\s\S]*?<!-- \/GENERATED:\w+ -->/g, '');
    for (const m of body.matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)) if (!code.includes(m[1])) problems.push(`${f}: mentions setting ${m[1]}, which the code does not use`);
    for (const m of body.matchAll(/`chronos ([a-z][a-z-]*)/g)) if (!commands.has(m[1])) problems.push(`${f}: mentions command "chronos ${m[1]}", which does not exist`);
  }
  return problems;
}

/** a document is stale when regenerating it would change it */
const stale = (file, text) => render(text, file) !== text;

/** problems with the docs as they stand (empty = in sync) */
function check() {
  const problems = [];
  for (const f of DOCS) {
    if (!fs.existsSync(path.join(ROOT, f))) { problems.push(`${f} is missing`); continue; }
    const t = read(f);
    if (stale(f, t)) problems.push(`${f} is out of date: run  chronos docs`);
    if (!t.includes('<!-- GENERATED:nav -->')) problems.push(`${f} has no navigation back home`);
    problems.push(...links(f));
  }
  if (!fs.existsSync(path.join(ROOT, ENV_EXAMPLE)) || read(ENV_EXAMPLE) !== envExample()) problems.push(`${ENV_EXAMPLE} is out of date: run  chronos docs`);
  for (const m of modules()) if (!m.purpose) problems.push(`${m.file} has no one-line header comment (what it is for)`);
  const v = JSON.parse(read('package.json')).version;
  if (fs.existsSync(path.join(ROOT, 'CHANGELOG.md')) && !new RegExp(`^## ${v.replace(/\./g, '\\.')}\\b`, 'm').test(read('CHANGELOG.md'))) problems.push(`CHANGELOG.md has no "## ${v}" entry`);
  problems.push(...consistency());
  for (const f of testFiles()) if (!fs.existsSync(path.join(ROOT, f))) problems.push(`${f} is in the test list but does not exist`);
  for (const f of fs.readdirSync(path.join(ROOT, 'test')).filter((x) => x.endsWith('.test.cjs'))) if (!testFiles().includes('test/' + f)) problems.push(`test/${f} is not in chronos test's list`);
  return problems;
}

/** the example .env, generated from the catalogs (secrets as names only: set them with chronos set, typed hidden) */
const ENV_EXAMPLE = '.env.scanner.example';
function envExample() {
  const C = require('./catalog.cjs'); const { POLICY } = require('./execpolicy.cjs'); const { DEPLOY_POLICY } = require('./deploy.cjs');
  const one = (s) => String(s).replace(/\s+/g, ' ');
  const out = ['# Chronos .env example: every setting you can set, generated by `chronos docs` from the code (do not edit by hand).',
    '# Easiest: chronos setup (asks, tests and saves each one). Secrets: chronos set KEY (typed hidden, tested, never echoed).', '# Docs: docs/CONFIGURATION.md', ''];
  for (const g of [...new Set(C.SECRETS.map((x) => x.group))]) {
    out.push(`# ── ${g}`);
    for (const x of C.SECRETS.filter((y) => y.group === g)) out.push(`# ${one(x.what)}${x.secret ? ' (secret)' : ''}`, `# ${x.key}=`);
    out.push('');
  }
  for (const g of [...new Set(C.SETTINGS.map((x) => x.group))]) {
    out.push(`# ── ${g} (suggested starting values; each is checked against its range)`);
    for (const x of C.SETTINGS.filter((y) => y.group === g)) out.push(`# ${one(x.what)} · ${x.min} – ${x.max}`, `${x.key}=${x.suggest}`);
    out.push('');
  }
  out.push('# ── Execution policy (defaults shown)');
  for (const p of POLICY) out.push(`# ${one(p.what)}`, `# ${p.key}=${p.def}`);
  out.push('', '# ── Deploy policy (defaults shown)');
  for (const p of DEPLOY_POLICY) out.push(`# ${one(p.what)}`, `# ${p.key}=${p.def}`);
  return out.join('\n') + '\n';
}

/** rewrite every generated block; returns the files changed */
function write() {
  const changed = [];
  for (const f of DOCS) {
    const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8'); const n = render(t, f);
    if (n !== t) { fs.writeFileSync(p, n); changed.push(f); }
  }
  const e = path.join(ROOT, ENV_EXAMPLE); const ex = envExample();
  if (!fs.existsSync(e) || fs.readFileSync(e, 'utf8') !== ex) { fs.writeFileSync(e, ex); changed.push(ENV_EXAMPLE); }
  return changed;
}

module.exports = { envExample, ENV_EXAMPLE, consistency, stale, check, write, render, links, anchors, slug, nav, PAGES, blocks, modules, tests, mutants, DOCS, header, rel };
