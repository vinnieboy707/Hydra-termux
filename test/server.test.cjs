'use strict';
// Nothing the code sends, reads or writes has nowhere to land: every table and column the engine sends is accepted
// by the ingest route and exists in server/schema.sql; every column the server routes use exists; every request the
// engine makes is a route that exists; every table and column the portal uses exists; every table has row-level
// security and grants nothing to signed-out visitors or TRUNCATE to anyone. (The live database is checked against the
// same needs by portal/real_check.sql.)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function schema() {
  const sql = read('server/schema.sql'); const tables = {};
  for (const m of sql.matchAll(/create table public\.(\w+) \(\n([\s\S]*?)\n\);/g)) tables[m[1]] = m[2].split('\n').map((l) => l.trim()).filter((l) => !/^constraint /.test(l)).map((l) => l.split(' ')[0]);
  // views (security_invoker): their columns, from the select list or the `as t(...)` of a values list
  const views = {};
  for (const m of sql.matchAll(/create or replace view public\.(\w+)[^\n]* as\n([\s\S]*?);\n/g)) {
    const t = m[2].match(/\) as t\(([^)]*)\)/);
    if (t) { views[m[1]] = t[1].split(',').map((x) => x.trim()); continue; }
    // the view's own columns: its first top-level select (views built WITH … read their final select the same way)
    let flat = m[2]; for (let i = 0; i < 8; i++) flat = flat.replace(/\([^()]*\)/g, '0'); // subqueries and CTE bodies → 0
    const b = flat.match(/^select ([\s\S]*?)\s+from (?:public\.)?\w+/m)[1];
    views[m[1]] = b.split(',').map((x) => x.trim()).map((x) => (x.match(/ as (\w+)$/) || [null, x.split(/\s/)[0]])[1]);
  }
  return { sql, tables, views };
}
function ingestTables() {
  const src = read('server/functions/ingest/index.ts'); const out = {};
  for (const m of src.matchAll(/^\s+(\w+): \{ cols: \[([^\]]+)\]/gm)) out[m[1]] = m[2].split(',').map((c) => c.trim().replace(/'/g, ''));
  return out;
}

test('server/schema.sql defines every table; each has row-level security; no grant to signed-out visitors or of TRUNCATE', () => {
  const { sql, tables } = schema();
  assert.ok(Object.keys(tables).length >= 13);
  for (const t of Object.keys(tables)) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security;`), t);
    assert.match(sql, new RegExp(`revoke all on public\\.${t} from anon, authenticated;`), t);
  }
  assert.doesNotMatch(sql, /grant [^;]*truncate/i); assert.doesNotMatch(sql, /grant [^;]* to [^;]*anon/i);
});

test('every table and column the engine sends is accepted by the ingest route and exists in the schema', () => {
  const ing = ingestTables(); const { tables } = schema();
  const SYNC = require('../lib/sync.cjs'); const V = require('../lib/vocab.cjs');
  const sent = {
    opportunities: Object.keys(SYNC.MAP.opportunity({ runParams: { asset: '0x', amount: 1n, legs: [] }, netUsd: 1, grossUsd: 1, gasUsdAssumed: 0, premiumUsd: 0, routeKey: 'r' }, 1, 0)),
    shadow_runs: Object.keys(SYNC.MAP.shadow({ route: 'r', block: 1, at: 0, stage: 'done', win: true })),
    executions: Object.keys(SYNC.MAP.execution({ txHash: '0x' }, 0, {})),
    balances_verified: Object.keys(SYNC.MAP.balances({ rows: [{ label: 'x', address: '0x', eth: { verified: true, amount: 1 } }] }, 1, 0)[0]),
    route_stats: Object.keys(require('../lib/insights.cjs').nearMisses({ blockNumber: 1, candidates: [{ netUsd: -1, legsCount: 2, path: ['USDC', 'WETH', 'USDC'], grossUsd: 1, premiumUsd: 0.1, gasUsdAssumed: 2 }] }, 1)[0]),
    agent_events: Object.keys(V.eventRow({ ts: '', agent: 'a', severity: 'info', source: 's', message: 'm', action: null, outcome: 'none', detail: null })),
  };
  // rows built inline in the engine: their keys are read from the code itself
  const src = [...['lib', 'tui', 'bin'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.cjs')).map((f) => `${d}/${f}`))].map(read).join('\n');
  const topLevel = (body) => { let b = body; for (let i = 0; i < 8; i++) b = b.replace(/\{[^{}]*\}|\([^()]*\)|\[[^\[\]]*\]|`[^`]*`|'[^']*'/g, '0'); return [...b.matchAll(/(?:^|, )(\w+)(?::|,|$)/g)].map((x) => x[1]); };
  for (const m of src.matchAll(/enqueue\('(\w+)', \{ ([^\n]*) \}\);/g)) if (!sent[m[1]]) sent[m[1]] = topLevel(m[2]);
  const enqueued = new Set([...src.matchAll(/enqueue\('(\w+)'/g)].map((m) => m[1]));
  assert.ok(enqueued.size >= 9, [...enqueued].join(','));
  for (const t of enqueued) {
    assert.ok(ing[t], `the engine sends ${t} but the ingest route does not accept it`);
    assert.ok(tables[t], `the ingest route accepts ${t} but the schema has no such table`);
    for (const c of ing[t]) assert.ok(tables[t].includes(c), `ingest allows ${t}.${c}, which the schema does not have`);
    if (sent[t]) for (const c of sent[t]) assert.ok(ing[t].includes(c), `the engine sends ${t}.${c}, which ingest would silently drop`);
  }
  for (const t of Object.keys(ing)) assert.ok(enqueued.has(t), `ingest accepts ${t}, which the engine never sends (dead route)`);
});

test('every column the release and decisions routes use exists; every request the engine makes is a route that exists', () => {
  const { tables } = schema();
  const rel = read('server/functions/release/index.ts'); const dec = read('server/functions/decisions/index.ts'); const auth = read('server/functions/ingest/auth.ts');
  const used = { devices: ['id', 'status', 'code', 'can_publish', 'pubkey', 'name', 'last_seen', 'version', 'created_at', 'executor_address', 'kms_key', 'executor_at'], releases: ['version', 'sha256', 'size_bytes', 'notes', 'created_at', 'path', 'published_by'], approvals: ['ref', 'status', 'decided_at', 'applied_at', 'applied_result'] };
  for (const [t, cols] of Object.entries(used)) for (const c of cols) { assert.ok(tables[t].includes(c), `${t}.${c}`); assert.ok((rel + dec + auth).includes(c), `${c} is listed but no route uses it`); }
  const relOps = [...rel.matchAll(/b\?\.op === '(\w+)'/g)].map((m) => m[1]); const decOps = [...dec.matchAll(/b\?\.op === '(\w+)'/g)].map((m) => m[1]);
  const engineOps = [...read('lib/device.cjs').matchAll(/op: '(\w+)'/g)].map((m) => m[1]);
  for (const o of engineOps) assert.ok(relOps.includes(o), `the engine asks the release route for ${o}, which it does not have`);
  for (const o of relOps) assert.ok(engineOps.includes(o), `the release route has ${o}, which nothing calls (dead route)`);
  const calls = [...read('lib/agents.cjs').matchAll(/sync\.call\('(\w+)', \{ op: '(\w+)'/g)].map((m) => [m[1], m[2]]);
  assert.ok(calls.length >= 2);
  for (const [fn, op] of calls) { assert.ok(fs.existsSync(path.join(ROOT, 'server', 'functions', fn, 'index.ts')), fn); assert.ok(decOps.includes(op), `${fn} ${op}`); }
  for (const o of decOps) assert.ok(calls.some((c) => c[1] === o), `decisions has ${o}, which nothing calls`);
});

test('every table and column the portal reads or writes exists in the schema', () => {
  const p = path.join(ROOT, '..', 'portal', 'public', 'index.html');
  if (!fs.existsSync(p)) return; // the portal ships separately; checked where both are present
  const html = fs.readFileSync(p, 'utf8'); const s = schema(); const tables = { ...s.tables, ...s.views };
  assert.deepStrictEqual(Object.keys(s.views).sort(), ['chain_indicators', 'chain_numbers', 'chain_policies', 'competitors', 'mainnet_progress', 'profit_gap', 'route_insights', 'venue_usage']);
  for (const v of Object.keys(s.views)) assert.match(s.sql, new RegExp(`create or replace view public\\.${v} with \\(security_invoker = true\\)`), `${v} must run with the reader's rights`);
  for (const m of html.matchAll(/from\('(\w+)'\)\.(select|update|insert)\(([^)]*)\)/g)) {
    assert.ok(tables[m[1]], `portal uses ${m[1]}, which the schema does not have`);
    const cols = m[2] === 'select' && /^'[\w,]+'$/.test(m[3]) ? m[3].slice(1, -1).split(',') : [];
    for (const c of cols) assert.ok(tables[m[1]].includes(c), `portal reads ${m[1]}.${c}, which the schema does not have`);
  }
});

test('the alerts route writes only columns and a kind the reports table accepts, and the engine posts to it', () => {
  const { tables } = schema();
  const src = read('server/functions/alerts/index.ts'); const sql = read('server/schema.sql');
  const ins = src.match(/from\('(\w+)'\)\.insert\(\{(.*)\}\);/); assert.ok(ins, 'alerts inserts a row');
  assert.strictEqual(ins[1], 'reports');
  let top = ins[2]; while (/\{[^{}]*\}/.test(top)) top = top.replace(/\{[^{}]*\}/g, '_'); // only the row's own keys, not those inside body
  const keys = top.replace(/\([^()]*\)/g, '').split(',').map((x) => x.trim().match(/^(\w+)/)[1]); assert.deepStrictEqual(keys, ['day', 'kind', 'title', 'body', 'critical']);
  for (const c of keys) assert.ok(tables.reports.includes(c), `alerts writes reports.${c}, which the schema does not have`);
  const kind = src.match(/kind: '([\w-]+)'/)[1]; assert.match(sql.match(/reports_kind_check[^\n]*/)[0], new RegExp(`'${kind}'`), `reports does not accept kind ${kind}`);
  assert.strictEqual(read('server/functions/alerts/auth.ts'), read('server/functions/ingest/auth.ts'), 'alerts checks devices exactly as ingest does');
  assert.match(read('lib/hookurl.cjs'), /\/alerts'\)/, 'the engine defaults its webhooks to the alerts route');
  for (const f of ['lib/daemon.cjs', 'lib/realcheck.cjs']) assert.match(read(f), /hookurl\.cjs'\)\.effective\(/, `${f} uses the default alerts route`);
});

test('every server function is called by the engine (no dead routes), and the insights route reads only views and tables that exist', () => {
  const fns = fs.readdirSync(path.join(ROOT, 'server', 'functions')).filter((f) => fs.existsSync(path.join(ROOT, 'server', 'functions', f, 'index.ts')));
  assert.deepStrictEqual(fns.sort(), ['alerts', 'decisions', 'ingest', 'insights', 'release', 'vault']);
  const src = ['lib', 'tui', 'bin'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.cjs')).map((f) => read(`${d}/${f}`))).join('\n');
  const callers = { alerts: /\/alerts'\)/, decisions: /sync\.call\('decisions'/, ingest: /\/ingest'\)/, insights: /sync\.call\('insights'/, release: /\/release'/, vault: /\.call\('vault'/ };
  for (const f of fns) assert.match(src, callers[f], `nothing in the engine calls the ${f} route`);
  const s = schema(); const all = { ...s.tables, ...s.views };
  const ins = read('server/functions/insights/index.ts');
  for (const m of ins.matchAll(/from\('(\w+)'\)\.select\('([\w,]+)'\)/g)) for (const c of m[2].split(',')) assert.ok((all[m[1]] || []).includes(c), `insights reads ${m[1]}.${c}, which the schema does not have`);
  assert.match(read('server/functions/ingest/index.ts'), /if \(body\.table === 'route_stats'\) \{\n.*\n    for \(const r of rows\) r\.device = a\.device;/, 'route stats are tied to the approved engine that sent them, never to what the row claims');
  assert.ok(!read('server/functions/ingest/index.ts').match(/route_stats: \{ cols: \[[^\]]*'device'/), 'the engine cannot choose the device');
  for (const t of ['chain_trades', 'pool_moves']) assert.ok(!read('server/functions/ingest/index.ts').match(new RegExp(`${t}: \\{ cols: \\[[^\\]]*'device'`)), `${t}: the engine cannot choose the device`);
  assert.strictEqual(read('server/functions/insights/auth.ts'), read('server/functions/ingest/auth.ts'), 'insights checks devices exactly as ingest does');
});
