'use strict';
// `chronos research [hours]`: the flash-loan arbitrage that actually landed on Arbitrum One recently, read through your
// own node. Saved to data/research.json. Read-only: sends nothing, needs no key.
const fs = require('fs');
const path = require('path');
const live = require('../lib/live.cjs');
const C = require('../lib/chain.cjs');
const R = require('../lib/research.cjs');
const { loadConfig } = require('../lib/config.cjs');
const { Batcher, multicallAvailable } = require('../lib/batch.cjs');

const say = (s = '') => process.stdout.write(s + '\n');
const $ = (v) => (v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(v !== 0 && Math.abs(v) < 0.1 ? 4 : 2)}`);

async function runResearch({ hours = 2, log = say } = {}) {
  const envFile = live.findEnvFile();
  if (!envFile) { log('No .env found. Run: chronos setup'); return 2; }
  const cfg = loadConfig(envFile);
  if (!cfg.rpcUrl) { log('No RPC url in .env (ARB_RPC_URL). Run: chronos setup'); return 2; }
  const provider = await C.connect(cfg);
  const multicall = await multicallAvailable(provider);
  const aave = await C.readAave(provider, C.limiter(6), live.AAVE, new Batcher(provider, { blockTag: 'latest', multicall }));
  const weth = aave.assets.find((a) => a.address === live.WETH);
  if (!weth || !weth.price8) { log('No Aave oracle price for WETH: cannot value gas. Nothing to report.'); return 1; }
  const venues = JSON.parse(fs.readFileSync(live.VENUES_FILE, 'utf8')).venues;
  const bv = process.env.CHRONOS_BALANCER_VAULT === 'off' ? null : (process.env.CHRONOS_BALANCER_VAULT || live.BALANCER_VAULT);
  const r = await R.run({ logsChunk: require('../lib/providers.cjs').logsMaxBlocks(cfg.rpcUrl, cfg.envGet) || 2000, provider, aavePool: live.AAVE, balancerVault: bv && (await provider.getCode(bv)) !== '0x' ? bv : null, venues, assets: aave.assets, ethPrice8: weth.price8, hours, log: (m) => log('  · ' + m) });
  fs.mkdirSync(live.DATA, { recursive: true });
  fs.writeFileSync(path.join(live.DATA, 'research.json'), JSON.stringify(r, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2), { mode: 0o600 });
  provider.destroy();

  log(`\n◆ Flash-loan arbitrage on Arbitrum One · blocks ${r.from}–${r.to}`);
  log(`  flash loans: ${Object.entries(r.flashLoans).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}`);
  log(`  transactions read: ${r.transactions} · succeeded ${r.succeeded} · profitable after gas ${r.profitableAfterGas} (median ${$(r.medianProfitUsd)})`);
  log(`  legs per transaction: ${Object.entries(r.legs).map(([k, v]) => `${k} legs × ${v}`).join(' · ') || '—'} · median gas ${r.medianGas ?? '—'}`);
  log('\n  Venues those swaps used:');
  for (const v of r.venues.slice(0, 10)) log(`    ${String(v.swaps).padStart(5)}  ${v.venue}`);
  if (r.venuesYouLack.length) { log('\n  Factories you do not scan yet (where competitors trade):'); for (const v of r.venuesYouLack.slice(0, 8)) log(`    ${String(v.swaps).padStart(5)}  ${v.factory}`); }
  log('\n  Most active contracts:');
  for (const c of r.topContracts.slice(0, 8)) log(`    ${c.contract}  ${c.txs} tx · ${c.success} ok · ${c.medianLegs ?? '—'} legs · gas ${c.medianGas ?? '—'} (${$(c.medianGasUsd)}) · via ${c.sources.join(', ')} · kept ${$(c.keptUsd)}`);
  log('\n  "kept" = tokens that stayed with the sender or its contract, valued at the Aave oracle; tokens Aave does not price are left out.');
  log(`  Full report: ${path.join(live.DATA, 'research.json')}`);
  return 0;
}

module.exports = { runResearch };
