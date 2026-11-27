'use strict';
// `chronos deploy` screen. All reads are live; every transaction is listed with its gas estimate and worst-case cost
// before you type YES. See lib/deploy.cjs for what each step does and why.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const D = require('../lib/deploy.cjs');
const live = require('../lib/live.cjs');
const ENV = require('../lib/envfile.cjs');
const { loadConfig, parseEnvFile } = require('../lib/config.cjs');
const { SIGNING_KEYS } = require('../lib/catalog.cjs');
const { redact } = require('../lib/safety.cjs');
const integrity = require('../lib/integrity.cjs');

const say = (s = '') => process.stdout.write(s + '\n');
const eth = (wei) => `${Number(ethers.formatEther(wei)).toFixed(6)} ETH`;
const usd = (n) => (n === null ? '' : ` (≈ $${n.toFixed(2)})`);

/** ask: { secret(label,hint), input(label,{check}) } — the terminal prompts by default; tests pass their own. */
async function runDeploy({ planOnly = false, v2 = false, ask = null, log = say, svc = null } = {}) {
  const P = ask || require('./prompt.cjs');
  if (!ask && !planOnly && !process.stdin.isTTY) { log('chronos deploy asks for your YES before sending, so it needs a terminal: run it in Termux.'); return 2; }
  const S = svc || require('../lib/service.cjs');
  const envFile = live.findEnvFile();
  if (!envFile) { log('No .env found. Run: chronos setup'); return 2; }
  const get = (k) => (process.env[k] !== undefined ? process.env[k] : parseEnvFile(envFile)[k]);
  const v = integrity.verify();
  if (!v.ok) { log(`Code integrity check failed (${v.sealed ? 'code differs from its seal' : 'not sealed'}). Reinstall before deploying.`); return 2; }
  const art = D.loadArtifact(v2 ? D.ARTIFACT_V2 : D.ARTIFACT);
  log(`◆ chronos deploy · ${art.contract} · ${art.compiler.split('+')[0]} · OpenZeppelin ${art.openzeppelinContracts} · bytecode sha256 ${art.bytecodeSha256.slice(0, 16)}…`);
  log(`  source: ${art.origin}. Not externally audited.`);
  const cfg = loadConfig(envFile);
  if (cfg.problems.length) { log(`${cfg.problems.length} setting(s) missing: run chronos setup first.`); return 2; }
  const { policy, problems } = D.readDeployPolicy(get);
  for (const p of problems) log('  ! ' + p);

  log('\nReading Arbitrum One (Aave, venues, pools)…');
  const st = await live.init(cfg, (k, s, d) => { if (s !== 'run') log(`  ${s === 'ok' ? '✓' : '✗'} ${k}${d ? ' · ' + d : ''}`); });
  const provider = st.provider;
  const weth = st.assets.find((a) => a.address === live.WETH);
  const ethPrice8 = weth && weth.price8 ? weth.price8 : null;
  const venues = JSON.parse(fs.readFileSync(live.VENUES_FILE, 'utf8')).venues;
  const execVenues = st.venueReport.filter((r) => r.ok && r.executable && (venues.find((x) => x.id === r.id) || {}).kind !== 'curve').map((r) => ({ id: r.id, router: (venues.find((x) => x.id === r.id) || {}).router })); // Curve has no router: its pools are allowed one by one
  for (const v of execVenues.filter((x) => !x.router)) log(`  ! ${v.id} has no router address in venues.json: it cannot be traded, so it is not allowed on the contract`);
  const routers = execVenues.filter((x) => x.router).map((x) => ({ id: x.id, address: ethers.getAddress(x.router) }));
  const traded = new Set(st.markets.filter((m) => m.executable).flatMap((m) => m.pair.map((x) => x.toLowerCase())));
  const assets = st.usable.filter((a) => a.flashEnabled && traded.has(a.address)).map((a) => ({ address: ethers.getAddress(a.address), symbol: a.symbol, decimals: a.decimals, price8: a.price8 }));
  const maxLadderUsd = Math.max(...cfg.SIZE_LADDER_USD);
  // contract v2: Balancer vault (read on-chain at init) and the factories it may swap through directly
  let v2cfg = null;
  if (v2) {
    if (!st.balancer || !st.balancer.vault) { log('Balancer V2 was not found on this chain read; contract v2 needs its vault. Nothing was sent.'); return 1; }
    const snap = await live.snapshot(cfg, st); // measures each V2 venue's swap fee from a real quote
    const okIds = new Set(st.venueReport.filter((r) => r.ok).map((r) => r.id));
    const fx = D.v2Factories(venues, okIds, snap.v2Fees || {});
    for (const id of fx.skipped) log(`  · ${id}: swap fee not measurable right now, so its pairs trade through its router only`);
    // Curve pools: only on a contract that has setCurvePool (v2.3+), only pools discovered and checked this run
    const curveAble = art.abi.some((x) => x.type === 'function' && x.name === 'setCurvePool');
    const curvePools = curveAble ? st.markets.filter((m) => m.kind === 'curve').map((m) => ({ id: m.id, address: ethers.getAddress(m.address) })) : [];
    v2cfg = { vault: ethers.getAddress(String(st.balancer.vault).toLowerCase()), factories: fx.factories, curvePools };
  }
  const execRaw = get('CHRONOS_EXECUTOR_ADDRESS');
  const executor = /^0x[0-9a-fA-F]{40}$/.test(execRaw || '') ? ethers.getAddress(execRaw.toLowerCase()) : null;
  const asAddr = (x) => (/^0x[0-9a-fA-F]{40}$/.test(x || '') ? ethers.getAddress(x.toLowerCase()) : null);
  let contract = asAddr(get('CHRONOS_FLASH_ARB_ADDRESS'));
  if (!contract && asAddr(get('CONTRACT_ADDRESS'))) {
    // CONTRACT_ADDRESS may belong to another tool: use it only if it really is a ChronosFlashArb; otherwise leave it
    const other = asAddr(get('CONTRACT_ADDRESS'));
    const looks = await provider.call({ to: other, data: D.IFACE.encodeFunctionData('MAX_LEGS') }).then((r) => Number(D.IFACE.decodeFunctionResult('MAX_LEGS', r)[0]) === 4).catch(() => false);
    if (looks) { contract = other; const d = ENV.load(envFile); ENV.set(d, 'CHRONOS_FLASH_ARB_ADDRESS', other); ENV.save(d); log(`  ✓ CONTRACT_ADDRESS ${other} is your ChronosFlashArb: saved as CHRONOS_FLASH_ARB_ADDRESS`); }
    else log(`  · CONTRACT_ADDRESS ${other} is not a ChronosFlashArb (another tool's contract?). Left as it is; your ChronosFlashArb is deployed and saved as CHRONOS_FLASH_ARB_ADDRESS, which Chronos uses.`);
  }

  // owner key: your encrypted keystore (passphrase), else .env, else typed hidden (lib/keystore.cjs, tui/owner.cjs)
  const ow = await require('./owner.cjs').ownerWallet({ P, get, provider, log, dataDir: require('../lib/live.cjs').DATA, signingKeys: ['DEPLOYER_PRIVATE_KEY', ...SIGNING_KEYS.filter((x) => x !== 'DEPLOYER_PRIVATE_KEY')], hint: 'the wallet that will own the contract and pay for these transactions' });
  if (!ow) return 1;
  const wallet = ow.wallet; const from = ow.from === 'typed' || ow.from === 'keystore' ? null : ow.from;
  const owner = await wallet.getAddress();
  const ownerBal = await provider.getBalance(owner);
  log(`\nOwner wallet ${owner}${from ? ` (key from ${from} in your .env)` : ''} · balance ${eth(ownerBal)}${usd(ethPrice8 ? Number((ownerBal * ethPrice8) / 10n ** 18n) / 1e8 : null)}`);

  const pl = await D.plan({ provider, owner, aavePool: live.AAVE, contract, executor, routers, assets, maxLadderUsd, headroomPct: policy.MAX_LOAN_HEADROOM_PCT, topUpEth: policy.EXEC_GAS_TOPUP_ETH, v2: v2cfg });
  for (const k of pl.kept) log('  ✓ ' + k);
  for (const n of pl.notes) log('  ! ' + n);
  const record = (r) => { try { fs.mkdirSync(live.DATA, { recursive: true }); fs.appendFileSync(path.join(live.DATA, 'deployments.jsonl'), JSON.stringify(r) + '\n', { mode: 0o600 }); } catch (_) { /* the receipt is on-chain either way */ } };
  const yes = async (what) => (await P.input(`Type YES to send ${what}`, { check: () => null })) === 'YES';

  let address = pl.contract;
  if (pl.deploy) {
    // the same constructor arguments the deployment will use (lib/deploy.cjs ctorArgs): priced exactly as it is sent
    const lenders = v2 ? { vault: v2cfg.vault, morpho: live.MORPHO, v4: live.UNI_V4 } : {};
    const ctor = D.ctorArgs(art, live.AAVE, lenders);
    const tx = await new ethers.ContractFactory(art.abi, art.bytecode).getDeployTransaction(...ctor);
    const c = await D.price(provider, owner, [tx], ethPrice8);
    log(`\n1 transaction: deploy ${art.contract}(${['Aave pool', 'Balancer vault', 'Morpho Blue', 'Uniswap V4 PoolManager'].slice(0, ctor.length).map((n, i) => `${n} ${ctor[i]}`).join(', ')})`);
    log(`  gas limit ${c.each[0]} · max fee ${ethers.formatUnits(c.maxFee, 'gwei')} gwei · at most ${eth(c.worstWei)}${usd(c.worstUsd)}`);
    if (c.worstWei > ownerBal) { log(`Owner balance ${eth(ownerBal)} is below that. Add ETH on Arbitrum One to ${owner}, then run chronos deploy again.`); return 1; }
    if (planOnly) { log('\n--plan: nothing sent.'); return 0; }
    if (!(await yes('the deployment'))) { log('Not sent.'); return 1; }
    const d = await D.deployContract(wallet, art, live.AAVE, c.each[0], record, lenders.vault || null, lenders.morpho || null, lenders.v4 || null);
    address = d.address;
    log(`  ✓ deployed ${address} · block ${d.block} · tx ${d.hash} · paid ${eth(d.gasUsed * d.effectiveGasPrice)}`);
    const doc = ENV.load(envFile); ENV.set(doc, 'CHRONOS_FLASH_ARB_ADDRESS', address);
    if (pl.replaces) { ENV.set(doc, 'CHRONOS_FLASH_ARB_V1_ADDRESS', pl.replaces); log(`  ✓ your v1 contract ${pl.replaces} kept as CHRONOS_FLASH_ARB_V1_ADDRESS (still yours; withdraw from it any time)`); }
    ENV.save(doc);
    log(`  ✓ CHRONOS_FLASH_ARB_ADDRESS=${address} written to ${envFile}`);
  }
  const todo = pl.steps.map((s) => ({ ...s, tx: D.txFor(s, address) }));
  if (todo.length) {
    const c = await D.price(provider, owner, todo.map((t) => t.tx), ethPrice8);
    const value = todo.reduce((s, t) => s + (t.tx.value || 0n), 0n);
    log(`\n${todo.length} setup transaction(s):`);
    todo.forEach((t, i) => log(`  ${i + 1}. ${t.title}   ${t.why}   gas ≤ ${c.each[i]}`));
    log(`  at most ${eth(c.worstWei + value)}${usd(ethPrice8 ? Number(((c.worstWei + value) * ethPrice8) / 10n ** 18n) / 1e8 : null)} including ${eth(value)} sent to the executor`);
    const bal = await provider.getBalance(owner);
    if (c.worstWei + value > bal) { log(`Owner balance ${eth(bal)} is below that. Add ETH on Arbitrum One to ${owner}, then run chronos deploy again (finished steps are skipped).`); return 1; }
    if (planOnly) { log('\n--plan: nothing sent.'); return 0; }
    if (!(await yes(`these ${todo.length} transaction(s)`))) { log('Not sent. Run chronos deploy again when ready; finished steps are skipped.'); return 1; }
    const done = await D.sendAll(wallet, todo, c.each, record);
    for (const d of done) log(`  ✓ ${d.title} · block ${d.block} · tx ${d.hash}`);
  } else if (!pl.deploy) log('\nNothing left to send: the contract is deployed and set up.');

  const restarted = S.restartIfRunning();
  if (ow.bridge) { ow.bridge.finish('Done: every step is confirmed on chain. You can close this page.'); setTimeout(() => ow.bridge.close(), 3000).unref(); }
  log(`\n${restarted ? '✓ engine restarted with your contract' : 'Engine not running as a service; start it: chronos service install'}`);
  if (!executor) log('Next: run cloud/gcp-setup.sh in Google Cloud Shell, put CHRONOS_EXECUTOR_ADDRESS and CHRONOS_EXECUTOR_KMS_KEY in .env (chronos set …), then chronos deploy again to make it an operator and fund its gas.');
  else log('The engine now shadow-tests your contract every scan and switches to live only when your rules are met.');
  return 0;
}

module.exports = { runDeploy, redact };
