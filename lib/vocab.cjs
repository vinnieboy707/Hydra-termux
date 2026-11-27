'use strict';
// The words your database accepts (its CHECK constraints). The engine only sends these: agents.event() maps a severity
// alias ('warn' → 'warning', 'error' → 'critical') and turns any outcome not listed into 'none' (keeping the original
// in detail). test/sync.test.cjs fails if code uses a word not listed here; portal/real_check.sql checks the real
// database accepts every word listed here.
const SEVERITIES = ['info', 'warning', 'critical'];
const SEVERITY_ALIAS = { warn: 'warning', error: 'critical', fatal: 'critical' };
const OUTCOMES = ['detected', 'fixed', 'escalated', 'failed', 'none', 'applied', 'done', 'kept', 'pending', 'resolved', 'reverted', 'started', 'vetoed'];
const MODES = ['SHADOW', 'LIVE'];
const SHADOW_STAGES = ['preflight', 'simulation', 'done'];
const EXECUTION_STATUSES = ['pending', 'success', 'reverted', 'dropped'];
const APPROVAL_KINDS = ['key', 'limit', 'contract', 'funds', 'code', 'other'];
const REPORT_KINDS = ['daily-report', 'alert', 'build-request'];
const PAYOUT_KINDS = ['withdraw', 'tax', 'payout'];

function eventRow(row) {
  const severity = SEVERITIES.includes(row.severity) ? row.severity : SEVERITY_ALIAS[row.severity] || 'info';
  const outcome = OUTCOMES.includes(row.outcome) ? row.outcome : 'none';
  const detail = outcome === row.outcome ? row.detail : { ...(row.detail && typeof row.detail === 'object' ? row.detail : { detail: row.detail ?? null }), outcome: row.outcome };
  return { ...row, severity, outcome, detail };
}

module.exports = { SEVERITIES, SEVERITY_ALIAS, OUTCOMES, MODES, SHADOW_STAGES, EXECUTION_STATUSES, APPROVAL_KINDS, REPORT_KINDS, PAYOUT_KINDS, eventRow };
