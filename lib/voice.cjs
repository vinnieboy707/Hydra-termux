'use strict';
// The voice for chronos narrate (2.9.17): the text-to-speech already on your device, free and offline-capable.
//   · phone (Termux): termux-tts-speak (needs the Termux:API app and `pkg install termux-api`); your Android voice
//     engine decides the voice (Google's natural voices by default). CHRONOS_VOICE_ENGINE picks another engine
//     (chronos narrate --voices lists them), CHRONOS_VOICE_LANG / CHRONOS_VOICE_REGION / CHRONOS_VOICE_VARIANT pick
//     the voice, CHRONOS_VOICE_RATE and CHRONOS_VOICE_PITCH (1.0 = normal) tune it.
//   · Mac: say (CHRONOS_VOICE = a voice name from `say -v ?`) · Linux: spd-say, else espeak-ng.
// Claude's own voice-mode voices are not available to apps outside the Claude app, so they cannot be used here.
const { spawn, spawnSync } = require('child_process');

const has = (bin) => { try { return spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }).status === 0; } catch (_) { return false; } };
const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

/** the command that speaks one line on this device → { bin, args(text), name } or null */
function backend(get = () => undefined, which = has) {
  const rate = num(get('CHRONOS_VOICE_RATE'), 0.25, 4), pitch = num(get('CHRONOS_VOICE_PITCH'), 0.25, 4);
  if (which('termux-tts-speak')) {
    const base = [];
    for (const [k, f] of [['CHRONOS_VOICE_ENGINE', '-e'], ['CHRONOS_VOICE_LANG', '-l'], ['CHRONOS_VOICE_REGION', '-n'], ['CHRONOS_VOICE_VARIANT', '-v']]) { const v = String(get(k) || '').trim(); if (v && /^[\w.@-]{1,80}$/.test(v)) base.push(f, v); }
    if (rate) base.push('-r', String(rate)); if (pitch) base.push('-p', String(pitch));
    return { bin: 'termux-tts-speak', args: (t) => [...base, t], name: 'Android text-to-speech (termux-tts-speak)' };
  }
  if (process.platform === 'darwin' && which('say')) {
    const v = String(get('CHRONOS_VOICE') || '').trim(); const base = v && /^[\w .()-]{1,60}$/.test(v) ? ['-v', v] : [];
    if (rate) base.push('-r', String(Math.round(175 * rate)));
    return { bin: 'say', args: (t) => [...base, t], name: 'macOS say' };
  }
  if (which('spd-say')) return { bin: 'spd-say', args: (t) => ['-w', ...(rate ? ['-r', String(Math.round((rate - 1) * 50))] : []), t], name: 'speech-dispatcher' };
  if (which('espeak-ng')) return { bin: 'espeak-ng', args: (t) => [...(rate ? ['-s', String(Math.round(175 * rate))] : []), t], name: 'eSpeak NG' };
  return null;
}

/** speak one line → { done: Promise<'done'|'stopped'|'failed'>, stop() } (text only goes to the local speech engine) */
function speak(b, text, run = spawn) {
  let child; let stopped = false;
  const done = new Promise((resolve) => {
    try { child = run(b.bin, b.args(String(text).slice(0, 3900)), { stdio: 'ignore' }); } catch (_) { return resolve('failed'); }
    child.on('error', () => resolve('failed'));
    child.on('exit', (code) => resolve(stopped ? 'stopped' : code === 0 ? 'done' : 'failed'));
  });
  return { done, stop: () => { stopped = true; try { child && child.kill('SIGTERM'); } catch (_) { /* gone */ } } };
}

/** the voice engines on an Android phone (termux-tts-engines), or null elsewhere */
function engines(which = has) {
  if (!which('termux-tts-engines')) return null;
  try { return JSON.parse(spawnSync('termux-tts-engines', [], { encoding: 'utf8', timeout: 15000 }).stdout || '[]'); } catch (_) { return null; }
}

module.exports = { backend, speak, engines };
