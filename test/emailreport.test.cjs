'use strict';
// The daily report email (2.9.12): steps left from today to $100,000, the road with who acts, the profit ladder with
// what you keep after the 30% tax reserve, needs-you with commands, buttons to your portal. HTML for every mail
// client: tables and inline styles, no scripts or remote images, everything escaped. The real counterpart is the
// email itself: Resend delivers it (email_log in your project records each request).
const test = require('node:test');
const assert = require('node:assert');
const ER = require('../lib/emailreport.cjs');
const M = require('../lib/milestones.cjs');

const road = M.MILESTONES.map((m, i) => ({ step: i + 1, id: m.id, version: m.version, title: m.title, owner: m.owner, done: i < 2, evidence: i < 2 ? 'verified on chain' : null, todo: i === 2 ? 'run chronos verify-real' : 'waiting' }));

test('the ladder counts verified profit only, to $100,000, with what you keep after the tax reserve', () => {
  const l = M.ladder(0); assert.strictEqual(l.length, 8); assert.ok(l.every((x) => !x.done)); assert.strictEqual(l.at(-1).usd, 100000); assert.strictEqual(l.at(-1).keepUsd, 70000);
  const m = M.ladder(2500); assert.deepStrictEqual(m.filter((x) => x.done).map((x) => x.usd), [1, 100, 1000]); assert.strictEqual(m[3].pct, 38, '$2,500 of the way from $1,000 to $5,000');
  assert.strictEqual(M.ladder(-50).filter((x) => x.done).length, 0, 'a loss never counts as a rung');
  const s = M.stepsLeft(road, 0); assert.deepStrictEqual([s.total, s.done, s.left], [16, 2, 14]); assert.strictEqual(s.next.step, 3);
});

test('the report email: steps left, next step with its command, road, ladder, needs you, portal buttons; safe HTML', () => {
  const r = ER.build({ day: '2026-11-26', version: '2.9.12', cash: { netUsdLast24h: 0, realizedNetUsdAllTime: 0, taxReserveUsd: 0, executorGasEth: 0.005, executorReady: false }, trading: { cyclesChecked: 1200, rawGaps: 3, approved: 0, bestNetUsd: -0.4, topBlocker: 'no price gap' }, risk: { mode: 'SHADOW', sentToday: 0 }, road, needsYou: ['executor key is locked: chronos executor unlock', '<script>alert(1)</script>'], decisions: [{ what: 'verify-real', outcome: 'done' }], departments: { trading: 'amber', risk: 'green' }, vpNote: 'Working on depth.', portalUrl: 'https://chronos-portal.web.app/' });
  assert.match(r.subject, /14 steps to \$100k/);
  assert.match(r.html, /2 of 16 steps done · 14 left/); assert.match(r.html, /step 3, Every real check passes/);
  assert.match(r.html, /<code[^>]*>chronos verify-real<\/code>/, 'the command is shown as code'); assert.match(r.html, /<code[^>]*>chronos executor unlock<\/code>/);
  assert.match(r.html, /\$100,000 verified and received/); assert.match(r.html, /you keep \$70,000/);
  assert.match(r.html, /href="https:\/\/chronos-portal\.web\.app\/#road"/);
  assert.ok(!/<script/i.test(r.html), 'no script, the needs-you text is escaped'); assert.match(r.html, /&lt;script&gt;/);
  assert.ok(!/<img|src="http/i.test(r.html), 'no remote images or tracking');
  const noPortal = ER.build({ day: 'd', road, cash: {}, trading: {}, risk: {}, portalUrl: 'javascript:alert(1)' });
  assert.ok(!/href=/.test(noPortal.html), 'no portal url (or a bad one): no buttons');
});

test('the company files the HTML with the daily report (the database sends it; the text stays as the fallback)', async () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'company.cjs'), 'utf8');
  assert.match(src, /body\.html = em\.html; body\.subject = em\.subject;/);
  const sql = require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'schema.sql'), 'utf8');
  assert.match(sql, /chronos_email\(subject text, body text, html text default null\)/);
  assert.match(sql, /same alert emailed in the last 30 minutes/, 'a repeating alert cannot use up the day\'s emails');
  assert.match(sql, /nullif\(new\.body->>'html', ''\)/);
});
