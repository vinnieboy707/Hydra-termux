'use strict';
// chronos narrate (2.9.17): reads the engine's live commentary aloud, as it happens.
//   space or p  pause / resume (the line that was cut off is read again from its start)
//   n           next line          r  repeat the last line          q  quit (your place is kept)
// It always starts at the first line you have not heard. If you were away for more than 20 lines, routine scan
// reports are summed up in one sentence and everything else (alerts, money, mode changes, executor) is read in full.
const N = require('../lib/narrate.cjs');
const V = require('../lib/voice.cjs');

async function run({ dataDir, get = () => undefined, out = (s) => process.stdout.write(s + '\n'), stdin = process.stdin, backend = V.backend(get), speakImpl = V.speak, pollMs = 1500, once = false }) {
  if (!backend) out('No speech engine on this device: lines are shown only. On your phone: install the Termux:API app, then pkg install termux-api');
  else out(`Voice: ${backend.name}. space = pause/resume · n = next · r = repeat · q = quit (your place is kept)`);
  let cursor = N.readCursor(dataDir);
  let paused = false, quit = false, current = null, lastSaid = null, skip = false, replay = null;
  let wake = null; const nudge = () => { if (wake) { const w = wake; wake = null; w(); } };
  if (stdin && stdin.isTTY && stdin.setRawMode) {
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    stdin.on('data', (k) => {
      if (k === 'q' || k === '\u0003') { quit = true; if (current) current.stop(); nudge(); }
      else if (k === ' ' || k === 'p') { paused = !paused; out(paused ? '⏸  paused (space to resume)' : '▶  resumed'); if (paused && current) current.stop(); nudge(); }
      else if (k === 'n') { skip = true; if (current) current.stop(); nudge(); }
      else if (k === 'r' && lastSaid) { replay = lastSaid; nudge(); }
    });
  }
  const say = async (text) => {
    out('🔊 ' + text);
    if (!backend) return 'done';
    current = speakImpl(backend, text); const r = await current.done; current = null; return r;
  };
  try {
    // came back after a while: one sentence for the routine scan reports, the rest in full
    const backlog = N.readAll(dataDir).filter((l) => l.n > cursor);
    if (backlog.length > 20) {
      const c = N.catchUp(backlog);
      await say(c.summary);
      const skipTo = backlog[backlog.length - 1].n;
      for (const l of c.keep) { while (paused && !quit) await new Promise((r) => { wake = r; }); if (quit) break; const r = await say(l.text); if (r !== 'stopped') lastSaid = l.text; }
      if (!quit) { cursor = skipTo; N.writeCursor(dataDir, cursor); }
    }
    while (!quit) {
      if (paused) { await new Promise((r) => { wake = r; }); continue; }
      if (replay) { const t = replay; replay = null; await say(t); continue; }
      const next = N.readAll(dataDir).find((l) => l.n > cursor);
      if (!next) { if (once) break; await new Promise((r) => { wake = r; setTimeout(r, pollMs); }); continue; }
      const r = await say(next.text);
      // a line cut off by pause or quit is read again next time; one finished, skipped or failed moves your place on
      if (r === 'stopped' && (quit || (paused && !skip))) continue;
      skip = false; lastSaid = next.text; cursor = next.n; N.writeCursor(dataDir, cursor);
    }
  } finally {
    if (stdin && stdin.isTTY && stdin.setRawMode) { stdin.setRawMode(false); stdin.pause(); }
  }
  out(`Stopped at line ${cursor}. chronos narrate picks up from here.`);
  return 0;
}

module.exports = { run };
