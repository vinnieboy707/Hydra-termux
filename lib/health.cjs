'use strict';
// "Fail loudly until running smoothly": every problem the console can see, in one list.
// The dashboard shows a red banner while this list is non-empty, rings the terminal bell for each new problem,
// and appends it (redacted) to data/errors.log.
const fs = require('fs');
const path = require('path');
const { redact } = require('./safety.cjs');

function problems(S) {
  const p = [];
  if (S.followProblem) p.push({ id: 'engine', msg: S.followProblem, tab: 5 });
  if (S.stateTampered) p.push({ id: 'state-signature', msg: 'background engine state file failed its signature check (ignored)', tab: 5 });
  if (S.integrity && !S.integrity.ok) p.push({ id: 'integrity', msg: 'code differs from its seal', tab: 5 });
  if (S.integrity && S.integrity.foreign && S.integrity.foreign.length) p.push({ id: 'foreign-files', msg: `${S.integrity.foreign.length} file(s) in the Chronos folder are not part of this release: ${S.integrity.foreign.slice(0, 3).join(', ')} (chronos doctor)`, tab: 5 });
  if (S.error) p.push({ id: 'scan', msg: `last scan failed: ${S.error}`, tab: 5 });
  if (S.consecutiveErrors >= 3) p.push({ id: 'scan-streak', msg: `${S.consecutiveErrors} scans in a row failed`, tab: 5 });
  if (S.nodes) for (const n of S.nodes.filter((x) => !x.ok)) p.push({ id: 'node:' + n.key, msg: `node ${n.key}: ${n.detail}`, tab: 5 });
  if (S.nodes && S.nodes.length && !S.nodes.some((n) => n.ok)) p.push({ id: 'nodes-all', msg: 'no RPC node is answering as Arbitrum One', tab: 5 });
  if (S.lastQuotes && S.lastQuotes.n >= 10 && S.lastQuotes.fail / S.lastQuotes.n > 0.2) p.push({ id: 'quotes', msg: `${Math.round((100 * S.lastQuotes.fail) / S.lastQuotes.n)}% of quotes failed in the last scan`, tab: 5 });
  if (S.st && !S.st.venueReport.some((v) => v.ok && v.executable)) p.push({ id: 'venues', msg: 'no executable venue passed its on-chain check', tab: 5 });
  if (S.st && !S.st.assets.some((a) => a.flashEnabled)) p.push({ id: 'aave', msg: 'Aave reports no flash-loanable asset', tab: 5 });
  if (S.policyFails) for (const f of S.policyFails) p.push({ id: 'policy:' + f.id, msg: `policy ${f.id} ${f.status}: ${f.detail}`, tab: 4 });
  if (S.historyRejected) p.push({ id: 'history', msg: `${S.historyRejected} history line(s) were not written by this console (ignored)`, tab: 5 });
  if (S.phase === 'running' && !S.paused && S.lastScanAt && Date.now() - S.lastScanAt > Math.max(60000, S.interval * 3000) && !S.scanning) p.push({ id: 'stale', msg: `no completed scan for ${Math.round((Date.now() - S.lastScanAt) / 1000)} s`, tab: 1 });
  if (S.phase === 'running') {
    const pr = require('./profit.cjs').evaluate(S);
    if (!pr.profiting && pr.current) p.push({ id: 'profit-stage:' + pr.current.n, msg: `NOT PROFITING · stage ${pr.current.n} of 7: ${pr.current.name} not met · next: ${pr.current.next}`, tab: 1, profit: true });
  }
  return p.map((x) => ({ ...x, msg: redact(x.msg) }));
}

function logNew(dir, list, seen) {
  const fresh = list.filter((x) => !seen.has(x.id));
  const now = new Set(list.map((x) => x.id));
  const resolved = [...seen].filter((id) => !now.has(id));
  if (fresh.length || resolved.length) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const f = path.join(dir, 'errors.log');
      try { if (fs.statSync(f).size > 1024 * 1024) fs.renameSync(f, f + '.1'); } catch (_) { /* new */ }
      const t = new Date().toISOString();
      fs.appendFileSync(f, [...fresh.map((x) => `${t} PROBLEM ${x.id} ${x.msg}`), ...resolved.map((id) => `${t} RESOLVED ${id}`)].join('\n') + '\n', { mode: 0o600 });
    } catch (_) { /* logging must never crash the console */ }
  }
  return { fresh, resolved, seen: now };
}
module.exports = { problems, logNew };
