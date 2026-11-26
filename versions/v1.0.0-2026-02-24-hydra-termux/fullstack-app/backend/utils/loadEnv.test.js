'use strict';
// Runs against real files in a temp directory (no mocks): node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadEnv, parseEnv } = require('./loadEnv');

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'apex-env-')); }

test('shared file wins over local .env, real environment wins over both', () => {
  const dir = tmpdir();
  const shared = path.join(dir, 'secrets.env');
  const local = path.join(dir, '.env');
  fs.writeFileSync(shared, 'A=shared\nB=shared\nC=\n', { mode: 0o600 });
  fs.writeFileSync(local, 'A=local\nC=local\nD=local\n');
  const env = { B: 'process' };
  const r = loadEnv({ env, sharedFile: shared, localFile: local, quiet: true });
  assert.deepStrictEqual({ A: env.A, B: env.B, C: env.C, D: env.D }, { A: 'shared', B: 'process', C: 'local', D: 'local' });
  assert.ok(r.sharedFound && r.localFound);
});

test('project prefix overrides the plain name for that project only', () => {
  const dir = tmpdir();
  const shared = path.join(dir, 'secrets.env');
  fs.writeFileSync(shared, 'JWT_SECRET=common\nVIP__JWT_SECRET=vip\nHYDRA__JWT_SECRET=hydra\n', { mode: 0o600 });
  const vip = {}; loadEnv({ env: vip, project: 'vip', sharedFile: shared, localFile: null, quiet: true });
  const other = {}; loadEnv({ env: other, project: 'assets', sharedFile: shared, localFile: null, quiet: true });
  assert.strictEqual(vip.JWT_SECRET, 'vip');
  assert.strictEqual(other.JWT_SECRET, 'common');
  assert.strictEqual(vip.HYDRA__JWT_SECRET, undefined);
});

test('aliases fill both the old and the canonical name', () => {
  const dir = tmpdir();
  const shared = path.join(dir, 'secrets.env');
  fs.writeFileSync(shared, 'SUPABASE_SERVICE_KEY=k\nTELEGRAM_BOT_TOKEN=t\n', { mode: 0o600 });
  const env = {}; loadEnv({ env, sharedFile: shared, localFile: null, quiet: true });
  assert.strictEqual(env.SUPABASE_SERVICE_ROLE_KEY, 'k');
  assert.strictEqual(env.TELEGRAM_TOKEN, 't');
});

test('missing shared file falls back to local .env without throwing', () => {
  const dir = tmpdir();
  const local = path.join(dir, '.env');
  fs.writeFileSync(local, 'ONLY_LOCAL=1\n');
  const env = {};
  const r = loadEnv({ env, sharedFile: path.join(dir, 'nope.env'), localFile: local, quiet: true });
  assert.strictEqual(env.ONLY_LOCAL, '1');
  assert.strictEqual(r.sharedFound, false);
});

test('parser handles export, quotes, comments and multi-line values', () => {
  const p = parseEnv('export A=1\nB="x y" \nC=\'q # not comment\'\nD=plain # comment\nE="line1\\nline2"\nF="a\nb"\nG=   # only a comment\n# X=no\n');
  assert.deepStrictEqual(p, { A: '1', B: 'x y', C: 'q # not comment', D: 'plain', E: 'line1\nline2', F: 'a\nb', G: '' });
});
