'use strict';
// The hang watchdog. The engine's main loop calls beat() on every pass. A separate thread (worker_threads) watches
// the beat through shared memory, so it still sees the problem when the main thread is completely blocked (a loop
// that never yields, a promise that never settles). When no beat arrives for CHRONOS_WATCHDOG_STALL_SEC (default
// 300 s), it writes data/live/watchdog.json (what stalled, for how long, when) and ends the process; the service
// manager (PM2 on phones, systemd on the laptop) starts it again within 30 s. A paused engine still beats: pausing is
// never a stall. The watchdog never moves money and never changes a setting.
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

const DEFAULT_STALL_SEC = 300, MIN_STALL_SEC = 60;

/** the stall limit from the setting (seconds), clamped: at least 60 s so a slow scan on a phone is never killed */
function stallSec(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.max(MIN_STALL_SEC, Math.floor(n)) : DEFAULT_STALL_SEC; }

// runs in the worker: polls the shared beat; on a stall writes the record and kills the whole process
const WORKER = `
const { workerData } = require('worker_threads'); const fs = require('fs'); const path = require('path');
const beat = new Float64Array(workerData.sab); const { stallMs, file, pid, everyMs } = workerData;
setInterval(() => {
  const last = beat[0]; if (!last) return;
  if (Date.now() < beat[2]) return; // inside a known-long step's allowance (grace)
  const idle = Date.now() - Math.max(last, beat[2]);
  if (idle < stallMs) return;
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), stalledForSec: Math.round(idle / 1000), limitSec: stallMs / 1000, what: beat[1] ? 'the main loop stopped while a scan was running' : 'the main loop stopped between scans', action: 'process ended; the service manager restarts it' }, null, 2)); } catch (_) {}
  process.kill(pid, 'SIGKILL');
}, everyMs);
`;

class Watchdog {
  /** dataDir: the engine's data folder · stallSec: the limit · everyMs, kill: tests only */
  constructor({ dataDir, stall = DEFAULT_STALL_SEC, everyMs = 5000 }) {
    this.file = path.join(dataDir, 'live', 'watchdog.json'); this.stallMs = stallSec(stall) * 1000; this.everyMs = everyMs;
    this.sab = new SharedArrayBuffer(24); this.beatArr = new Float64Array(this.sab); this.worker = null;
  }
  start() {
    this.beat(false);
    this.worker = new Worker(WORKER, { eval: true, workerData: { sab: this.sab, stallMs: this.stallMs, file: this.file, pid: process.pid, everyMs: this.everyMs } });
    this.worker.unref(); // never keeps the process alive on its own
    this.worker.on('error', () => { this.worker = null; }); // a watchdog that cannot run is reported by status(), never crashes the engine
    return this;
  }
  /** the main loop is alive; scanning = whether a scan is running right now */
  beat(scanning = false) { this.beatArr[0] = Date.now(); this.beatArr[1] = scanning ? 1 : 0; this.beatArr[2] = 0; }
  /** a known-long step (rediscovering every pool) may take up to `sec` more before the stall limit starts counting */
  grace(sec) { this.beatArr[2] = Date.now() + Math.max(0, Number(sec) || 0) * 1000; }
  stop() { if (this.worker) { this.worker.terminate(); this.worker = null; } }
  status() { return { on: !!this.worker, stallSec: this.stallMs / 1000, lastBeatAgoSec: this.beatArr[0] ? Math.round((Date.now() - this.beatArr[0]) / 1000) : null }; }
  /** the last stall the watchdog recorded (read at start-up, so the restart can tell you why it happened), or null */
  static lastStall(dataDir) { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'live', 'watchdog.json'), 'utf8')); } catch (_) { return null; } }
}

module.exports = { Watchdog, stallSec, DEFAULT_STALL_SEC, MIN_STALL_SEC };
