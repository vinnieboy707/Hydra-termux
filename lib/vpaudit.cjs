'use strict';
// The VP's audit after every task it completes (a setting applied or verified, a delegation done, a milestone gained or
// lost): a complete re-check from real sources, then a reassessment of the next step to real profit.
//   1. your own checks against Arbitrum One (chronos verify-real, every check but the two test pings);
//   2. Blockscout, the independent witness (lib/blockscout.cjs): chain head vs your node, your contract on chain,
//      every wallet's ETH balance vs your node, what the executor really sent, and every profit the engine
//      recorded confirmed as a successful receipt from the executor to your contract;
//   3. the road to cash re-evaluated (lib/milestones.cjs) and the top blocker of the last scan → the next step.
// A failing check is never hidden: the result says fail, the phone is told, and the next step names it.
// Read-only: nothing here signs or sends.
const ADDR = /^0x[0-9a-fA-F]{40}$/;
const PASS = 'pass', FAIL = 'fail', SKIP = 'not run', WARN = 'warn';

/**
 * d: { get(key), provider (your node), bs (Blockscout | null), owner (owner address | null), realized ({ executions }),
 *      verifyReal: async () → { results: [{ id, status }] } | null, road: [{ step, title, done, owner, todo }],
 *      trading: { topBlocker, bestNetUsd, brokenPools }, after: [what was done], now }
 * → { at, after, checks: [{ id, status, detail }], pass, fail, next: { step, title, owner, todo } | null, line }
 */
async function audit(d) {
  const checks = []; const add = (id, status, detail) => checks.push({ id, status, detail });
  const get = d.get; const bs = d.bs; const p = d.provider;
  const contract = ADDR.test(get('CHRONOS_FLASH_ARB_ADDRESS') || '') ? get('CHRONOS_FLASH_ARB_ADDRESS').toLowerCase() : null;
  const executor = ADDR.test(get('CHRONOS_EXECUTOR_ADDRESS') || '') ? get('CHRONOS_EXECUTOR_ADDRESS').toLowerCase() : null;

  // 1. your real checks
  if (d.verifyReal) {
    try {
      const r = await d.verifyReal(); const rs = (r && r.results) || [];
      const f = rs.filter((x) => x.status === 'fail').map((x) => x.id);
      add('real-checks', f.length ? FAIL : PASS, `${rs.filter((x) => x.status === 'pass').length} pass, ${f.length} fail${f.length ? ' (' + f.join(', ') + ')' : ''}, ${rs.filter((x) => x.status === 'not run').length} not run`);
    } catch (e) { add('real-checks', FAIL, 'could not run: ' + String(e.message).slice(0, 80)); }
  }

  // 2. Blockscout, independently
  if (!bs) add('blockscout', SKIP, 'CHRONOS_BLOCKSCOUT_URL is off: nothing confirms the engine from outside');
  else {
    let head = null;
    try {
      head = await bs.head(); const mine = p ? await p.getBlockNumber() : null;
      const lag = mine === null ? null : head - mine; // Arbitrum: ~4 blocks a second; 40 = about 10 s
      add('chain-head', mine === null ? SKIP : Math.abs(lag) <= 40 ? PASS : WARN, mine === null ? `Blockscout at block ${head}; node not connected` : `Blockscout ${head} · your node ${mine}${Math.abs(lag) > 40 ? ` · your node is ${Math.abs(lag)} blocks ${lag > 0 ? 'behind' : 'ahead of the index'}` : ''}`);
    } catch (e) { add('chain-head', WARN, 'Blockscout unreachable: ' + String(e.message).slice(0, 60)); }

    if (contract) {
      try {
        const c = await bs.address(contract);
        if (!c || !c.isContract) add('contract-on-chain', FAIL, `${contract} is not a contract on Arbitrum One according to Blockscout`);
        else {
          const ownerOk = !d.owner || !c.creator || c.creator === d.owner.toLowerCase();
          add('contract-on-chain', c.creationOk === false || !ownerOk ? FAIL : PASS, `contract ${c.creationOk === false ? 'creation failed' : 'created'}${c.creator ? ` by ${c.creator.slice(0, 10)}…${ownerOk ? ' (your owner wallet)' : ' — NOT your owner wallet'}` : ''}${c.isVerified ? ' · source verified' : ' · source not verified on Blockscout'}`);
        }
      } catch (e) { add('contract-on-chain', WARN, 'Blockscout: ' + String(e.message).slice(0, 60)); }
    } else add('contract-on-chain', SKIP, 'no contract yet (CHRONOS_FLASH_ARB_ADDRESS)');

    // every wallet: ETH balance per Blockscout vs your node (a gap means a node or an index is wrong)
    const wallets = [['owner', d.owner], ['executor', executor], ['payout', get('PAYOUT_WALLET_ADDRESS')], ['tax reserve', get('TAX_RESERVE_VAULT')], ['gas wallet', get('GAS_WALLET_ADDRESS')]]
      .filter(([, a]) => ADDR.test(a || '')).filter(([, a], i, xs) => xs.findIndex(([, b]) => b.toLowerCase() === a.toLowerCase()) === i);
    const off = [], seen = [];
    for (const [label, a] of wallets) {
      try {
        const b = await bs.address(a); const mine = p ? await p.getBalance(a) : null;
        const theirs = b ? b.balanceWei ?? 0n : 0n;
        if (mine === null) { seen.push(`${label} ${eth(theirs)}`); continue; }
        // Blockscout updates a balance when the address is touched: a gap with a stale index is shown, not failed
        const fresh = !b || b.balanceBlock === null || head === null || head - b.balanceBlock < 400;
        if (mine !== theirs && fresh) off.push(`${label}: node ${eth(mine)} vs Blockscout ${eth(theirs)}`); else seen.push(`${label} ${eth(mine)}`);
      } catch (e) { off.push(`${label}: ${String(e.message).slice(0, 40)}`); }
    }
    if (wallets.length) add('wallets', off.length ? WARN : PASS, off.length ? off.join('; ') : `${seen.join(' · ')} (node and Blockscout agree)`);

    // what the executor really sent: every send must go to your contract; reverts cost gas
    if (executor) {
      try {
        const txs = await bs.sentBy(executor);
        const foreign = txs.filter((t) => contract && t.to && t.to !== contract && t.to !== executor);
        const rev = txs.filter((t) => !t.ok);
        const fee = txs.reduce((s, t) => s + (t.feeWei || 0n), 0n);
        add('executor-sends', foreign.length ? FAIL : rev.length ? WARN : PASS, txs.length
          ? `${txs.length} recent send(s), ${rev.length} reverted, ${eth(fee)} gas${foreign.length ? ` · ${foreign.length} to an address that is NOT your contract (${foreign.slice(0, 2).map((t) => t.hash.slice(0, 12) + '… → ' + t.to.slice(0, 10) + '…').join(', ')}): stop and check the executor key` : ''}`
          : 'no sends yet');
      } catch (e) { add('executor-sends', WARN, 'Blockscout: ' + String(e.message).slice(0, 60)); }
    } else add('executor-sends', SKIP, 'no executor yet');

    // every profit the engine recorded must be a successful receipt from your executor to your contract
    const exs = ((d.realized && d.realized.executions) || []).filter((e) => /^0x[0-9a-fA-F]{64}$/.test(e.txHash || '')).slice(-20);
    if (exs.length) {
      const bad = [];
      for (const e of exs) {
        try {
          const t = await bs.tx(e.txHash);
          if (!t) bad.push(`${e.txHash.slice(0, 12)}… unknown to Blockscout`);
          else if (!t.ok) bad.push(`${e.txHash.slice(0, 12)}… ${t.result || 'failed'}`);
          else if ((contract && t.to !== contract) || (executor && t.from !== executor)) bad.push(`${e.txHash.slice(0, 12)}… not executor → your contract`);
        } catch (err) { bad.push(`${e.txHash.slice(0, 12)}… ${String(err.message).slice(0, 30)}`); }
      }
      add('profits-confirmed', bad.length ? FAIL : PASS, bad.length ? `${bad.length} of ${exs.length} recorded trade(s) not confirmed: ${bad.slice(0, 3).join('; ')}` : `${exs.length} recorded trade(s), each a successful receipt from your executor to your contract`);
    } else add('profits-confirmed', SKIP, 'no trades recorded yet');
  }

  // 3. reassess: the road to cash and the next step
  const road = d.road || []; const next = road.find((m) => !m.done) || null;
  const T = d.trading || {};
  const fails = checks.filter((c) => c.status === FAIL);
  const nextStep = fails.length
    ? { step: 0, title: 'Fix what the audit found', owner: fails.some((c) => ['contract-on-chain', 'executor-sends'].includes(c.id)) ? 'you' : 'chronos', todo: fails.map((c) => `${c.id}: ${c.detail}`).join(' | ') }
    : next ? { step: next.step, title: next.title, owner: next.owner, todo: next.todo + (next.id === 'closest-route' && T.brokenPools ? ` · ${T.brokenPools} broken pool(s) left out of routing` : '') } : null;
  const pass = checks.filter((c) => c.status === PASS).length;
  const line = `Audit after ${(d.after || []).slice(0, 3).join(', ') || 'the last task'}: ${pass} pass, ${fails.length} fail, ${checks.filter((c) => c.status === WARN).length} warn · road ${road.filter((m) => m.done).length}/${road.length}${nextStep ? ` · NEXT ${nextStep.step ? 'step ' + nextStep.step + ' ' : ''}(${nextStep.owner === 'you' ? 'yours' : 'Chronos'}): ${nextStep.title} — ${nextStep.todo}` : ' · every milestone met'}`;
  return { at: new Date(d.now || Date.now()).toISOString(), after: d.after || [], checks, pass, fail: fails.length, next: nextStep, line };
}

const eth = (w) => `${(Number(w) / 1e18).toFixed(5)} ETH`;

module.exports = { audit, PASS, FAIL, SKIP, WARN };
