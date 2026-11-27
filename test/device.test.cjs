'use strict';
// This device's key and private-release downloads (a local stand-in plays the release function; test only).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

function fresh(env) { for (const [k, v] of Object.entries(env)) process.env[k] = v; delete require.cache[require.resolve('../lib/device.cjs')]; return require('../lib/device.cjs'); }

test('device key: Ed25519, created once at mode 600 in a 700 folder, stable; signatures verify against the public key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-'));
  const DV = fresh({ CHRONOS_DEVICE_KEY: path.join(dir, 'k', 'device.key') });
  const a = DV.key(); const b = DV.key();
  assert.strictEqual(a.pub, b.pub);
  assert.strictEqual(fs.statSync(path.join(dir, 'k', 'device.key')).mode & 0o777, 0o600);
  assert.strictEqual(fs.statSync(path.join(dir, 'k')).mode & 0o777, 0o700);
  const pk = crypto.createPublicKey({ key: Buffer.from(a.pub, 'base64'), format: 'der', type: 'spki' });
  assert.ok(crypto.verify(null, Buffer.from('hello'), pk, Buffer.from(a.sign('hello'), 'base64')));
  assert.strictEqual(DV.cmp('1.10.0', '1.9.9') > 0, true); assert.strictEqual(DV.cmp('1.1.0', '1.1.0'), 0);
});

test('device download: written only when the sha256 matches the published one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-'));
  const blob = crypto.randomBytes(5000); let served = blob; let sha = crypto.createHash('sha256').update(blob).digest('hex');
  const srv = http.createServer((q, r) => { let b = ''; q.on('data', (d) => { b += d; }); q.on('end', () => {
    if (q.method === 'POST') { r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ ok: true, url: `http://127.0.0.1:${srv.address().port}/file`, sha256: sha })); }
    r.writeHead(200); r.end(served); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const DV = fresh({ CHRONOS_DEVICE_KEY: path.join(dir, 'device.key'), CHRONOS_RELEASE_BASE: `http://127.0.0.1:${srv.address().port}/` });
    const ok = await DV.download('1.1.0', path.join(dir, 'a.tgz'));
    assert.strictEqual(ok.sha256, sha); assert.deepStrictEqual(fs.readFileSync(path.join(dir, 'a.tgz')), blob);
    assert.strictEqual(fs.statSync(path.join(dir, 'a.tgz')).mode & 0o777, 0o600);
    served = Buffer.concat([blob, Buffer.from('x')]);
    await assert.rejects(DV.download('1.1.0', path.join(dir, 'b.tgz')), /does not match the published/);
    assert.ok(!fs.existsSync(path.join(dir, 'b.tgz')), 'a mismatched archive is never written');
  } finally { srv.close(); delete process.env.CHRONOS_RELEASE_BASE; }
});
