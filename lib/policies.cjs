'use strict';
// Your policy baseline (POLICIES_AND_PROCEDURES_FLASHLOAN_ARB.md, POLICY_P0.md) as live checks.
// Each policy says: the rule, which .env variable drives it, its value, and whether it holds right now.
const fs = require('fs');
const { parseEnvFile, REQUIRED_NUMBERS, REQUIRED_LISTS } = require('./config.cjs');

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const shortAddr = (a) => (ADDR.test(a || '') ? a.slice(0, 6) + '…' + a.slice(-4) : null);

function evaluatePolicies({ envFile, cfg, record, lastRes, integrity, realized: rz }) {
  const env = envFile ? parseEnvFile(envFile) : {};
  const val = (k) => (process.env[k] !== undefined ? process.env[k] : env[k]);
  const P = [];
  const add = (id, name, rule, vars, status, detail) => P.push({ id, name, rule, vars, status, detail });

  add('P0', 'Zero mock data', 'every figure comes from the chain; a failed quote is dropped, never guessed',
    ['POLICY_P0_NO_MOCK'], 'ENFORCED', 'built into the scanner and covered by tests');
  add('G1', 'Fail-closed', 'missing or invalid settings stop the system',
    ['POLICY_G1_FAIL_CLOSED'], cfg.problems.length ? 'BLOCKING' : 'ENFORCED',
    cfg.problems.length ? `${cfg.problems.length} setting(s) missing` : 'all required settings present');

  const t1 = Number(val('POLICY_T1_TAX_BPS'));
  const realized = rz ? (rz.executions || []).length : 0;
  add('T1', 'Tax reserve', '30% of verified gross profit goes to the tax reserve',
    ['POLICY_T1_TAX_BPS', 'TAX_RESERVE_VAULT'],
    !Number.isFinite(t1) ? 'MISSING' : t1 !== 3000 ? 'CHECK' : !ADDR.test(val('TAX_RESERVE_VAULT') || '') ? 'CHECK' : 'READY',
    `${Number.isFinite(t1) ? (t1 / 100).toFixed(2) + '%' : 'not set'} → vault ${shortAddr(val('TAX_RESERVE_VAULT')) || 'not set'} · verified executions: ${realized}` + (rz && rz.taxReserveUsd ? ` · reserve owed $${rz.taxReserveUsd.toFixed(2)}` : ', nothing owed yet'));

  let s0 = 'MISSING', s0d = 'no .env file found';
  if (envFile) {
    try {
      const mode = fs.statSync(envFile).mode & 0o777;
      s0 = (mode & 0o077) === 0 ? 'PASS' : 'FAIL';
      s0d = `.env permissions ${mode.toString(8).padStart(3, '0')}` + (s0 === 'FAIL' ? ` · fix: chmod 600 ${envFile}` : '');
    } catch (e) { s0 = 'FAIL'; s0d = 'cannot stat .env'; }
  }
  if (integrity) add('INT', 'Code integrity', 'console code matches its seal; edits, missing or extra files block start-up', [],
    integrity.ok ? 'PASS' : 'FAIL', integrity.ok ? `${integrity.count} files${integrity.depsSealed ? ` + ${integrity.depsCount} libraries` : ''} match the seal from ${String(integrity.sealedAt).slice(0, 10)}` : !integrity.sealed ? 'not sealed yet · run: chronos seal' : `changed: ${[...integrity.changed, ...integrity.missing, ...integrity.added].slice(0, 4).join(', ')}${integrity.deps ? ' · ' + integrity.deps : ''}`);
  add('S0', 'Secrets shield', '.env readable by its owner only (0600); secrets are never displayed', [], s0, s0d);

  const gas = lastRes ? lastRes.gasGwei : null;
  add('GAS', 'Gas gate', 'no trade above the gas ceiling (STANDBY_GAS_WAIT)', ['GAS_CEILING_GWEI'],
    cfg.GAS_CEILING_GWEI === null ? 'MISSING' : gas === null ? 'ENFORCED' : gas > cfg.GAS_CEILING_GWEI ? 'STANDBY' : 'ENFORCED',
    cfg.GAS_CEILING_GWEI === null ? 'not set' : gas === null ? `ceiling ${cfg.GAS_CEILING_GWEI} gwei` : `now ${gas.toFixed(4)} gwei vs ceiling ${cfg.GAS_CEILING_GWEI}`);
  add('PROFIT', 'Profit floor', 'net after flash premium and gas must clear the floor', ['MIN_NET_PROFIT_USD'],
    cfg.MIN_NET_PROFIT_USD === null ? 'MISSING' : 'ENFORCED', cfg.MIN_NET_PROFIT_USD === null ? 'not set' : `$${cfg.MIN_NET_PROFIT_USD} minimum, or ${cfg.FLOOR_GAS_MULT ?? 2}× the route's gas if larger`);
  add('SLIP', 'Price-impact cap', 'each leg must stay under the impact cap', ['MAX_SLIPPAGE_BPS'],
    cfg.MAX_SLIPPAGE_BPS === null ? 'MISSING' : 'ENFORCED', cfg.MAX_SLIPPAGE_BPS === null ? 'not set' : `${cfg.MAX_SLIPPAGE_BPS} bps per leg`);
  const dd = Number(val('MAX_DAILY_DRAWDOWN_USD'));
  add('DD', 'Daily drawdown cap', 'stop trading after this much loss in a day', ['MAX_DAILY_DRAWDOWN_USD'],
    Number.isFinite(dd) ? 'SET' : 'MISSING', Number.isFinite(dd) ? `$${dd} · a realized loss this large switches live trading back to shadow for the day` : 'not set');
  const mode = val('CHRONOS_MODE') || 'auto';
  add('LIVE', 'Execution switch', 'CHRONOS_MODE=shadow never sends; auto sends only after the promotion rules are met, and every send is re-simulated against your floor first', ['CHRONOS_MODE'],
    mode === 'shadow' ? 'READ-ONLY' : 'ENFORCED', mode === 'shadow' ? 'CHRONOS_MODE=shadow · the engine sends nothing' : 'CHRONOS_MODE=auto · live only when every promotion rule is met');
  return P;
}

const PARAM_HELP = { ...REQUIRED_NUMBERS, ...REQUIRED_LISTS,
  MEASURE_INTERVAL_SEC: 'seconds between scans', GO_MIN_EPISODES: 'GO needs at least this many opportunity episodes',
  GO_MIN_DISTINCT_BLOCKS: 'GO needs opportunities in this many different blocks', GO_MIN_USD_PER_DAY: 'GO needs this projected $/day (upper bound)',
  HURDLE_BPS: 'your hurdle rate (shown for reference)', MIN_TRADE_USD: 'smallest trade (reference)', FLASH_LOAN_BORROW_USD: 'legacy borrow size (reference)' };

function listParameters({ envFile, cfg }) {
  const env = envFile ? parseEnvFile(envFile) : {};
  return Object.entries(PARAM_HELP).map(([k, help]) => {
    const v = process.env[k] !== undefined ? process.env[k] : env[k];
    const required = k in REQUIRED_NUMBERS || k in REQUIRED_LISTS;
    return { key: k, value: v === undefined ? null : String(v), help, required, ok: v !== undefined && v !== '' };
  });
}
module.exports = { evaluatePolicies, listParameters, shortAddr };
