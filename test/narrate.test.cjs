'use strict';
// chronos narrate (2.9.17): the engine's live commentary and the narrator that reads it aloud. Speech is played by
// fakeSpeech (it records each line and finishes when told); its real counterpart is your device's text-to-speech
// (termux-tts-speak on the phone), checked by chronos verify-real (narrate-voice).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { EventEmitter } = require('events');
const N = require('../lib/narrate.cjs');
const V = require('../lib/voice.cjs');
const NR = require('../tui/narrate.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nar-'));
const scanS = (o = {}) => ({ mode: { mode: 'SHADOW' }, lastScanAt: o.at || 1, acting: 'primary', execInfo: { ready: false, why: 'executor key is locked' },
  res: { blockNumber: 527825082, tookMs: 4100, marketsFound: 416, marketsUsable: 380, approved: o.approved || 0, indicators: { cycles: { checked: 1240, pricesAllow: 12 }, deadRoutes: 3, topBlocker: o.blocker || 'profit floor' }, candidates: [{ borrowSymbol: 'USDC', otherSymbol: 'WETH', amountUsd: 200, netUsd: o.net ?? -0.24, reasons: [] }] }, ...o.S });

test('the commentary: plain words for each change, routine scans at most once a minute, numbering kept across restarts', () => {
  const dir = tmp(); let t = 1e12; const c = new N.Commentary(dir, { now: () => t, scanEverySec: 60 });
  c.observe(scanS({ at: 1 }), { version: '2.9.17', floorUsd: 0.35 });
  let all = N.readAll(dir);
  assert.match(all[0].text, /version 2\.9\.17 is running as your primary engine, in shadow mode: it rehearses every trade and sends nothing/);
  assert.match(all[1].text, /Scan at block 527,825,082, 4 seconds: 380 pools, 1,240 routes checked, 12 with a price gap\. Closest: USDC through WETH on 200\.00 dollars, which would net minus 24 cents, 59 cents short of your 35 cents floor\. 3 routes through dead pools set aside\./);
  t += 5000; c.observe(scanS({ at: 2 }), { floorUsd: 0.35 }); assert.strictEqual(N.readAll(dir).length, 2, 'a routine scan 5 s later is not repeated');
  t += 5000; c.observe(scanS({ at: 3, net: -0.1 }), { floorUsd: 0.35 }); assert.strictEqual(N.readAll(dir).length, 3, 'a better route (+14 cents) is said at once');
  t += 5000; c.observe(scanS({ at: 4, net: -0.1, S: { mode: { mode: 'LIVE' }, execInfo: { ready: true }, paused: true, error: 'node https://x.io/KEY timed out' } }), { floorUsd: 0.35 });
  all = N.readAll(dir).map((l) => l.text).join(' | ');
  assert.match(all, /Switched to live mode/); assert.match(all, /Scanning is paused/); assert.match(all, /Your executor is ready/); assert.match(all, /A problem: node a link timed out/, 'no url (or key) is ever spoken');
  const c2 = new N.Commentary(dir, { now: () => t }); const n = c2.say('again'); assert.strictEqual(n, N.readAll(dir).length, 'numbering continues after a restart');
});

function fakeSpeech() {
  const said = []; let finish = null;
  const speak = (_b, text) => { said.push(text); let stopped = false; const done = new Promise((r) => { finish = () => r(stopped ? 'stopped' : 'done'); }); return { done, stop: () => { stopped = true; finish(); } }; };
  return { said, speak, finish: () => finish && finish() };
}
function fakeKeys() { const e = new EventEmitter(); e.isTTY = true; e.setRawMode = () => {}; e.resume = () => {}; e.pause = () => {}; e.setEncoding = () => {}; e.press = (k) => e.emit('data', k); return e; }
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

test('the narrator: reads what you have not heard, pause cuts off and re-reads that line, quit keeps your place', async () => {
  const dir = tmp(); const c = new N.Commentary(dir); for (const x of ['one', 'two', 'three']) c.say(x);
  const sp = fakeSpeech(); const keys = fakeKeys(); const out = [];
  const p = NR.run({ dataDir: dir, backend: { name: 'test' }, speakImpl: sp.speak, stdin: keys, out: (s) => out.push(s), pollMs: 30 });
  await tick(); assert.deepStrictEqual(sp.said, ['one']); sp.finish(); await tick();
  assert.deepStrictEqual(sp.said, ['one', 'two']); keys.press(' '); await tick(); // paused in the middle of "two"
  assert.strictEqual(N.readCursor(dir), 1, 'your place: after "one"'); keys.press(' '); await tick();
  assert.deepStrictEqual(sp.said, ['one', 'two', 'two'], 'resume re-reads the line that was cut off');
  sp.finish(); await tick(); keys.press('q'); await p;
  assert.strictEqual(N.readCursor(dir), 2, 'quit keeps your place after "two"');
  const sp2 = fakeSpeech(); const k2 = fakeKeys();
  const p2 = NR.run({ dataDir: dir, backend: { name: 'test' }, speakImpl: sp2.speak, stdin: k2, out: () => {}, pollMs: 30 });
  await tick(); assert.deepStrictEqual(sp2.said, ['three'], 'the next start picks up where you left off'); sp2.finish(); await tick(); k2.press('q'); await p2;
});

test('back after a long time: routine scans summed up in one sentence, alerts and money read in full', async () => {
  const dir = tmp(); const c = new N.Commentary(dir);
  for (let i = 0; i < 30; i++) c.say(`Scan at block ${i}.`, 'scan');
  c.say('Switched to live mode.', 'notice'); c.say('A trade settled on chain.', 'money');
  const sp = fakeSpeech(); const keys = fakeKeys();
  const p = NR.run({ dataDir: dir, backend: { name: 'test' }, speakImpl: sp.speak, stdin: keys, out: () => {}, pollMs: 30 });
  for (let i = 0; i < 4; i++) { await tick(); sp.finish(); }
  await tick(); keys.press('q'); await p;
  assert.match(sp.said[0], /While you were away: 32 updates, 30 of them routine scan reports\. 2 worth hearing in full follow\. The latest scan: Scan at block 29\./);
  assert.deepStrictEqual(sp.said.slice(1, 3), ['Switched to live mode.', 'A trade settled on chain.']);
  assert.strictEqual(N.readCursor(dir), 32);
});

test('the voice: your phone speech engine with your settings; Mac say; none found = lines shown only', () => {
  const get = (k) => ({ CHRONOS_VOICE_ENGINE: 'com.google.android.tts', CHRONOS_VOICE_LANG: 'en', CHRONOS_VOICE_REGION: 'US', CHRONOS_VOICE_RATE: '1.1', CHRONOS_VOICE_VARIANT: 'bad;rm -rf' })[k];
  const t = V.backend(get, (b) => b === 'termux-tts-speak');
  assert.deepStrictEqual(t.args('hi'), ['-e', 'com.google.android.tts', '-l', 'en', '-n', 'US', '-r', '1.1', 'hi'], 'an unsafe value is never passed on');
  assert.strictEqual(V.backend(() => undefined, () => false), null);
  const spawned = []; const fake = (bin, args) => { spawned.push([bin, args]); const e = new EventEmitter(); setImmediate(() => e.emit('exit', 0)); e.kill = () => {}; return e; };
  return V.speak(t, 'Scan at block 1.', fake).done.then((r) => { assert.strictEqual(r, 'done'); assert.deepStrictEqual(spawned[0][0], 'termux-tts-speak'); });
});
