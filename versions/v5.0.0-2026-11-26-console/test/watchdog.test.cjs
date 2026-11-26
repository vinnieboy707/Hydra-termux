'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { stallSec, Watchdog } = require('../lib/watchdog.cjs');

const LIB = JSON.stringify(path.join(__dirname, '..', 'lib', 'watchdog.cjs'));
// a child that runs the real watchdog with a short limit (the 60 s floor is bypassed through stallMs for the test)
const child = (dir, body) => spawn(process.execPath, ['-e', `
const { Watchdog } = require(${LIB});
const w = new Watchdog({ dataDir: ${JSON.stringify(dir)}, everyMs: 100 }); w.stallMs = 600; w.start();
${body}`], { stdio: 'ignore' });
const exitOf = (p, ms) => new Promise((res) => { const t = setTimeout(() => { p.kill('SIGKILL'); res('timeout'); }, ms); p.on('exit', (code, sig) => { clearTimeout(t); res(sig || code); }); });

test('the stall limit is at least 60 s, 300 s by default', () => {
  assert.strictEqual(stallSec(undefined), 300); assert.strictEqual(stallSec('abc'), 300);
  assert.strictEqual(stallSec(5), 60); assert.strictEqual(stallSec(900), 900);
});

test('a main thread that blocks completely is ended, and the stall is recorded for the restart to report', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
  const r = await exitOf(child(dir, 'w.beat(true); const t = Date.now(); while (Date.now() - t < 20000) {}'), 15000);
  assert.strictEqual(r, 'SIGKILL', 'the watchdog thread ended the blocked process');
  const rec = Watchdog.lastStall(dir);
  assert.ok(rec && rec.stalledForSec >= 0 && /while a scan was running/.test(rec.what));
});

test('an awaited promise that never settles is caught too', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
  const r = await exitOf(child(dir, 'setInterval(() => {}, 1000); (async () => { await new Promise(() => {}); })();'), 15000);
  assert.strictEqual(r, 'SIGKILL'); assert.ok(/between scans/.test(Watchdog.lastStall(dir).what));
});

test('a loop that keeps beating is never touched; a known-long step inside its grace is left alone', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-'));
  const beating = await exitOf(child(dir, 'const i = setInterval(() => w.beat(false), 100); setTimeout(() => { clearInterval(i); w.stop(); }, 2500);'), 15000);
  assert.strictEqual(beating, 0, 'exited normally after 2.5 s of beats');
  const graced = await exitOf(child(dir, 'w.grace(10); setTimeout(() => w.stop(), 2500); setInterval(() => {}, 1000).unref(); setTimeout(() => {}, 2600);'), 15000);
  assert.strictEqual(graced, 0, 'a 2.5 s rediscovery inside a 10 s grace was not killed');
  assert.strictEqual(Watchdog.lastStall(dir), null, 'no stall recorded');
});
