'use strict';
// `chronos keys`: every wallet address and key Chronos uses, in one sitting, in order. Each is typed (secrets hidden),
// tested and saved by `chronos set`, so every check of that command applies; one already set is shown as done and
// skipped. The websocket url is not asked for when it can be derived: Arbitrum's public RPC has no websocket, but most
// providers (Alchemy, Infura, QuickNode, Chainstack, dRPC, SwiftNodes) serve one on the same key; the derived url is tested on the
// live chain and saved only if it answers as Arbitrum One. Without one the engine still runs (it re-checks on a timer
// instead of on every block).
// Private keys are never stored (policy S0 and the deploy policy): your owner key is typed once, hidden, by the deploy
// step itself and forgotten when it ends; trades are signed by the Cloud KMS HSM key, which never leaves Google.
const ORDER = [
  { key: 'ARB_RPC_URL', need: true, why: 'your Arbitrum One node (https url with your provider key)' },
  { key: 'ARBITRUM_WSS_URL', need: false, why: 'websocket for every new block (derived from your node when it can be)', derive: true },
  { key: 'ARB_RPC_URL_2', need: false, why: 'a second node from another provider (verifies balances, sends your trades twice)' },
  { key: 'ARB_RPC_URL_3', need: false, why: 'a third node from yet another provider (another failover)' },
  { key: 'TAX_RESERVE_VAULT', need: true, why: 'policy T1: where 30% of every profit goes' },
  { key: 'PAYOUT_WALLET_ADDRESS', need: true, why: 'where profit is paid' },
  { key: 'OPENROUTER_API_KEY', need: false, why: 'turns on the AI agent (the model is chosen for you)' },
];

// the provider's websocket url for an https Arbitrum url (lib/providers.cjs, shared with the engine's feed)
const { wssFromRpc } = require('../lib/providers.cjs');

/**
 * d (injectable): get(key) · run(args) → exit code of `chronos <args>` · testWss(url) → { ok, msg } · save(key, value) ·
 * log(text). Returns { set: [...], skipped: [...], missing: [...] }.
 */
async function runKeys(d) {
  const { get, run, log } = d; const out = { set: [], skipped: [], missing: [] };
  log('◆ chronos keys — every wallet address and key, in one sitting. Secrets are typed hidden and tested; Esc skips an optional one.\n');
  // a bundle from your other device restores everything with one passphrase
  if (d.bundle && !['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL'].some((k) => get(k))) { log(`  found ${d.bundle}: restoring from it first (chronos keys import)`); run(['keys', 'import', d.bundle]); }
  // first, everything already on this device: env-style files in your home folder, Downloads and CHRONOS_IMPORT_FROM
  // (each value tested before it is saved; private keys are never imported)
  if (d.importFirst) {
    const imp = await d.importFirst();
    if (imp) log(`  found on this device: ${imp.files} file(s) searched · ${imp.imported.length} imported${imp.imported.length ? ' (' + imp.imported.map((x) => x.key).join(', ') + ')' : ''}${(imp.kept || []).length ? ` · ${imp.kept.length} kept (your current value works; older copies ignored: ${imp.kept.join(', ')})` : ''}${imp.failed.length ? ` · no working copy of ${imp.failed.join(', ')}` : ''}${imp.conflicts.length ? ` · several working values for ${imp.conflicts.join(', ')}: pick one in chronos setup → Import` : ''}`);
    for (const x of (imp && imp.imported) || []) if (x.exposed) log(`  ! ${x.key} came from a shared or synced copy: rotate it at its provider when you can`);
  }
  // any node you already have counts (the engine uses the first of ARB_RPC_URL, ARBITRUM_RPC_URL, RPC_URL, ALCHEMY_RPC_URL)
  const RPCS = ['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL', 'ARB_RPC_URL_2', 'ARB_RPC_URL_3', 'ARB_RPC_URL_4', 'ARB_RPC_URL_5'];
  const haveRpc = RPCS.find((k) => get(k));
  for (const k of ORDER) {
    if (get(k.key)) { log(`  ✓ ${k.key} already set`); out.skipped.push(k.key); continue; }
    if (k.key === 'ARB_RPC_URL' && haveRpc) { log(`  ✓ node already set (${haveRpc})`); out.skipped.push(k.key); continue; }
    if (k.derive) {
      // from whichever of your nodes has a provider websocket (the public RPC has none)
      const w = RPCS.map((r) => wssFromRpc(get(r))).find(Boolean) || null;
      if (w) {
        const r = await d.testWss(w);
        if (r.ok) { d.save(k.key, w); log(`  ✓ ${k.key} derived from your node's provider and tested (${r.msg})`); out.set.push(k.key); continue; }
        log(`  · ${k.key}: your provider's websocket did not answer (${r.msg})`);
      } else log(`  · ${k.key}: your node${RPCS.some((r) => get(r)) ? 's have' : ' (not set yet) has'} no websocket (Arbitrum's public RPC has none). Optional: paste one from Alchemy, Infura, QuickNode or Chainstack, or Esc to run without it.`);
    }
    log('');
    if (run(['set', k.key], { CHRONOS_SET_LABEL: `${k.key}${k.need ? '' : ' (optional)'}: ${k.why}` }) === 0 && get(k.key)) out.set.push(k.key); else (k.need ? out.missing : out.skipped).push(k.key);
  }
  // the plan of each metered provider you use (their limits differ by 100×): asked once, Esc keeps the safe default
  const PR = require('../lib/providers.cjs');
  const ids = [...new Set([...RPCS, 'ARBITRUM_WSS_URL', 'ARB_WSS_URL'].map((r) => get(r)).filter(Boolean).map((u) => PR.identify(u).id))];
  for (const id of ids) {
    const pk = PR.P[id] && PR.P[id].planKey; if (!pk) continue;
    if (get(pk)) { log(`  ✓ ${pk} already set (${get(pk)})`); continue; }
    log('');
    if (run(['set', pk], { CHRONOS_SET_LABEL: `${pk} (optional, default free): your ${PR.P[id].name} plan — ${Object.keys(PR.P[id].plans).join(', ')}. Chronos keeps inside its limits (chronos nodes)` }) === 0 && get(pk)) out.set.push(pk); else out.skipped.push(pk);
  }
  if (out.set.length && d.restart) d.restart(); // once, for the whole sitting
  log(`\n◆ ${out.set.length} saved · ${out.skipped.length} already set or skipped${out.missing.length ? ` · still needed: ${out.missing.join(', ')} (chronos keys again)` : ' · nothing required is missing'}`);
  log('  Your owner private key is not asked for here. Keep it encrypted once (chronos owner save) and deploy and payouts ask only for its passphrase; carry everything to another device with chronos keys export.');
  return out;
}

/** the real dependencies */
function realDeps() {
  const path = require('path'); const live = require('../lib/live.cjs'); const E = require('../lib/envfile.cjs');
  const { parseEnvFile } = require('../lib/config.cjs');
  const CLI = path.join(__dirname, '..', 'bin', 'chronos.cjs');
  const get = (k) => { const f = live.findEnvFile(); return process.env[k] !== undefined ? process.env[k] : f ? parseEnvFile(f)[k] || '' : ''; };
  const C = require('../lib/catalog.cjs'); const wss = C.SECRETS.find((x) => x.key === 'ARBITRUM_WSS_URL');
  return {
    get, log: (s) => process.stdout.write(s + '\n'),
    run: (args, extra = {}) => { const r = require('child_process').spawnSync(process.execPath, [CLI, ...args], { stdio: 'inherit', env: { ...process.env, CHRONOS_NO_RESTART: '1', ...extra } }); return r.status === null ? 1 : r.status; },
    restart: () => { const r = require('../lib/service.cjs').restartSoon(); process.stdout.write(r === 'requested' ? '\nengine restarting in the background to load your keys (a few seconds)\n' : '\nengine not running: it loads your keys when it starts\n'); },
    testWss: (u) => wss.test(u),
    save: (k, v) => { const f = live.defaultEnvFile(); const doc = E.load(f); E.set(doc, k, v); E.save(doc); },
    bundle: (() => { const fs = require('fs'); const os = require('os'); for (const f of [path.join('/sdcard', 'Download', 'chronos-keys.enc'), path.join(os.homedir(), 'storage', 'downloads', 'chronos-keys.enc'), path.join(os.homedir(), 'Downloads', 'chronos-keys.enc')]) if (fs.existsSync(f)) return f; return null; })(),
    importFirst: async () => {
      if (process.env.CHRONOS_NO_AUTO_IMPORT) return null;
      const f = live.defaultEnvFile(); if (!require('fs').existsSync(f)) E.save(E.load(f));
      try { return await require('../lib/autopilot.cjs').importKeys(f, live.workspaceDir(f), null); } catch (_) { return null; }
    },
  };
}

// ── persistence across devices: one sealed bundle (lib/keystore.cjs) ────────────────────────────────────────────
const NEVER_PLAIN = /PRIVATE_KEY|MNEMONIC|SEED/; // a private key never goes into the bundle in plaintext

/** `chronos keys export [file]`: every line of your .env except private keys, plus your owner keystore (still
 * encrypted), sealed with a passphrase. → exit code. d: { envFile, dataDir, P, log, out } */
async function exportBundle(d) {
  const fs = require('fs'); const KS = require('../lib/keystore.cjs'); const { parseEnvFile } = require('../lib/config.cjs');
  const env = parseEnvFile(d.envFile); const entries = Object.entries(env).filter(([k, v]) => v !== '' && !NEVER_PLAIN.test(k)).map(([key, value]) => ({ key, value }));
  let ownerJson = null; try { ownerJson = fs.readFileSync(KS.fileOf(d.dataDir), 'utf8'); } catch (_) { /* no keystore */ }
  const p1 = await d.P.secret(`Passphrase for the bundle (at least ${KS.MIN_PASS} characters; use your keystore passphrase to keep one)`, 'hidden');
  const p2 = p1 ? await d.P.secret('Same passphrase again', 'hidden') : null;
  if (!p1 || p1 !== p2) { d.log(p1 ? 'The two passphrases differ: nothing written.' : 'Cancelled.'); return 1; }
  const bad = KS.passOk(p1); if (bad) { d.log('Not written: ' + bad); return 1; }
  fs.writeFileSync(d.out, KS.seal(entries, p1, ownerJson), { mode: 0o600 });
  d.log(`✓ ${entries.length} settings${ownerJson ? ' and your owner keystore' : ''} sealed in ${d.out}\n  Copy it to the new phone or computer (Downloads or Drive), then there: chronos keys import`);
  return 0;
}

/** `chronos keys import [file]`: restore a bundle; values already set are kept, new ones saved; the owner keystore is
 * restored if this device has none. → exit code. d: { file, envFile, dataDir, P, log, test(key, value) → {ok,msg}|null } */
async function importBundle(d) {
  const fs = require('fs'); const path = require('path'); const KS = require('../lib/keystore.cjs'); const E = require('../lib/envfile.cjs');
  let text; try { text = fs.readFileSync(d.file, 'utf8'); } catch (_) { d.log(`No bundle at ${d.file}: export one first on your other device (chronos keys export).`); return 1; }
  let b = null;
  for (let i = 0; i < 3 && !b; i++) { const p = await d.P.secret('Passphrase for the bundle', 'hidden'); if (!p) { d.log('Cancelled.'); return 1; } try { b = KS.open(text, p); } catch (e) { d.log(e.message); } }
  if (!b) { d.log('Nothing imported.'); return 1; }
  const doc = E.load(d.envFile); const added = [], kept = [], failed = [];
  for (const { key, value } of b.entries) {
    if (NEVER_PLAIN.test(key)) continue;
    if (E.get(doc, key)) { kept.push(key); continue; }
    const t = d.test ? await d.test(key, value) : null;
    if (t && !t.ok) { failed.push(`${key} (${t.msg})`); continue; }
    E.set(doc, key, value); added.push(key);
  }
  E.save(doc); try { fs.chmodSync(d.envFile, 0o600); } catch (_) { /* S0 is checked by doctor */ }
  let owner = '';
  if (b.ownerJson) {
    if (KS.ownerAddress(d.dataDir)) owner = ' · this device already has an owner keystore: kept';
    else { fs.mkdirSync(path.dirname(KS.fileOf(d.dataDir)), { recursive: true, mode: 0o700 }); fs.writeFileSync(KS.fileOf(d.dataDir), b.ownerJson, { mode: 0o600 }); owner = ` · owner keystore restored (${KS.ownerAddress(d.dataDir)})`; }
  }
  d.log(`✓ from the bundle of ${b.at}: ${added.length} added · ${kept.length} already set here (kept)${failed.length ? ` · ${failed.length} failed their test: ${failed.join(', ')}` : ''}${owner}`);
  return 0;
}

/** `chronos owner`: show the keystore, or save your owner key encrypted (hidden key, passphrase twice) */
async function ownerCmd(d) {
  const KS = require('../lib/keystore.cjs'); const a = KS.ownerAddress(d.dataDir);
  if (a && d.sub !== 'save') { d.log(`Owner keystore: ${a} (encrypted; deploy and payouts ask for its passphrase). To replace it: chronos owner save`); return 0; }
  const key = await d.P.secret('Owner wallet private key to keep encrypted', 'hidden · never written in plaintext'); if (!key) { d.log('Cancelled.'); return 1; }
  const p1 = await d.P.secret(`New passphrase (at least ${KS.MIN_PASS} characters; a few words is best)`, 'hidden'); const p2 = p1 ? await d.P.secret('Same passphrase again', 'hidden') : null;
  if (!p1 || p1 !== p2) { d.log(p1 ? 'The two passphrases differ: nothing saved.' : 'Cancelled.'); return 1; }
  const bad = KS.passOk(p1); if (bad) { d.log('Not saved: ' + bad); return 1; }
  try { const addr = await KS.saveOwner(d.dataDir, key, p1); d.log(`✓ owner key kept encrypted for ${addr}${a ? ` (the previous keystore for ${a} was moved aside, not deleted)` : ''}`); return 0; } catch (e) { d.log('Not saved: ' + String(e.message).slice(0, 80)); return 1; }
}

module.exports = { runKeys, wssFromRpc, realDeps, ORDER, exportBundle, importBundle, ownerCmd, NEVER_PLAIN };
