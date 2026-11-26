'use strict';
// Which OpenRouter model the AI agent uses. CHRONOS_AGENT_MODEL if you set one; otherwise the newest Claude Sonnet
// that OpenRouter lists right now (read from its public model list, never guessed), remembered for a day in
// data/live/agent-model.json. So only OPENROUTER_API_KEY is needed to turn the agent on.
const fs = require('fs');
const path = require('path');

const MODEL = /^[\w.\-]+\/[\w.\-:]+$/;
const DAY = 86400000;
const cacheFile = (dataDir) => path.join(dataDir, 'live', 'agent-model.json');

/** newest Claude Sonnet in an OpenRouter /models answer, else the newest Claude; null when there is none */
function pick(list) {
  const ok = (m) => m && typeof m.id === 'string' && MODEL.test(m.id) && !/:free$|:beta$/.test(m.id);
  const newest = (xs) => xs.sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))[0] || null;
  const all = (list || []).filter(ok);
  const m = newest(all.filter((x) => /^anthropic\/claude-sonnet/.test(x.id))) || newest(all.filter((x) => /^anthropic\/claude/.test(x.id)));
  return m ? m.id : null;
}

/** the model now, without the network: yours, else the one remembered (under a day old), else null */
function current(get, dataDir, now = Date.now()) {
  const mine = String(get('CHRONOS_AGENT_MODEL') || '').trim();
  if (mine) return { model: mine, chosen: false };
  try { const c = JSON.parse(fs.readFileSync(cacheFile(dataDir), 'utf8')); if (MODEL.test(c.model) && now - c.at < DAY) return { model: c.model, chosen: true }; } catch (_) { /* none yet */ }
  return null;
}

/** yours, else chosen from OpenRouter's live model list (and remembered); null when OpenRouter does not answer */
async function resolve(get, dataDir, { fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  const now = current(get, dataDir); if (now) return now;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetchImpl('https://openrouter.ai/api/v1/models', { signal: ac.signal });
    if (!r.ok) return null;
    const model = pick((await r.json()).data);
    if (!model) return null;
    try { fs.mkdirSync(path.dirname(cacheFile(dataDir)), { recursive: true }); fs.writeFileSync(cacheFile(dataDir), JSON.stringify({ model, at: Date.now() }), { mode: 0o600 }); } catch (_) { /* remembered next time instead */ }
    return { model, chosen: true };
  } catch (_) { return null; } finally { clearTimeout(t); }
}

module.exports = { pick, current, resolve, MODEL };
