'use strict';
// `chronos mainnet`: every remaining step to trade on Arbitrum One, in order, from this phone or computer. Safe to run again: it
// reads what is already done and only does what is missing. Each step is the existing command (chronos set, chronos
// verify-real, chronos deploy --v2, chronos cloud-pack), so every safeguard of those commands applies: secrets typed
// hidden and tested, nothing sent on chain without your typed YES, costs shown first. The steps that need Google Cloud
// (the HSM executor key and the cloud engine, the portal) are handed to one Cloud Shell command, printed here.
const fs = require('fs');
const path = require('path');

const WALLET_KEYS = ['TAX_RESERVE_VAULT', 'PAYOUT_WALLET_ADDRESS'];
const isAddr = (x) => /^0x[0-9a-fA-F]{40}$/.test(x || '');
const CLOUD_CMD = (ver) => `cd ~ && tar xzf chronos-console-${ver}.tgz && CHRONOS_TGZ=~/chronos-console-${ver}.tgz bash chronos-console/cloud/mainnet-cloud.sh`;

/**
 * d (injectable for tests): get(key) → .env value · run(args) → exit code of `chronos <args>` (inherits the terminal) ·
 * device() → { status } · realcheck() → last data/live/realcheck.json · contractKind(address) → 1|2|null ·
 * executors() → offers from your cloud engine [{ device, address, kms_key }] · log(text) · version
 * Returns { done: [...], left: [...] }.
 */
async function runMainnet(d) {
  const { get, run, log } = d;
  const done = [], left = [];
  log('◆ chronos mainnet — every step to trade on Arbitrum One, in order. Safe to run again: finished steps are skipped.\n');

  // 1. this device is approved (portal data, releases)
  let dev = null; try { dev = await d.device(); } catch (_) { /* not enrolled or offline */ }
  if (!dev || dev.status !== 'approved') { log(`1. Device: ${dev ? dev.status + ' — approve pairing code ' + dev.code + ' in your portal → Devices' : 'not enrolled: chronos device'}; then run chronos mainnet again.`); left.push('approve this device'); return { done, left }; }
  done.push('device approved');

  // 2. every wallet address and key in one sitting (chronos keys: node, websocket derived when it can be, second node,
  // tax reserve, payout wallet, AI key); only what is missing is asked
  if (['ARB_RPC_URL', ...WALLET_KEYS].some((k) => !get(k)) || !get('ARBITRUM_WSS_URL')) { log('\n2. Your wallets and keys, all at once'); run(['keys']); }
  for (const k of ['ARB_RPC_URL', ...WALLET_KEYS]) { if (get(k)) done.push(k + ' set'); else left.push('set ' + k + ' (chronos keys)'); }
  if (!get('ARBITRUM_WSS_URL')) log('   (no websocket: the engine re-checks on a timer instead of every block; optional)');

  // 2b. the engine keeps running: on a phone (Termux) chronos phone (restart when Termux opens, wake lock, boot start,
  // battery); on a computer the background service (PM2, started again at boot)
  const onPhone = d.onPhone !== undefined ? d.onPhone : /com\.termux/.test(process.env.PREFIX || '');
  log(onPhone ? '\n2b. Keeping the engine running on this phone' : '\n2b. Keeping the engine running on this computer (background service)');
  if (run(onPhone ? ['phone'] : ['service', 'install']) === 0) done.push('engine running'); else left.push(onPhone ? 'engine not running: see chronos phone' : 'engine not running: chronos service install (needs pm2: npm install -g pm2)');

  // 3. every real check (read-only on chain); contract v2 is deployed only if its real-protocol checks pass
  log('\n3. Real checks against Arbitrum One and your services');
  run(['verify-real']);
  const rc = d.realcheck();
  const res = Object.fromEntries(((rc && rc.results) || []).map((r) => [r.id, r]));
  const v2ok = res['contract-v2-probe'] && res['contract-v2-probe'].status === 'pass';
  for (const id of ['rpc-is-arbitrum', 'aave-reads', 'venues-real', 'portal-backend']) if (res[id] && res[id].status === 'fail') left.push(`fix real check ${id}: ${res[id].detail}`);

  // 4. contract v2 (plan and costs shown, sent only on YES)
  const addr = get('CHRONOS_FLASH_ARB_ADDRESS');
  let kind = isAddr(addr) ? await d.contractKind(addr) : null;
  if (kind === 2) done.push('contract v2 deployed at ' + addr);
  else if (!v2ok) { log('\n4. Contract v2 is not deployed: its real-protocol checks did not all pass (see above), so it is not offered. Fix that first.'); left.push('contract v2 real-protocol checks must pass'); }
  else {
    log(`\n4. Contract v2 ${kind === 1 ? '(replacing your v1, which stays yours)' : ''}: every transaction and its cost are shown; nothing is sent until you type YES.`);
    run(['deploy', '--v2']);
    kind = isAddr(get('CHRONOS_FLASH_ARB_ADDRESS')) ? await d.contractKind(get('CHRONOS_FLASH_ARB_ADDRESS')) : null;
    if (kind === 2) done.push('contract v2 deployed at ' + get('CHRONOS_FLASH_ARB_ADDRESS')); else left.push('deploy contract v2 (chronos deploy --v2)');
  }

  // 5. the HSM executor and the cloud engine (Google Cloud), then make it an operator and fund its gas
  // your cloud engine offers its executor through your portal once you approve it: picked up here, nothing copied
  if (!(isAddr(get('CHRONOS_EXECUTOR_ADDRESS')) && get('CHRONOS_EXECUTOR_KMS_KEY')) && d.executors) {
    let offers = []; try { offers = await d.executors(); } catch (_) { /* offline or not approved: the paste path below */ }
    if (require('../lib/handoff.cjs').choose(offers)) { log('\n5. Your cloud engine offered its executor: saving it.'); run(['executor']); }
  }
  const hasExec = isAddr(get('CHRONOS_EXECUTOR_ADDRESS')) && !!get('CHRONOS_EXECUTOR_KMS_KEY');
  if (hasExec) {
    done.push('executor ' + get('CHRONOS_EXECUTOR_ADDRESS'));
    if (kind === 2) { log('\n5. Executor: making sure it is an operator of your contract and holds gas (only what is missing is sent, on YES).'); run(['deploy', '--v2']); }
  } else {
    if (kind === 2) run(['cloud-pack']);
    log(`\n5. Executor key and cloud engine: Google Cloud Shell (shell.cloud.google.com).
   Upload (menu ⋮ → Upload): chronos-console-${d.version}.tgz, chronos-portal.tgz${kind === 2 ? ', and chronos-settings.env (just written)' : ''}. Then run:

   ${CLOUD_CMD(d.version)}

   When it finishes, approve the device "chronos-engine" in your portal → Devices. Your cloud engine then offers its
   executor and this phone picks it up by itself (a notification says so; or run chronos mainnet again). Nothing to
   copy. If you would rather paste them now, do it below (Esc skips):`);
    if (run(['set', 'CHRONOS_EXECUTOR_ADDRESS']) === 0 && run(['set', 'CHRONOS_EXECUTOR_KMS_KEY']) === 0 && isAddr(get('CHRONOS_EXECUTOR_ADDRESS'))) {
      done.push('executor ' + get('CHRONOS_EXECUTOR_ADDRESS'));
      if (kind === 2) run(['deploy', '--v2']);
    } else left.push('Cloud Shell: ' + CLOUD_CMD(d.version) + ' — then chronos mainnet again');
  }

  log('\n◆ Done: ' + (done.length ? done.join(' · ') : 'nothing yet'));
  log(left.length ? '◆ Left: ' + left.join(' · ') : '◆ Nothing left: the cloud engine shadow-tests every approved route and goes LIVE when your promotion rules hold.');
  return { done, left };
}

/** the real dependencies, for the command line */
function realDeps() {
  const live = require('../lib/live.cjs');
  const envFile = live.findEnvFile();
  const { parseEnvFile, loadConfig } = require('../lib/config.cjs');
  const get = (k) => (process.env[k] !== undefined ? process.env[k] : envFile ? (parseEnvFile(live.findEnvFile() || envFile)[k] || '') : '');
  const CLI = path.join(__dirname, '..', 'bin', 'chronos.cjs');
  return {
    get, log: (s) => process.stdout.write(s + '\n'), version: require('../package.json').version,
    run: (args) => { const r = require('child_process').spawnSync(process.execPath, [CLI, ...args], { stdio: 'inherit' }); return r.status === null ? 1 : r.status; },
    device: () => require('../lib/device.cjs').status(),
    executors: () => require('../lib/device.cjs').executors(),
    realcheck: () => { try { return JSON.parse(fs.readFileSync(path.join(live.DATA, 'live', 'realcheck.json'), 'utf8')); } catch (_) { return null; } },
    contractKind: async (a) => { try { const p = await require('../lib/chain.cjs').connect(loadConfig(envFile)); if ((await p.getCode(a)) === '0x') return null; return (await require('../lib/contractinfo.cjs').read(p, a)).kind; } catch (_) { return null; } },
  };
}

module.exports = { runMainnet, realDeps, CLOUD_CMD };
