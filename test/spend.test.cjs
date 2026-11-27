'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Spend } = require('../lib/spend.cjs');
const { Brain } = require('../lib/llm.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'spend-'));

test('the daily cap: costs add up across kinds; anything whose worst case would go over is refused; you are told once', () => {
  const told = []; let t = Date.parse('2026-11-26T10:00:00Z');
  const s = new Spend({ dataDir: tmp(), cap: 5, tell: (a, b) => told.push([a, b]), now: () => t });
  assert.ok(s.allow('gas-loss', 3).ok); s.record('gas-loss', 3);
  assert.ok(s.allow('ai', 1.5).ok); s.record('ai', 1.5);
  assert.strictEqual(s.room(), 0.5);
  const no = s.allow('gas-loss', 0.6);
  assert.ok(!no.ok && /CHRONOS_DAILY_SPEND_CAP_USD/.test(no.why));
  assert.ok(s.allow('gas-loss', 0.5).ok, 'a send whose worst case fits still goes: the cap never stops a trade it can cover');
  s.allow('ai', 9); s.allow('ai', 9);
  assert.strictEqual(told.length, 1, 'told once a day, not on every refusal');
  assert.ok(!s.allow('who-knows', 0).ok, 'an unknown kind of spending is refused');
  assert.deepStrictEqual(s.today().byKind, { 'gas-loss': 3, ai: 1.5, other: 0 });
  t += 24 * 3600000; // the next UTC day starts empty
  assert.strictEqual(s.room(), 5); assert.ok(s.allow('ai', 4).ok);
});

test('the ledger survives a restart (same UTC day) and is written owner-only', () => {
  const dir = tmp(); const now = () => Date.parse('2026-11-26T10:00:00Z');
  new Spend({ dataDir: dir, cap: 5, now }).record('gas-loss', 4.2);
  const again = new Spend({ dataDir: dir, cap: 5, now });
  assert.ok(Math.abs(again.room() - 0.8) < 1e-9, 'a restart does not reset what was spent');
  assert.strictEqual(fs.statSync(path.join(dir, 'spend.json')).mode & 0o777, 0o600);
});

test('an unknown worst case counts as over the cap (fail closed)', () => {
  const s = new Spend({ dataDir: tmp(), cap: 5 });
  assert.ok(!s.allow('gas-loss', NaN).ok); assert.ok(!s.allow('gas-loss', undefined).ok);
});

test('AI calls: counted against the cap, refused before any request once it is reached', async () => {
  let posts = 0;
  const fetchImpl = async () => { posts++; return { ok: true, json: async () => ({ choices: [{ message: { content: '{"a":1}' } }] }) }; };
  const spend = new Spend({ dataDir: tmp(), cap: 0.05 });
  const b = new Brain({ get: (k) => (k === 'OPENROUTER_API_KEY' ? 'sk-or-v1-' + 'a'.repeat(64) : undefined), orModel: 'x/y', fetchImpl, spend, callUsd: 0.02 });
  assert.ok(b.ready, 'the stand-in key loads as an OpenRouter key');
  await b.chat({ system: 's', user: 'u' }); await b.chat({ system: 's', user: 'u' });
  await assert.rejects(b.chat({ system: 's', user: 'u' }), /CHRONOS_DAILY_SPEND_CAP_USD/);
  assert.strictEqual(posts, 2, 'the third call was never sent');
  assert.strictEqual(spend.today().byKind.ai, 0.04);
});
