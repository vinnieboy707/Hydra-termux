'use strict';
// "Running smoothly" means profiting. This is the path from where you are to verified on-chain profit.
// The dashboard stays red, naming the first unmet stage, until stage 7 is met by a confirmed transaction.
const STAGES = [
  { n: 1, name: 'Settings and keys complete', next: 'press e: setup imports your keys and fills settings' },
  { n: 2, name: 'Live scanner running on Arbitrum One', next: 'fix the node or scan errors shown on the System tab' },
  { n: 3, name: 'Routes net-positive after flash fee and gas', next: 'keep scanning; if none appear, the market is too competitive at this speed (see Measure → Edge)' },
  { n: 4, name: 'GO verdict from a measurement run', next: 'let measurement reach your GO thresholds (Measure tab, or chronos measure)' },
  { n: 5, name: 'Shadow test passing (your contract simulated, nothing sent)', next: 'the engine simulates every approved route; it needs an executor address that is an operator on your contract' },
  { n: 6, name: 'Live execution on (switches automatically)', next: 'KMS executor set up (cloud/gcp-setup.sh) and the switch conditions met (Measure tab)' },
  { n: 7, name: 'Verified on-chain profit', next: 'a confirmed transaction in which your contract emitted Arbitrage with profit above the gas it cost' },
];

function evaluate(S) {
  const sm = S.session ? S.session.summary(S.thresholds) : { episodes: 0, verdict: 'WAITING' };
  const fresh = S.lastScanAt && Date.now() - S.lastScanAt < Math.max(60000, (S.interval || 20) * 3000, S.res && S.res.tookMs ? S.res.tookMs * 3 : 0);
  const rz = S.realized || null;
  const met = {
    1: !!S.cfg && S.cfg.problems.length === 0,
    2: !!fresh && !S.error,
    3: sm.episodes > 0,
    4: sm.verdict === 'GO TO SHADOW TEST',
    5: !!(S.mode && !S.mode.starting && Array.isArray(S.mode.promote) && S.mode.promote.filter((c) => /^shadow/.test(c.name)).length > 0 && S.mode.promote.filter((c) => /^shadow/.test(c.name)).every((c) => c.met)),
    6: !!(S.mode && S.mode.mode === 'LIVE'),
    7: !!(rz && rz.profiting && rz.totalNetUsd > 0),
  };
  const stages = STAGES.map((s) => ({ ...s, met: met[s.n] }));
  // Verified profit is the goal itself: once receipts prove it, nothing is "blocking" any more. Earlier checklist
  // items that were never met stay unticked (they are not claimed), but they no longer block the verdict.
  const current = met[7] ? null : stages.find((s) => !s.met) || null;
  if (current && current.n === 7 && (!rz || !rz.contract)) current.next = 'deploy your contract (chronos mainnet; it saves CHRONOS_FLASH_ARB_ADDRESS) so profit can be verified from receipts';
  return { stages, current, profiting: met[7] };
}
module.exports = { evaluate, STAGES };
