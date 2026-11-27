'use strict';
// Execution policy: every limit the live executor and the automatic shadow ↔ live switch obey. Values come from
// your .env; anything missing uses the default below; anything outside its bounds is refused (the default is used
// and the problem is reported). The engine and its agents can only PROPOSE a change; it is written to .env only after
// you approve it in the portal, and only if it is inside these bounds.
const POLICY = [
  { key: 'CHRONOS_MODE', def: 'auto', oneOf: ['auto', 'shadow'], what: 'auto: switch to live by the rules below; shadow: never send' },
  { key: 'EXEC_TIP_SHARE_BPS', def: 5000, min: 0, max: 9000, int: true, what: 'share of the surplus above your floor bid as priority fee (Arbitrum orders each 125 ms round by priority fee)' },
  { key: 'EXEC_MAX_GAS_UNITS', def: 1500000, min: 200000, max: 5000000, int: true, what: 'gas limit cap per transaction' },
  { key: 'MAX_DAILY_GAS_USD', def: 5, min: 0.1, max: 1000, what: 'gas you may lose to reverted transactions per UTC day; every send is sized so even a revert stays inside it, and reaching it switches back to shadow' },
  { key: 'MAX_CONSECUTIVE_REVERTS', def: 3, min: 1, max: 20, int: true, what: 'reverted transactions in a row that switch back to shadow' },
  { key: 'EXEC_MIN_GAS_ETH', def: 0.002, min: 0.0001, max: 1, what: 'executor ETH below this switches back to shadow (it cannot pay gas)' },
  { key: 'EXEC_ROUTE_COOLDOWN_SEC', def: 30, min: 0, max: 3600, int: true, what: 'wait before sending the same route again' },
  { key: 'PROMOTE_MIN_WINS', def: 5, min: 1, max: 1000, int: true, what: 'shadow wins in the last 24 h needed before live' },
  { key: 'PROMOTE_MIN_WIN_RATE_BPS', def: 6000, min: 1000, max: 10000, int: true, what: 'share of shadow runs that must win before live' },
  { key: 'GUARD_MIN_SENDS', def: 5, min: 1, max: 100, int: true, what: 'profit guard: after this many live sends in a UTC day, a realized net ≤ $0 switches back to shadow until the next day' },
  { key: 'EXEC_SHADOW_TOPK', def: 3, min: 1, max: 20, int: true, what: 'best approved routes simulated each scan' },
];

function readExecPolicy(get) {
  const p = {}; const problems = [];
  for (const s of POLICY) {
    const raw = get(s.key);
    if (raw === undefined || raw === null || String(raw).trim() === '') { p[s.key] = s.def; continue; }
    const v = String(raw).trim();
    if (s.oneOf) { if (s.oneOf.includes(v)) p[s.key] = v; else { p[s.key] = s.def; problems.push(`${s.key}=${v} is not one of ${s.oneOf.join('/')}; using ${s.def}`); } continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < s.min || n > s.max || (s.int && !Number.isInteger(n))) { p[s.key] = s.def; problems.push(`${s.key}=${v} outside ${s.min}–${s.max}; using ${s.def}`); continue; }
    p[s.key] = n;
  }
  return { policy: p, problems };
}
module.exports = { POLICY, readExecPolicy };
