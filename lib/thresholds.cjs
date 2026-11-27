'use strict';
const { parseEnvFile } = require('./config.cjs');
/** GO thresholds and scan interval from .env (interval: TUI_REFRESH_SEC, else MEASURE_INTERVAL_SEC, else 20 s). */
function readThresholds(envFile) {
  const env = envFile ? parseEnvFile(envFile) : {};
  const n = (k) => { const v = process.env[k] !== undefined ? process.env[k] : env[k]; const x = Number(v); return v !== undefined && v !== '' && Number.isFinite(x) ? x : undefined; };
  return { GO_MIN_EPISODES: n('GO_MIN_EPISODES'), GO_MIN_DISTINCT_BLOCKS: n('GO_MIN_DISTINCT_BLOCKS'), GO_MIN_USD_PER_DAY: n('GO_MIN_USD_PER_DAY'), interval: n('TUI_REFRESH_SEC') || n('MEASURE_INTERVAL_SEC') || 20, taxBps: n('POLICY_T1_TAX_BPS') };
}
module.exports = { readThresholds };
