'use strict';
// test_integrity_claims.js - checks that what the code claims is enforced. Exit code 1 on any failure.
const fs = require('fs');
const os = require('os');
const path = require('path');
const status = require('./src/integrity-status');

const BANNED = [/100% Production-Grade/, /Zero [Ss]imulation/, /STRICT-FAIL-CLOSED ACTIVE/, /REAL PROFIT SIGNAL/, /VERIFIED_COMPOUNDED_PRODUCTION_SETTLED/];
let failed = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + ': ' + e.message); }
}
function expectThrow(fn, re, what) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  if (!err) throw new Error(what + ' did not throw');
  if (re && !re.test(err.message)) throw new Error(what + ' threw an unexpected error: ' + err.message);
}

(async () => {
  await check('no false claims remain in production code', () => {
    const hits = [];
    for (const p of status.codeFiles()) {
      if (path.basename(p) === 'test_integrity_claims.js') continue;
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (BANNED.some((re) => re.test(line))) hits.push(path.relative(process.cwd(), p) + ':' + (i + 1));
      });
    }
    if (hits.length) throw new Error(hits.slice(0, 6).join(', ') + (hits.length > 6 ? ' ...' : ''));
  });

  await check('send guard blocks by default', () => {
    delete process.env.CHRONOS_LIVE; delete process.env.KILL_SWITCH;
    process.env.KILL_SWITCH_FILE = path.join(os.tmpdir(), 'chronos-no-such-kill-file');
    expectThrow(() => require('./src/send-guard').assertLiveAllowed('t'), /CHRONOS_LIVE/, 'guard');
  });

  await check('send guard honours the kill switch even when live', () => {
    process.env.CHRONOS_LIVE = '1'; process.env.KILL_SWITCH = '1';
    expectThrow(() => require('./src/send-guard').assertLiveAllowed('t'), /kill switch/, 'guard');
    delete process.env.KILL_SWITCH;
    require('./src/send-guard').assertLiveAllowed('t');
    delete process.env.CHRONOS_LIVE;
  });

  await check('every file with a send call carries a guard call', () => {
    const bad = status.sendSites().filter((x) => !x.guarded).map((x) => x.file);
    if (bad.length) throw new Error('unguarded: ' + bad.join(', '));
  });

  await check('revenue engine refuses to book without an on-chain tx hash', async () => {
    const tmp = path.join(os.tmpdir(), 'chronos-test-ledger-' + process.pid + '.wal');
    process.env.CHRONOS_LEDGER_PATH = tmp;
    const eng = require('./revenue_engine_247.js');
    let err = null;
    try { await eng.ingestVerifiedTransaction({ revenueUSD: 1, streamId: 'TEST' }); } catch (e) { err = e; }
    if (!err) throw new Error('booked revenue without evidence');
    if (!/txHash/.test(err.message)) throw new Error('unexpected error: ' + err.message);
    if (fs.existsSync(tmp) && fs.statSync(tmp).size > 0) throw new Error('a ledger row was written');
    fs.rmSync(tmp, { force: true });
    delete process.env.CHRONOS_LEDGER_PATH;
  });

  await check('live ledger hash chain is intact', () => {
    const c = status.verifyChain(status.ledgerPath());
    if (c.issues.length) throw new Error(c.issues.slice(0, 3).join('; '));
  });

  console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})();
