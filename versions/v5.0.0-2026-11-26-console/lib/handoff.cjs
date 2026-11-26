'use strict';
// The executor hand-off between your engines. The cloud engine holds the Cloud KMS HSM key; it derives its address
// from the key's own public key and offers it through your release service (op executor_offer, approved devices
// only). This phone reads the offers (op executors) and saves CHRONOS_EXECUTOR_ADDRESS and CHRONOS_EXECUTOR_KMS_KEY:
// neither is secret, nothing is copied by hand, and nothing is sent on chain here (chronos mainnet / deploy then show
// the operator and gas transactions and send them only on YES).
const { ethers } = require('ethers');
const { KEY_RE } = require('./kms.cjs');
const E = require('./envfile.cjs');

/** the offer to use: the newest valid one; null when there is none. `others` lists different executors also offered. */
function choose(offers) {
  const ok = (offers || []).filter((x) => x && /^0x[0-9a-fA-F]{40}$/.test(x.address || '') && KEY_RE.test(x.kms_key || ''));
  if (!ok.length) return null;
  const pick = ok[0];
  const others = [...new Set(ok.slice(1).map((x) => x.address.toLowerCase()))].filter((a) => a !== pick.address.toLowerCase());
  return { ...pick, address: ethers.getAddress(pick.address.toLowerCase()), others };
}

/** save the chosen executor into the .env; returns what changed ([] when it was already saved) */
function save(envFile, x) {
  const d = E.load(envFile); const changed = [];
  for (const [k, v] of [['CHRONOS_EXECUTOR_ADDRESS', x.address], ['CHRONOS_EXECUTOR_KMS_KEY', x.kms_key]]) if (E.get(d, k) !== v) { E.set(d, k, v); changed.push(k); }
  if (changed.length) E.save(d);
  return changed;
}

/** `chronos executor`: fetch the offers, save the newest, say what happened. → exit code */
async function run({ envFile, executors, log = console.log }) {
  if (!envFile) { log('No .env found: run chronos setup first.'); return 2; }
  let offers;
  try { offers = await executors(); } catch (e) { log(`Your release service did not answer (${e.status === 403 ? 'this device is not approved: chronos device' : String(e.message).slice(0, 80)}).`); return 1; }
  const x = choose(offers);
  if (!x) { log('No executor offered yet. Your cloud engine offers it once you approve the device "chronos-engine" in your portal → Devices (it appears a minute after the VM starts).'); return 1; }
  const changed = save(envFile, x);
  log(`${changed.length ? '✓ saved' : '✓ already saved'}: executor ${x.address} from ${x.device}\n  KMS key ${x.kms_key}`);
  if (x.others.length) log(`  Note: your devices also offered ${x.others.join(', ')}; the newest one is used.`);
  log('  Next: chronos mainnet (makes it an operator of your contract and sends it gas; costs shown, sent only on YES).');
  return 0;
}

module.exports = { choose, save, run };
