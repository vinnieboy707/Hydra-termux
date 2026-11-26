'use strict';
// `chronos executor import | unlock | lock | status` (2.9.11): your own operator key signs trades on this phone.
//   import  the key, typed hidden here (never in chat, never in .env), kept only in the encrypted keystore
//   unlock  starts the key agent (lib/keyagent.cjs) with your passphrase; trading can go LIVE once the usual checks pass
//   lock    stops the agent: nothing can be signed until the next unlock
//   status  the agent, the keystore, and the real-chain check (operator on your contract, gas, policy probes)
// The key is never the owner key: the owner key moves money; the executor key can only start trades.
const KS = require('../lib/keystore.cjs');
const KA = require('../lib/keyagent.cjs');

/** d: { sub, dataDir, envFile, P, log, get, setEnv(k, v) } → exit code */
async function run(d) {
  const { sub, dataDir, log } = d;
  if (sub === 'import') return importKey(d);
  if (sub === 'unlock') return unlock(d);
  if (sub === 'lock') {
    const st = await KA.status(dataDir); if (!st) { log('The key agent is not running: already locked.'); return 0; }
    await KA.call(dataDir, { op: 'stop' }).catch(() => null);
    log(`Locked. ${st.address} signs nothing until chronos executor unlock (the engine holds trading meanwhile).`); return 0;
  }
  if (sub === 'status') {
    const ks = KS.executorAddress(dataDir); const st = await KA.status(dataDir);
    log(ks ? `Executor keystore: ${ks} (encrypted, this phone only)` : 'No executor keystore here: chronos executor import');
    log(st ? `Key agent: unlocked · ${st.signed} signed · up ${Math.round(st.upSec / 60)} min · contract ${st.contract}` : 'Key agent: locked (not running): chronos executor unlock');
    if (!ks || !d.verify) return st ? 0 : 1;
    const r = await d.verify(); const x = r.results.find((y) => y.id === 'executor-agent');
    log(`Real-chain check: ${x ? `${x.status} · ${x.detail}` : 'not run'}`); return x && x.status === 'pass' ? 0 : 1;
  }
  log('chronos executor import | unlock | lock | status   (no word: save the cloud executor your cloud engine offered)'); return 2;
}

async function importKey(d) {
  const { ethers } = require('ethers'); const { P, dataDir, log, get } = d;
  let key = await P.secret('Executor private key (hidden; encrypted on this phone, never shown, never sent)', 'the account you made an operator, e.g. 0xf98C…');
  if (!key) { log('Cancelled.'); return 1; }
  let w; try { w = new ethers.Wallet(key.startsWith('0x') ? key : '0x' + key); } catch (_) { log('That is not a valid private key. Nothing was saved.'); return 1; }
  key = null;
  const addr = w.address;
  const owner = KS.ownerAddress(dataDir);
  if (owner && owner.toLowerCase() === addr.toLowerCase()) { log(`Refused: ${addr} is your OWNER wallet. The executor must be a separate account (the owner key moves money; the executor only starts trades). Nothing was saved.`); return 1; }
  if (d.contractOwner) { const co = await d.contractOwner().catch(() => null); if (co && co.toLowerCase() === addr.toLowerCase()) { log(`Refused: ${addr} owns your contract. Use a separate operator account. Nothing was saved.`); return 1; } }
  const want = get('CHRONOS_EXECUTOR_ADDRESS');
  if (/^0x[0-9a-fA-F]{40}$/.test(want || '') && want.toLowerCase() !== addr.toLowerCase()) { log(`Refused: this key is for ${addr}, but your executor is ${want}. Import the key for ${want}, or first: chronos set CHRONOS_EXECUTOR_ADDRESS ${addr} and chronos deploy (to make it an operator). Nothing was saved.`); return 1; }
  log(`Key for ${addr}.`);
  const p1 = await P.secret(`New passphrase for it (at least ${KS.MIN_PASS} characters; a few words is best)`, 'hidden · you type it after every phone restart');
  const p2 = p1 ? await P.secret('Same passphrase again', 'hidden') : null;
  if (!p1 || p1 !== p2) { log('Not saved: ' + (p1 ? 'the two passphrases differ' : 'cancelled')); return 1; }
  const bad = KS.passOk(p1); if (bad) { log('Not saved: ' + bad); return 1; }
  const prev = KS.executorAddress(dataDir);
  await KS.saveKey(dataDir, 'executor', w.privateKey, p1);
  log(`✓ executor key kept encrypted for ${addr}${prev ? ` (the previous keystore for ${prev} was moved aside, not deleted)` : ''}`);
  if (!want) { d.setEnv('CHRONOS_EXECUTOR_ADDRESS', addr); log(`  CHRONOS_EXECUTOR_ADDRESS set to ${addr}`); }
  if (P.confirm && (await P.confirm('Unlock it now so the engine can trade?', true))) return unlock({ ...d, pass: p1 });
  log('Next: chronos executor unlock'); return 0;
}

async function unlock(d) {
  const { P, dataDir, log, get } = d;
  const ks = KS.executorAddress(dataDir);
  if (!ks) { log('No executor keystore here: chronos executor import'); return 1; }
  const contract = get('CHRONOS_FLASH_ARB_ADDRESS');
  if (!/^0x[0-9a-fA-F]{40}$/.test(contract || '')) { log('No contract yet (CHRONOS_FLASH_ARB_ADDRESS): chronos mainnet'); return 1; }
  const st = await KA.status(dataDir);
  if (st) { log(`Already unlocked: ${st.address} for contract ${st.contract}.`); return 0; }
  let pass = d.pass || null;
  for (let i = 0; i < 3; i++) {
    if (!pass) pass = await P.secret(`Passphrase for your executor keystore (${ks.slice(0, 6)}…${ks.slice(-4)})`, 'hidden');
    if (!pass) { log('Cancelled: still locked.'); return 1; }
    log('Opening the keystore (a few seconds on a phone)…');
    const r = await (d.start || KA.start)({ dataDir, contract, passphrase: pass, maxTxEth: get('CHRONOS_AGENT_MAX_TX_ETH') || null });
    pass = null;
    if (r.ok) {
      log(`✓ unlocked: the key agent signs trades as ${r.address}, only to your contract ${contract}, only execute(), at most ${get('CHRONOS_AGENT_MAX_TX_ETH') || require('ethers').formatEther(KA.DEFAULT_MAX_TX_WEI)} ETH of worst-case gas each.`);
      log('  It keeps running when the engine restarts; after a phone restart run chronos executor unlock again (you get a notification).');
      log('  Check it on the real chain: chronos executor status');
      return 0;
    }
    log(r.why);
    if (!/passphrase/.test(r.why)) return 1;
  }
  log('Three wrong passphrases: still locked.'); return 1;
}

module.exports = { run };
