'use strict';
// The daily spending cap you approved: one ledger for every cost that a profit does not pay back, per UTC day.
//   gas-loss   gas of a trade that reverted on-chain (a successful trade's gas is paid from its own profit)
//   ai         AI analyst calls (OpenRouter), at the estimate CHRONOS_AI_CALL_USD (default $0.02) per call
//   other      anything else that charges per use
// Before any of these is spent, allow(kind, worstCaseUsd) answers yes only if today's total plus that worst case stays
// within CHRONOS_DAILY_SPEND_CAP_USD (default $5). At the cap that kind of spending stops for the rest of the UTC day
// and you are told once; trades whose worst case fits keep running, so the cap never stops a trade it can cover.
// Profit never raises the cap: only you do, by changing the setting. Stored in data/spend.json (mode 600).
const fs = require('fs');
const path = require('path');

const DEFAULT_CAP_USD = 5, DEFAULT_AI_CALL_USD = 0.02;
const KINDS = ['gas-loss', 'ai', 'other'];
const utcDay = (t) => new Date(t).toISOString().slice(0, 10);
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };

class Spend {
  /** dataDir · cap: CHRONOS_DAILY_SPEND_CAP_USD · tell(title, text): your alert · now: tests */
  constructor({ dataDir, cap = DEFAULT_CAP_USD, tell = () => {}, now = () => Date.now() }) {
    this.file = path.join(dataDir, 'spend.json'); this.cap = num(cap, DEFAULT_CAP_USD); this.tell = tell; this.now = now;
    try { this.st = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (_) { this.st = null; }
    this._roll();
  }
  _roll() { const d = utcDay(this.now()); if (!this.st || this.st.day !== d) this.st = { day: d, byKind: Object.fromEntries(KINDS.map((k) => [k, 0])), total: 0, refused: 0, told: false }; }
  _save() { try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.st), { mode: 0o600 }); fs.renameSync(this.file + '.tmp', this.file); } catch (_) { /* the ledger also lives in memory */ } }
  /** USD still allowed today */
  room() { this._roll(); return Math.max(0, this.cap - this.st.total); }
  /** may something whose worst case costs `usd` happen now? → { ok, why } */
  allow(kind, usd) {
    this._roll(); const w = num(usd, Infinity);
    if (!KINDS.includes(kind)) return { ok: false, why: `unknown spending kind ${kind}` };
    if (this.st.total + w <= this.cap + 1e-12) return { ok: true, why: null };
    this.st.refused++;
    if (!this.st.told) { this.st.told = true; this.tell('Daily spending cap reached', `$${this.st.total.toFixed(2)} of $${this.cap.toFixed(2)} spent today (UTC) on costs no profit paid back. ${kind} spending that could go over it is stopped until 00:00 UTC; trades that fit keep running. Change the cap: chronos set CHRONOS_DAILY_SPEND_CAP_USD <dollars>`); }
    this._save();
    return { ok: false, why: `CHRONOS_DAILY_SPEND_CAP_USD: $${this.st.total.toFixed(4)} spent today + $${w.toFixed(4)} worst case > $${this.cap} cap` };
  }
  /** something was spent */
  record(kind, usd) {
    this._roll(); const v = num(usd, 0); if (!KINDS.includes(kind) || !v) return;
    this.st.byKind[kind] = (this.st.byKind[kind] || 0) + v; this.st.total += v; this._save();
  }
  today() { this._roll(); return { day: this.st.day, cap: this.cap, total: +this.st.total.toFixed(6), room: +this.room().toFixed(6), byKind: { ...this.st.byKind }, refused: this.st.refused }; }
}

module.exports = { Spend, KINDS, DEFAULT_CAP_USD, DEFAULT_AI_CALL_USD };
