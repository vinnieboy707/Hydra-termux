'use strict';
// Loads .env (read-only, never printed) and validates every number the scanner uses.
// Fail-closed: a missing or non-numeric required variable stops the run. No hidden defaults for money/risk.
const fs = require('fs');
const path = require('path');

/** VALUE, "VALUE", 'VALUE', and VALUE # comment all read as VALUE (same as dotenv). */
function parseValue(raw) {
  const v = raw.trim();
  const q = v[0];
  if ((q === '"' || q === "'") && v.indexOf(q, 1) > 0) return v.slice(1, v.indexOf(q, 1));
  const hash = v.search(/\s#/);
  return (hash >= 0 ? v.slice(0, hash) : v).trim();
}

function parseEnvFile(file) {
  const out = {};
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch (_) { return out; }
  for (const l of txt.split('\n')) {
    const m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = parseValue(m[2]);
  }
  return out;
}

const RPC_KEYS = ['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL'];

const REQUIRED_NUMBERS = {
  MIN_NET_PROFIT_USD: 'net profit floor per trade (USD)',
  MAX_SLIPPAGE_BPS: 'max price impact per leg (bps)',
  GAS_CEILING_GWEI: 'gas gate: no trade above this gas price',
  GAS_UNITS_ASSUMED: 'gas units for flash loan + 2 swaps (calibrate with calibrate_gas.cjs)',
  SCREEN_SIZE_USD: 'trade size used to screen all routes cheaply (USD)',
  SCAN_TOPK: 'how many screened routes get the full size optimisation',
  OPT_REFINE_ITERS: 'refinement steps after the size ladder',
  MIN_PROFIT_CAPTURE_BPS: 'contract minProfit as share of expected profit (bps)',
  SLIPPAGE_PROBE_USD: 'small probe size used to measure price impact (USD)',
  DEADLINE_SECONDS: 'deadline put in generated run params (seconds)',
};
const REQUIRED_LISTS = { SIZE_LADDER_USD: 'comma list of borrow sizes to try (USD)' };

function num(v) { const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) ? n : null; }

function loadConfig(envPath, overrides = {}) {
  const file = parseEnvFile(envPath || path.join(process.cwd(), '.env'));
  const get = (k) => (overrides[k] !== undefined ? overrides[k] : process.env[k] !== undefined ? process.env[k] : file[k]);
  const problems = [];
  const cfg = { raw: {} };

  const rpcKey = RPC_KEYS.find((k) => get(k));
  if (!rpcKey) problems.push('no RPC url: set one of ' + RPC_KEYS.join(', '));
  cfg.rpcUrl = rpcKey ? get(rpcKey) : null;
  cfg.rpcEnvKey = rpcKey || null;
  cfg.rpcBatchMax = cfg.rpcUrl ? require('./providers.cjs').batchMax(cfg.rpcUrl, get) : null;
  cfg.envGet = get; // the daemon re-reads provider plans when it switches node

  for (const [k, why] of Object.entries(REQUIRED_NUMBERS)) {
    const n = num(get(k));
    if (n === null) problems.push(`${k} missing or not a number (${why})`);
    cfg[k] = n;
  }
  for (const [k, why] of Object.entries(REQUIRED_LISTS)) {
    const raw = get(k);
    const arr = String(raw || '').split(',').map((s) => num(s.trim())).filter((x) => x !== null && x > 0);
    if (!arr.length) problems.push(`${k} missing or empty (${why})`);
    cfg[k] = arr;
  }
  cfg.SCAN_EXTRA_TOKENS = String(get('SCAN_EXTRA_TOKENS') || '').split(',').map((s) => s.trim()).filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s));
  cfg.CONCURRENCY = num(get('SCAN_CONCURRENCY')) || 6;
  { const m = num(get('FLOOR_GAS_MULT')); cfg.FLOOR_GAS_MULT = m === null ? 2 : Math.max(0, Math.min(20, m)); } // floor = max(MIN_NET_PROFIT_USD, this × route gas)
  // optional scanner knobs (defaults when absent; out-of-range values fall back to the default)
  const opt = (k, d, lo, hi) => { const n = num(get(k)); return n !== null && n >= lo && n <= hi ? n : d; };
  cfg.SCAN_MAX_LEGS = opt('SCAN_MAX_LEGS', 4, 2, 5); // 5 only takes effect when your deployed contract accepts 5 legs
  cfg.SCAN_QUOTE_CYCLES = opt('SCAN_QUOTE_CYCLES', 400, 10, 5000);
  cfg.DISCOVER_TOKENS = opt('CHRONOS_DISCOVER_TOKENS', 40, 0, 200);
  cfg.HOT_SCAN_MS = opt('HOT_SCAN_MS', 3000, 0, 60000);
  cfg.DEPTH_MIN_FILL = opt('DEPTH_MIN_FILL', 0.5, 0.05, 0.99); // a pool whose tiny probe gets less than this share of its own price is benched
  cfg.DEPTH_BENCH_HOURS = opt('DEPTH_BENCH_HOURS', 6, 0.25, 72);
  cfg.DEPTH_MIN_USD = get('DEPTH_MIN_USD') !== undefined && get('DEPTH_MIN_USD') !== '' ? opt('DEPTH_MIN_USD', 1000, 0, 10000000) : undefined; // per side, V2 pairs; unset: max($1,000, 5× smallest size)
  cfg.DEAD_LOSS_PCT = opt('DEAD_LOSS_PCT', 5, 1, 50); // a route losing more than this % of its size at screening is a dead pool, not a gap
  if (cfg.MIN_PROFIT_CAPTURE_BPS !== null && (cfg.MIN_PROFIT_CAPTURE_BPS < 0 || cfg.MIN_PROFIT_CAPTURE_BPS > 10000)) problems.push('MIN_PROFIT_CAPTURE_BPS must be 0..10000');
  cfg.problems = problems;
  return cfg;
}

module.exports = { loadConfig, parseEnvFile, parseValue, RPC_KEYS, REQUIRED_NUMBERS, REQUIRED_LISTS };
