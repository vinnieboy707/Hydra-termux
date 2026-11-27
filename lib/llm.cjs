'use strict';
// The VP's AI brain: every AI key you set, used in turn, each one the fallback of the others.
//   OPENROUTER_API_KEY, OPENROUTER_API_KEY_2 … _5   (model: CHRONOS_AGENT_MODEL or the newest Claude Sonnet listed)
//   ANTHROPIC_API_KEY                               (model: CHRONOS_ANTHROPIC_MODEL, default claude-sonnet-5-5)
// Each call goes to the next key in the rotation; if that key fails, the same call moves to the next one at once.
// A key that answers 402 (out of credits) rests 6 h, 401/403 (revoked) rests 24 h, 429 (rate limit) rests Retry-After
// or 60 s, a 5xx or timeout 2 min. Keys are secrets: never logged; each is named by its setting (OPENROUTER_API_KEY_2).
// Read-only by design: the brain only returns text; what it proposes is checked and applied elsewhere.
const { redact } = require('./safety.cjs');

const OR_KEYS = ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEY_2', 'OPENROUTER_API_KEY_3', 'OPENROUTER_API_KEY_4', 'OPENROUTER_API_KEY_5'];
const ANTHROPIC_MODEL = 'claude-sonnet-5-5';

class Brain {
  /** get: .env reader · orModel: the OpenRouter model (lib/agentmodel.cjs) · fetchImpl, now: tests */
  /** spend: the daily spending cap (lib/spend.cjs); every call is checked against it at callUsd before it is made */
  constructor({ get, orModel = null, fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = 45000, spend = null, callUsd = 0.02 }) {
    this.spend = spend; this.callUsd = callUsd;
    this.fetch = fetchImpl; this.now = now; this.timeoutMs = timeoutMs; this.turn = 0;
    const seen = new Set();
    this.slots = [
      ...OR_KEYS.map((k) => ({ name: k, kind: 'openrouter', key: get(k), model: orModel })),
      { name: 'ANTHROPIC_API_KEY', kind: 'anthropic', key: get('ANTHROPIC_API_KEY'), model: String(get('CHRONOS_ANTHROPIC_MODEL') || ANTHROPIC_MODEL) },
    ].filter((s) => s.key && s.model && !seen.has(s.key) && seen.add(s.key)).map((s) => ({ ...s, restUntil: 0, calls: 0, fails: 0, why: null }));
  }
  get ready() { return this.slots.length > 0; }

  /** one completion → { text, via } ; tries every key (in turn) before giving up */
  async chat({ system, user, maxTokens = 800, json = true }) {
    if (!this.slots.length) throw new Error('no AI key set (OPENROUTER_API_KEY… or ANTHROPIC_API_KEY)');
    if (this.spend) { const a = this.spend.allow('ai', this.callUsd); if (!a.ok) throw new Error(a.why); }
    const n = this.slots.length; const start = this.turn++ % n; const errs = [];
    for (let i = 0; i < n; i++) {
      const s = this.slots[(start + i) % n];
      if (s.restUntil > this.now()) { errs.push(`${s.name} resting (${s.why})`); continue; }
      try {
        const text = await this._call(s, { system, user, maxTokens, json });
        s.calls++; s.fails = 0; s.why = null; if (this.spend) this.spend.record('ai', this.callUsd);
        return { text, via: `${s.name} (${s.model})` };
      } catch (e) {
        s.fails++; const st = e.status || 0;
        const rest = st === 402 ? 6 * 3600000 : st === 401 || st === 403 ? 24 * 3600000 : st === 429 ? (e.retryAfterS ? e.retryAfterS * 1000 : 60000) : 120000;
        s.restUntil = this.now() + rest; s.why = st === 402 ? 'out of credits' : st === 401 || st === 403 ? 'key refused' : st === 429 ? 'rate limited' : redact(String(e.message)).slice(0, 40);
        errs.push(`${s.name}: ${s.why}`);
      }
    }
    throw new Error('every AI key failed: ' + errs.join('; '));
  }

  async _call(s, { system, user, maxTokens, json }) {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      let r;
      if (s.kind === 'anthropic') {
        r = await this.fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ac.signal,
          headers: { 'x-api-key': s.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: s.model, max_tokens: maxTokens, temperature: 0, system, messages: [{ role: 'user', content: user }] }) });
      } else {
        r = await this.fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', signal: ac.signal,
          headers: { authorization: `Bearer ${s.key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: s.model, temperature: 0, max_tokens: maxTokens, ...(json ? { response_format: { type: 'json_object' } } : {}), messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
      }
      if (!r.ok) { const e = new Error(`${s.kind} HTTP ${r.status}`); e.status = r.status; const ra = r.headers && r.headers.get && Number(r.headers.get('retry-after')); if (ra > 0) e.retryAfterS = ra; throw e; }
      const j = await r.json();
      const text = s.kind === 'anthropic' ? ((j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')) : String(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '');
      if (!text) throw new Error('empty answer');
      return text;
    } finally { clearTimeout(timer); }
  }

  /** what chronos nodes / the System tab show: key names and state, never the keys */
  status() { const t = this.now(); return this.slots.map((s) => ({ key: s.name, model: s.model, calls: s.calls, resting: s.restUntil > t ? Math.round((s.restUntil - t) / 1000) : 0, why: s.why })); }
}

/** the JSON object inside a model's answer, or null */
function jsonOf(text) { const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (_) { return null; } }

module.exports = { Brain, jsonOf, OR_KEYS, ANTHROPIC_MODEL };
