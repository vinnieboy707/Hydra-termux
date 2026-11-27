'use strict';
// `chronos payout`: profit in your contract → T1 reserve + payout wallet. See lib/payout.cjs for the rules.
// One YES covers the whole run. The cost shown before it: each withdrawal's gas estimate from the node, and for each
// transfer a cap of the largest withdrawal estimate (a withdrawal already contains a token transfer, so a plain
// transfer needs less); a transfer whose own estimate is above its cap is not sent. A run that stops part-way is
// finished by the next `chronos payout` from data/payouts.jsonl.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const PO = require('../lib/payout.cjs');
const D = require('../lib/deploy.cjs');
const live = require('../lib/live.cjs');
const RZ = require('../lib/realized.cjs');
const { loadConfig, parseEnvFile } = require('../lib/config.cjs');
const { SIGNING_KEYS } = require('../lib/catalog.cjs');
const integrity = require('../lib/integrity.cjs');
const { readRecord } = require('../lib/record.cjs');

const say = (s = '') => process.stdout.write(s + '\n');
const eth = (wei) => `${Number(ethers.formatEther(wei)).toFixed(6)} ETH`;
const $ = (usd8) => `$${(Number(usd8) / 1e8).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ADDR = /^0x[0-9a-fA-F]{40}$/;

async function runPayout({ planOnly = false, ask = null, log = say, sync = null } = {}) {
  const P = ask || require('./prompt.cjs');
  if (!ask && !planOnly && !process.stdin.isTTY) { log('chronos payout asks for your YES before sending, so it needs a terminal: run it in Termux.'); return 2; }
  const envFile = live.findEnvFile();
  if (!envFile) { log('No .env found. Run: chronos setup'); return 2; }
  const get = (k) => (process.env[k] !== undefined ? process.env[k] : parseEnvFile(envFile)[k]);
  const v = integrity.verify();
  if (!v.ok) { log(`Code integrity check failed (${v.sealed ? 'code differs from its seal' : 'not sealed'}). Reinstall first.`); return 2; }
  const contract = RZ.contractFrom(get);
  if (!contract) { log('No contract yet: run chronos deploy first.'); return 2; }
  const vault = get('TAX_RESERVE_VAULT'); const payout = get('PAYOUT_WALLET_ADDRESS');
  if (!ADDR.test(vault || '')) { log('TAX_RESERVE_VAULT is not set: Policy T1 needs it. chronos set TAX_RESERVE_VAULT 0x…'); return 2; }
  if (!ADDR.test(payout || '')) { log('PAYOUT_WALLET_ADDRESS is not set: chronos set PAYOUT_WALLET_ADDRESS 0x…'); return 2; }
  const taxBps = Number(get('POLICY_T1_TAX_BPS') || 3000);
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10000) { log('POLICY_T1_TAX_BPS must be 0–10000.'); return 2; }
  const cfg = loadConfig(envFile);
  if (cfg.problems.length) { log(`${cfg.problems.length} setting(s) missing: run chronos setup first.`); return 2; }

  log(`◆ chronos payout · contract ${contract.address} · T1 ${taxBps / 100}% → ${vault} · rest → ${payout}`);
  const st = await live.init(cfg, () => {});
  const provider = st.provider;
  const weth = st.assets.find((a) => a.address === live.WETH);
  if (!weth || !weth.price8) { log('No ETH price from the Aave oracle: not paying out (gas could not be valued).'); return 2; }
  const tokens = st.usable.map((a) => ({ address: ethers.getAddress(a.address), symbol: a.symbol, decimals: a.decimals, price8: a.price8 }));
  const second = get('ARB_RPC_URL_2') || get('ARBITRUM_RPC_URL');
  const secondary = second && second !== get('ARB_RPC_URL') ? new ethers.JsonRpcProvider(second, 42161, { staticNetwork: ethers.Network.from(42161) }) : null;
  const bs = get('CHRONOS_BLOCKSCOUT_URL'); const bsUrl = bs === 'off' ? null : bs && /^https:\/\//.test(bs) ? bs : 'https://arbitrum.blockscout.com';

  // owner key: your encrypted keystore (passphrase), else .env, else typed hidden (lib/keystore.cjs, tui/owner.cjs)
  const ow = await require('./owner.cjs').ownerWallet({ P, get, provider, log, dataDir: require('../lib/live.cjs').DATA, signingKeys: ['DEPLOYER_PRIVATE_KEY', ...SIGNING_KEYS.filter((x) => x !== 'DEPLOYER_PRIVATE_KEY')], hint: 'only the contract owner can withdraw' });
  if (!ow) return 1;
  const wallet = ow.wallet; const from = ow.from === 'typed' || ow.from === 'keystore' ? null : ow.from;
  const owner = await wallet.getAddress();
  const onChainOwner = ethers.AbiCoder.defaultAbiCoder().decode(['address'], await provider.call({ to: contract.address, data: D.IFACE.encodeFunctionData('owner') }))[0];
  if (onChainOwner.toLowerCase() !== owner.toLowerCase()) { log(`The contract is owned by ${onChainOwner}, not by ${owner}${from ? ` (key from ${from})` : ''}. Nothing was sent.`); return 1; }

  const record = (r) => { fs.mkdirSync(live.DATA, { recursive: true }); fs.appendFileSync(path.join(live.DATA, 'payouts.jsonl'), JSON.stringify(r) + '\n', { mode: 0o600 }); if (sync && sync.enabled && r.state === 'confirmed') sync.enqueue('payouts', { ts: r.at, tx_hash: r.txHash, kind: r.kind, token: r.symbol, amount_raw: r.amount, amount_usd: r.usd, to_address: r.to, block: r.block }); };

  // resume transfers a previous run planned but did not confirm (the tokens are already in your owner wallet)
  const pending = []; const seen = new Map();
  try { for (const l of fs.readFileSync(path.join(live.DATA, 'payouts.jsonl'), 'utf8').split('\n').filter(Boolean)) { const j = JSON.parse(l); if (j.plan && j.step) seen.set(j.plan + j.step, j); } } catch (_) { /* none */ }
  const withdrawn = new Set([...seen.values()].filter((j) => j.kind === 'withdraw' && j.state === 'confirmed').map((j) => j.plan + ':' + j.symbol));
  // a transfer is resumed only if its withdrawal confirmed (the tokens are in your owner wallet); otherwise they are
  // still in the contract and this run plans them afresh
  for (const j of seen.values()) if (j.state === 'planned' && j.kind !== 'withdraw' && withdrawn.has(j.plan + ':' + j.symbol)) pending.push(j);

  let plan = null, list = [];
  if (pending.length) {
    log(`\nFinishing ${pending.length} transfer(s) from an earlier payout that stopped part-way:`);
    list = pending.map((j) => ({ id: j.step, plan: j.plan, title: `${j.kind} ${j.amountFmt} ${j.symbol} → ${j.to}`, tx: { to: j.token, data: new ethers.Interface(['function transfer(address,uint256)']).encodeFunctionData('transfer', [j.to, BigInt(j.amount)]) }, kind: j.kind, symbol: j.symbol, amount: BigInt(j.amount), usd: j.usd, to: j.to }));
  } else {
    const h = await PO.verifiedHoldings({ provider, secondary, blockscoutUrl: secondary ? null : bsUrl, contract: contract.address, tokens });
    const unverified = h.rows.filter((r) => !r.verified && r.amount && r.amount > 0n);
    for (const r of unverified) log(`  ! ${r.symbol}: the second source (${h.source}) does not confirm the balance at block ${h.block}; not paid out this run`);
    const since = PO.lastPayoutBlock(live.DATA);
    const g = await PO.gasSince(provider, RZ.candidateHashes(readRecord(live.workspaceDir(envFile)), live.DATA), since);
    const s = PO.split({ rows: h.rows, taxBps, gasWei: g.wei, ethPrice8: weth.price8 });
    if (!s.rows.length) { log(`\nNothing to pay out: your contract holds no confirmed profit at block ${h.block} (${h.source}).`); return 0; }
    log(`\nAt block ${h.block}, confirmed by ${h.source}:`);
    for (const r of s.rows) log(`  ${r.symbol.padEnd(8)} ${ethers.formatUnits(r.amount, r.decimals)} (${$(r.usd8)})  → reserve ${ethers.formatUnits(r.tax, r.decimals)} · payout ${ethers.formatUnits(r.payout, r.decimals)}`);
    log(`  value ${$(s.total8)} − gas paid by ${g.n} execution(s) since ${since ? 'block ' + since : 'the start'} ${$(s.gas8)} = net ${$(s.net8)} · T1 reserve ${$(s.tax8)} (${taxBps / 100}% of net, rounded up) · prices: Aave oracle now`);
    plan = 'p' + Date.now();
    list = PO.txs({ rows: s.rows, contract: contract.address, owner, vault, payout }).map((t) => ({ ...t, plan, symbol: t.token.symbol, usd: Number((t.amount * BigInt(t.token.price8)) / 10n ** BigInt(t.token.decimals)) / 1e8 }));
  }

  const fee = await provider.getFeeData(); const maxFee = fee.maxFeePerGas || fee.gasPrice;
  const withdraws = list.filter((t) => t.kind === 'withdraw');
  const wGas = [];
  for (const t of withdraws) wGas.push((await provider.estimateGas({ ...t.tx, from: owner })) * 120n / 100n);
  // the transfers can only be estimated after the withdraw lands, so their cap is the largest estimate plus 25 % headroom
  // (a transfer to a fresh address costs a little more than the first one estimated); that cap is what the total below
  // includes and what you approve, and no transfer may exceed it
  const base = wGas.length ? wGas.reduce((a, b) => (a > b ? a : b)) : (await provider.estimateGas({ ...list[0].tx, from: owner })) * 120n / 100n;
  const cap = (base * 125n) / 100n;
  const worst = (wGas.reduce((a, b) => a + b, 0n) + cap * BigInt(list.length - withdraws.length)) * maxFee;
  log(`\n${list.length} transaction(s):`); list.forEach((t, i) => log(`  ${i + 1}. ${t.title}`));
  log(`  gas at most ${eth(worst)} (≈ ${$((worst * BigInt(weth.price8)) / 10n ** 18n)}), paid by your owner wallet`);
  const bal = await provider.getBalance(owner);
  if (worst > bal) { log(`Owner wallet ${owner} holds ${eth(bal)}: add ETH on Arbitrum One, then run chronos payout again.`); return 1; }
  if (planOnly) { log('\n--plan: nothing sent.'); return 0; }
  if ((await P.input(`Type YES to send these ${list.length} transaction(s)`, { check: () => null })) !== 'YES') { log('Not sent.'); return 1; }

  for (const t of list) if (!pending.length) record({ plan: t.plan, step: t.id, kind: t.kind, symbol: t.symbol, token: t.token ? t.token.address : t.tx.to, amount: t.amount.toString(), amountFmt: t.token ? ethers.formatUnits(t.amount, t.token.decimals) : '', usd: t.usd, to: t.to, state: 'planned', at: new Date().toISOString() });
  for (const t of list) {
    const limit = t.kind === 'withdraw' ? wGas[withdraws.indexOf(t)] : (await provider.estimateGas({ ...t.tx, from: owner })) * 120n / 100n;
    if (t.kind !== 'withdraw' && limit > cap) { log(`  ✗ ${t.title}: needs ${limit} gas, above the ${cap} shown before your YES. Stopped; run chronos payout again to review it.`); return 1; }
    const nonce = Number(BigInt(await provider.send('eth_getTransactionCount', [owner, 'pending'])));
    const sent = await wallet.sendTransaction({ ...t.tx, gasLimit: limit, nonce });
    const r = await sent.wait();
    if (r.status !== 1) { log(`  ✗ ${t.title} reverted (tx ${sent.hash}). Stopped; nothing after it was sent.`); record({ plan: t.plan, step: t.id, kind: t.kind, txHash: sent.hash, block: r.blockNumber, state: 'reverted', at: new Date().toISOString() }); return 1; }
    record({ plan: t.plan, step: t.id, kind: t.kind, symbol: t.symbol, amount: t.amount.toString(), usd: t.usd, to: t.to, txHash: sent.hash, block: r.blockNumber, state: 'confirmed', at: new Date().toISOString() });
    log(`  ✓ ${t.title} · block ${r.blockNumber} · tx ${sent.hash}`);
  }
  if (sync && sync.enabled) await sync.flush();
  log('\nDone. Every transfer above is on-chain; data/payouts.jsonl has each transaction hash.');
  return 0;
}
module.exports = { runPayout };
