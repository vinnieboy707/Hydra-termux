'use strict';
// AI diagnosis of a new engine problem through OpenRouter. Read-only by design: it returns an explanation and a
// suggested fix as text, which is recorded in agent activity. Nothing it says is executed.
// Off unless OPENROUTER_API_KEY is set; the model is CHRONOS_AGENT_MODEL or the newest Claude Sonnet OpenRouter lists
// (lib/agentmodel.cjs).
const { redact } = require('./safety.cjs');

const SYSTEM = 'You diagnose errors in Chronos, a Node.js flash-loan arbitrage engine on Arbitrum One (Aave V3 flash loans, Uniswap V3/V2 quotes, Multicall3, a ChronosFlashArb contract, Google Cloud KMS signer, PM2/systemd). '
  + 'Given one problem and recent log lines, answer ONLY with JSON: {"cause": string (one sentence), "fix": string (concrete steps the owner can take; never ask for keys or secrets), "confidence": "low"|"medium"|"high"}. '
  + 'If the log does not support a conclusion, say so in cause and use low confidence. Do not invent numbers.';

function createDiagnoser({ apiKey, model, logTail = () => [], fetchImpl = globalThis.fetch, endpoint = 'https://openrouter.ai/api/v1/chat/completions', chat = null }) {
  // the VP's brain (lib/llm.cjs): every AI key in turn, each the fallback of the others
  if (chat) {
    return async function diagnose(problem) {
      const user = `Problem id: ${problem.id}\nMessage: ${redact(problem.msg)}\nRecent log (redacted):\n${logTail().slice(-40).map(redact).join('\n')}`;
      const r = await chat({ system: SYSTEM, user, maxTokens: 400 });
      const d = require('./llm.cjs').jsonOf(r.text);
      if (!d || typeof d.cause !== 'string' || typeof d.fix !== 'string') throw new Error('answer missing cause or fix');
      return { cause: redact(d.cause).slice(0, 400), fix: redact(d.fix).slice(0, 600), confidence: ['low', 'medium', 'high'].includes(d.confidence) ? d.confidence : 'low', model: r.via };
    };
  }
  if (!apiKey || !model) return null;
  if (!/^[\w.\-]+\/[\w.\-:]+$/.test(model)) return null;
  return async function diagnose(problem) {
    const user = `Problem id: ${problem.id}\nMessage: ${redact(problem.msg)}\nRecent log (redacted):\n${logTail().slice(-40).map(redact).join('\n')}`;
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 30000);
    try {
      const r = await fetchImpl(endpoint, { method: 'POST', signal: ac.signal, headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }) });
      if (!r.ok) throw new Error(`OpenRouter HTTP ${r.status}`);
      const j = await r.json();
      const text = String(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '');
      const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('no JSON in the answer');
      const d = JSON.parse(m[0]);
      if (typeof d.cause !== 'string' || typeof d.fix !== 'string') throw new Error('answer missing cause or fix');
      return { cause: redact(d.cause).slice(0, 400), fix: redact(d.fix).slice(0, 600), confidence: ['low', 'medium', 'high'].includes(d.confidence) ? d.confidence : 'low', model };
    } finally { clearTimeout(timer); }
  };
}
const ACT_SYSTEM = 'You are the incident agent of Chronos, a flash-loan arbitrage engine on Arbitrum One. A problem is open; the researched '
  + 'resolutions were tried and verified as not working. Choose ONE next action from the allowed list, or none. Prefer actions whose '
  + 'description addresses the evidence. Never invent an action. Answer ONLY with JSON: {"action": string|null, "reason": string}.';

/** picks the next allowlisted action for an open incident; the caller checks the pick is allowed and untried */
function createActionAgent({ apiKey, model, fetchImpl = globalThis.fetch, endpoint = 'https://openrouter.ai/api/v1/chat/completions', chat = null }) {
  if (chat) {
    return async function pick({ problem, symptom, detail, tried, allowed }) {
      const user = JSON.stringify({ problem, symptom, detail: redact(String(detail || '')), tried: tried.map((t) => ({ ...t, evidence: redact(String(t.evidence || '')) })), allowed });
      const d = require('./llm.cjs').jsonOf((await chat({ system: ACT_SYSTEM, user, maxTokens: 200 })).text);
      return d && typeof d.action === 'string' ? { action: d.action, reason: String(d.reason || '').slice(0, 200) } : null;
    };
  }
  if (!apiKey || !model || !/^[\w.\-]+\/[\w.\-:]+$/.test(model)) return null;
  return async function pick({ problem, symptom, detail, tried, allowed }) {
    const user = JSON.stringify({ problem, symptom, detail: redact(String(detail || '')), tried: tried.map((t) => ({ ...t, evidence: redact(String(t.evidence || '')) })), allowed });
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 30000);
    try {
      const r = await fetchImpl(endpoint, { method: 'POST', signal: ac.signal, headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 200, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: ACT_SYSTEM }, { role: 'user', content: user }] }) });
      if (!r.ok) throw new Error(`OpenRouter HTTP ${r.status}`);
      const j = await r.json();
      const m = String(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').match(/\{[\s\S]*\}/);
      const d = m ? JSON.parse(m[0]) : null;
      return d && typeof d.action === 'string' ? { action: d.action, reason: String(d.reason || '').slice(0, 200) } : null;
    } finally { clearTimeout(timer); }
  };
}

module.exports = { createDiagnoser, createActionAgent, SYSTEM, ACT_SYSTEM };
