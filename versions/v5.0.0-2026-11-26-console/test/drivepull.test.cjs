'use strict';
// The Drive key pull (2.9.12): rclone's error is explained in words with its fix instead of "error"; harmless problems
// are not failures; a top-level .env is matched; one folder can be set instead of listing your whole Drive. rclone is
// played by fakeRclone (its exit, stderr and files); its real counterpart is rclone with your gdrive: remote on the
// phone, checked by chronos verify-real → drive-remote (which prints the real rclone answer).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const DP = require('../lib/drivepull.cjs');

function fakeRclone({ code = 0, stderr = '', killed = false, files = {} } = {}) {
  const calls = [];
  const runImpl = async (bin, args) => {
    calls.push(args); const dir = args[2];
    for (const [rel, body] of Object.entries(files)) { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); }
    const err = code || killed ? Object.assign(new Error(killed ? 'Command failed: killed' : `Command failed: rclone copy (exit ${code})`), { code, killed, signal: killed ? 'SIGTERM' : null }) : null;
    return { err, stdout: '', stderr };
  };
  return { runImpl, calls };
}

test('the pull: a top-level .env is matched, one folder can be set, Drive is listed fast and under Google\'s limits', async () => {
  for (const pat of ['.env', '.env.*', '*.env', '*ENV SECRETS*']) assert.ok(DP.INCLUDE.includes(pat), pat + ' matches at any depth, the top of the Drive included');
  const f = fakeRclone({ files: { '.env': 'A=1', 'Secrets/_.ENV SECRETS .txt': 'B=2' } });
  const r = await DP.pullEnvFiles({ runImpl: f.runImpl, folder: '/Chronos/env/' });
  try {
    assert.strictEqual(r.ok, true); assert.strictEqual(r.files.length, 2); assert.strictEqual(r.why, null);
    assert.strictEqual(f.calls[0][1], 'gdrive:Chronos/env', 'only that folder is read');
    for (const flag of ['--fast-list', '--tpslimit', '--drive-acknowledge-abuse', '--log-file']) assert.ok(f.calls[0].includes(flag), flag);
    assert.strictEqual((fs.statSync(r.files[0]).mode & 0o777).toString(8), '600');
  } finally { DP.cleanup(r.dir); }
});

test('rclone errors are explained with their fix; harmless ones are not failures', async () => {
  const cases = [
    [{ code: 1, stderr: '2026/11/26 ERROR : Failed to create file system: couldn\'t fetch token: invalid_grant: maybe token expired?' }, true, /sign-in for rclone expired.*rclone config reconnect gdrive:/],
    [{ killed: true }, true, /over 4 min to list.*CHRONOS_DRIVE_ENV_FOLDER/],
    [{ code: 1, stderr: 'ERROR : googleapi: Error 403: User Rate Limit Exceeded., userRateLimitExceeded' }, false, /limited the requests/],
    [{ code: 1, stderr: 'NOTICE: Secrets/.env: Duplicate object found in source - ignoring' }, false, /share a name.*harmless/],
    [{ code: 1, stderr: 'ERROR : x.pdf: cannotDownloadAbusiveFile' }, false, /could not be exported/],
    [{ code: 1, stderr: 'ERROR : dial tcp: lookup www.googleapis.com: no such host' }, false, /no connection to Google Drive/],
    [{ code: 3, stderr: 'ERROR : : error reading source root directory: directory not found' }, true, /CHRONOS_DRIVE_ENV_FOLDER does not exist/],
    [{ code: 2, stderr: 'ERROR : something new happened key=sk-or-v1-abcdefghijklmnopqrstu' }, true, /^rclone: ERROR : something new happened/],
  ];
  for (const [fake, fatal, re] of cases) {
    const r = await DP.pullEnvFiles({ runImpl: fakeRclone(fake).runImpl, folder: fake.code === 3 ? 'Nope' : '' });
    try { assert.strictEqual(r.fatal, fatal, r.why); assert.strictEqual(r.ok, !fatal, r.why); assert.match(r.why, re); assert.ok(!/sk-or-v1-abc/.test(r.why), 'secrets never shown'); } finally { DP.cleanup(r.dir); }
  }
  const some = await DP.pullEnvFiles({ runImpl: fakeRclone({ code: 1, stderr: 'ERROR : invalid_grant', files: { '.env': 'A=1' } }).runImpl });
  try { assert.strictEqual(some.ok, true, 'files that arrived are still used'); assert.match(some.why, /some files arrived/); } finally { DP.cleanup(some.dir); }
});

test('2.9.18: ordered --filter rules (exclusions first, then the env patterns, then everything else out); never --include with --exclude', async () => {
  const f = fakeRclone({ files: { '.env': 'A=1' } });
  const r = await DP.pullEnvFiles({ runImpl: f.runImpl });
  try {
    const a = f.calls[0];
    assert.ok(!a.includes('--include') && !a.includes('--exclude'), 'no mixed include/exclude: rclone reported their order as an ERROR');
    const rules = a.map((x, i) => (x === '--filter' ? a[i + 1] : null)).filter(Boolean);
    assert.ok(rules.length > 3); assert.strictEqual(rules[rules.length - 1], '- **', 'everything not named is left out');
    const firstPlus = rules.findIndex((x) => x.startsWith('+ ')); assert.ok(firstPlus > 0, 'there are exclusions before the first inclusion');
    assert.ok(rules.slice(0, firstPlus).every((x) => x.startsWith('- ')) && rules.slice(firstPlus, -1).every((x) => x.startsWith('+ ')), 'exclusions come first, so they always win');
    assert.ok(rules.includes('+ .env'));
  } finally { DP.cleanup(r.dir); }
  const warn = await DP.pullEnvFiles({ runImpl: fakeRclone({ code: 1, stderr: '2026/11/26 ERROR : Using --filter is recommended instead of both --include and --exclude as the order they are parsed in is indeterminate' }).runImpl });
  try { assert.strictEqual(warn.fatal, false); assert.match(warn.why, /filter order/); } finally { DP.cleanup(warn.dir); }
});
