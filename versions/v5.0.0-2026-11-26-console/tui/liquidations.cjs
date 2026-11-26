'use strict';
// chronos liquidations [days] [--arbitrum|--base]: the read-only measurement in lib/liquidations.cjs, printed in
// words and saved to data/research/liquidations-<date>.json. Nothing is sent; no money moves.
const fs = require('fs');
const path = require('path');
const L = require('../lib/liquidations.cjs');

const $ = (v) => (Number.isFinite(v) ? (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : 'unknown');

async function main({ args = [], get, dataDir, out = (s) => console.log(s) }) {
  const days = Math.min(90, Math.max(1, Number(args.find((a) => /^\d+$/.test(a))) || 14));
  const chains = args.includes('--arbitrum') ? ['arbitrum'] : args.includes('--base') ? ['base'] : ['arbitrum', 'base'];
  out(`◆ chronos liquidations · Aave V3 · last ${days} days · ${chains.join(' + ')} · read-only (Etherscan API V2; nothing is sent)`);
  const r = await L.run({ key: get('ETHERSCAN_API_KEY'), days, chains, log: (s) => out('  · ' + s) });
  for (const c of r.chains) {
    if (c.error) { out(`\n${c.chain}: could not be measured: ${c.error}`); continue; }
    const s = c.summary;
    out(`\n${c.chain}: ${s.events} liquidations (${s.perDay} a day) · ${s.winners} distinct liquidators · top 3 took ${s.top3SharePct ?? '?'}%`);
    out(`  debt repaid ${$(s.repaidUsd)} · liquidators' gross bonus ${$(s.grossUsd)} · median bonus ${Number.isFinite(s.medianBonusPct) ? s.medianBonusPct.toFixed(2) + '%' : 'unknown'}`);
    out(`  median per liquidation: gross ${$(s.medianGrossUsd)} · kept after gas ${$(s.medianKeptUsd)}`);
    out(`  through the SVR auction: ${s.viaAuctionPct ?? 'unknown'}% (their kept is before the winning bid, which is not visible yet) · outside it: median kept ${$(s.medianKeptDirectUsd)}`);
  }
  out('\nBuild gates (research, 2026-11-26):');
  for (const g of r.verdict.gates) out(`  ${g.pass ? '✓' : '✗'} ${g.gate}: ${Number.isFinite(g.value) ? (g.gate.includes('$') ? $(g.value) : g.value) : 'unknown'}${g.note ? ` (${g.note})` : ''}`);
  out(r.verdict.build ? '\n→ Every gate passes: worth building the liquidation solver. That needs your YES for the 0.1 ETH auction bond and the contract.' : '\n→ Not every gate passes: not worth building yet. Run it again in a volatile week (liquidations cluster when prices fall fast).');
  out('Prices are Aave\'s oracle prices now (exact for the bonus, approximate for USD totals).');
  const dir = path.join(dataDir, 'research'); fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `liquidations-${r.at.slice(0, 10)}.json`);
  fs.writeFileSync(f, JSON.stringify(r, null, 1), { mode: 0o600 });
  out(`Saved: ${f}`);
  return r.verdict.build ? 0 : 3;
}
module.exports = { main };
