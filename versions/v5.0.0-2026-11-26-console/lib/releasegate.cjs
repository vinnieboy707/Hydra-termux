'use strict';
// The release gate: every version passes ALL of these before it can be packaged (package.sh runs `chronos
// release-check` and refuses to build on any failure). Nothing is skipped and nothing is marked passed without being
// run. Each failure names its fix.
//   1. version     package.json's version has its own CHANGELOG entry
//   2. syntax      every code file parses (node --check), shell scripts parse (sh -n)
//   3. docs        every generated document matches the code (README, docs/*, API, schema tables, settings, example .env)
//   4. settings    every setting the code reads is documented; none twice; none stale
//   5. contract    the shipped contract source and bytecode match their recorded hashes; the probe embeds that build
//   6. server      every server function and the schema shipped are the ones deployed (server/DEPLOYED.json)
//   7. counterparts every test stand-in has a real counterpart check (test/counterparts.json)
//   8. planted bugs every planted bug still targets real code (test/mutate.cjs anchors)
//   9. tests       the full suite passes (chronos test)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const run = (cmd, args, extra = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 1800000, ...extra });

/** what the deployed server holds, fingerprinted the same way (index.ts + auth.ts per function; the schema file) */
function serverFingerprint() {
  const dir = path.join(ROOT, 'server', 'functions'); const functions = {};
  for (const f of fs.readdirSync(dir).sort()) {
    const idx = path.join(dir, f, 'index.ts'); if (!fs.existsSync(idx)) continue;
    const auth = path.join(dir, f, 'auth.ts');
    functions[f] = sha(fs.readFileSync(idx, 'utf8') + (fs.existsSync(auth) ? fs.readFileSync(auth, 'utf8') : ''));
  }
  return { schema: sha(read('server/schema.sql')), functions };
}

const STEPS = [
  ['version', 'the version has its CHANGELOG entry', () => {
    const v = JSON.parse(read('package.json')).version;
    return new RegExp(`^## ${v.replace(/\./g, '\\.')} — `, 'm').test(read('CHANGELOG.md')) ? { ok: true, detail: `v${v}` } : { ok: false, detail: `no "## ${v} — <date>" entry`, fix: 'write the CHANGELOG entry for this version' };
  }],
  ['syntax', 'every code file and script parses', () => {
    const bad = [];
    for (const d of ['bin', 'lib', 'tui', 'test']) for (const f of fs.readdirSync(path.join(ROOT, d)).filter((x) => x.endsWith('.cjs'))) { const r = run(process.execPath, ['--check', path.join(d, f)]); if (r.status !== 0) bad.push(`${d}/${f}`); }
    for (const f of ['install.sh', 'go.sh', 'sync/workspace-sync.sh', 'sync/laptop-setup.sh', 'cloud/gcp-setup.sh', 'cloud/mainnet-cloud.sh']) if (fs.existsSync(path.join(ROOT, f)) && run('sh', ['-n', f]).status !== 0) bad.push(f);
    return bad.length ? { ok: false, detail: bad.join(', '), fix: 'fix the syntax error in each file' } : { ok: true, detail: 'all parse' };
  }],
  ['docs', 'documentation matches the code', () => { const r = run(process.execPath, ['bin/chronos.cjs', 'docs', '--check']); return r.status === 0 ? { ok: true, detail: 'current' } : { ok: false, detail: (r.stdout + r.stderr).trim().split('\n').slice(-3).join(' · '), fix: 'chronos docs' }; }],
  ['settings', 'every setting documented once, none stale', () => { const r = run(process.execPath, ['--require', './test/isolate.cjs', '--test', 'test/envkeys.test.cjs']); return r.status === 0 ? { ok: true, detail: 'documented' } : { ok: false, detail: 'see test/envkeys.test.cjs', fix: 'document the setting in lib/catalog.cjs or lib/envkeys.cjs' }; }],
  ['contract', 'contract source, bytecode and probe agree', () => {
    try {
      const D = require('./deploy.cjs'); D.loadArtifact(D.ARTIFACT); D.loadArtifact(D.ARTIFACT_V2);
      const a = JSON.parse(read('contract/ChronosFlashArbV2.json')), b = JSON.parse(read('contracts/v2/ChronosFlashArbV2.json'));
      if (a.bytecode !== b.bytecode) return { ok: false, detail: 'contract/ and contracts/v2/ builds differ', fix: 'copy the tested build to both' };
      return { ok: true, detail: `v2 build ${a.bytecodeSha256.slice(0, 12)}` };
    } catch (e) { return { ok: false, detail: e.message, fix: 'rebuild the artifact from the tested source' }; }
  }],
  ['server', 'the server functions and schema shipped are the ones deployed', () => {
    let rec; try { rec = JSON.parse(read('server/DEPLOYED.json')); } catch (_) { return { ok: false, detail: 'server/DEPLOYED.json missing', fix: 'deploy, then record what was deployed' }; }
    const now = serverFingerprint(); const diff = [];
    if (rec.schema !== now.schema) diff.push('schema.sql (apply its change to the live database, then record it)');
    for (const [f, h] of Object.entries(now.functions)) if (rec.functions[f] !== h) diff.push(`function ${f} (deploy it)`);
    for (const f of Object.keys(rec.functions)) if (!now.functions[f]) diff.push(`function ${f} is deployed but no longer shipped`);
    return diff.length ? { ok: false, detail: diff.join('; '), fix: 'deploy / migrate, then node bin/chronos.cjs release-check --record-deployed' } : { ok: true, detail: `${Object.keys(now.functions).length} functions + schema, as deployed` };
  }],
  ['counterparts', 'every stand-in has a real counterpart', () => {
    // the named test must actually run and pass: a pattern that matches nothing used to "pass" with zero tests run
    const NAME = 'every stand-in is paired with a real system and a real check that exists';
    const r = run(process.execPath, ['--require', './test/isolate.cjs', '--test', `--test-name-pattern=${NAME}`, 'test/realcheck.test.cjs']);
    const ran = new RegExp(`^\\s*ok \\d+ - ${NAME}`, 'm').test(r.stdout + r.stderr);
    if (!ran) return { ok: false, detail: r.status === 0 ? 'the counterpart test did not run (renamed or filtered out)' : 'see test/realcheck.test.cjs', fix: r.status === 0 ? 'keep the test name in lib/releasegate.cjs in step with test/realcheck.test.cjs' : 'register the stand-in in test/counterparts.json with its real check' };
    return { ok: true, detail: 'complete (the test ran and passed)' };
  }],
  ['planted-bugs', 'every planted bug targets real code', () => { const r = run(process.execPath, ['test/mutate.cjs', ROOT], { env: { ...process.env, MUTANT_CHECK: '1' } }); const miss = (r.stdout + r.stderr).split('\n').filter((l) => /MISSING|not found/i.test(l)); return r.status === 0 && !miss.length ? { ok: true, detail: 'all anchors present' } : { ok: false, detail: miss.slice(0, 3).join(' · ') || 'see test/mutate.cjs', fix: 'repoint each planted bug at the code it guards' }; }],
  ['tests', 'the full suite passes', () => { const r = run(process.execPath, ['bin/chronos.cjs', 'test']); const m = (r.stdout + r.stderr).match(/# pass (\d+)[\s\S]*# fail (\d+)/); return r.status === 0 ? { ok: true, detail: m ? `${m[1]} passed` : 'passed' } : { ok: false, detail: m ? `${m[2]} failing` : 'failed', fix: 'chronos test, then fix each failure' }; }],
];

/** run every step in order (none skipped) → { ok, results } */
function check({ only = null, log = () => {} } = {}) {
  const results = [];
  for (const [id, title, fn] of STEPS) {
    if (only && !only.includes(id)) continue;
    let r; try { r = fn(); } catch (e) { r = { ok: false, detail: e.message, fix: 'see the error' }; }
    results.push({ id, title, ...r }); log(`${r.ok ? '✓' : '✗'} ${id.padEnd(13)} ${title}: ${r.detail}${r.ok ? '' : `\n    fix: ${r.fix}`}`);
  }
  return { ok: results.every((r) => r.ok), results };
}

function recordDeployed() { const f = serverFingerprint(); fs.writeFileSync(path.join(ROOT, 'server', 'DEPLOYED.json'), JSON.stringify({ note: 'what is deployed on your Supabase project (functions and the schema applied); written right after each deploy/migration', at: new Date().toISOString(), ...f }, null, 2) + '\n'); return f; }

module.exports = { check, recordDeployed, serverFingerprint, STEPS };
