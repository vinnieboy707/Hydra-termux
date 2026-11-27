'use strict';
// The owner wallet for an action you start (deploy, venue settings, operator, payouts): MetaMask when you ask for it
// (--metamask, or CHRONOS_OWNER_SIGNER=metamask: you approve every transaction in MetaMask; the key never leaves it,
// lib/walletbridge.cjs), else your encrypted keystore (passphrase, three tries), else a key you keep in .env, else
// typed hidden for this run only. Never written in
// plaintext, never printed; after a typed key, it offers to keep it encrypted so you are not asked again.
const KS = require('../lib/keystore.cjs');

/** → { wallet, from } or null (cancelled / not valid). d: { P, get, provider, dataDir, log, signingKeys, offerSave } */
async function ownerWallet(d) {
  const { ethers } = require('ethers'); const { P, get, provider, dataDir, log } = d;
  if (d.metamask || String(get('CHRONOS_OWNER_SIGNER') || '').toLowerCase() === 'metamask') {
    const B = require('../lib/walletbridge.cjs'); const bridge = B.startBridge({ log }); await bridge.listening;
    if (process.env.TERMUX_VERSION) {
      // on a phone the browser with MetaMask is MetaMask's own (Chrome has no MetaMask): copy the link into it
      try { require('child_process').spawnSync('termux-clipboard-set', [bridge.url], { stdio: 'ignore', timeout: 3000 }); } catch (_) { /* Termux:API not installed: the link is printed */ }
      log(`\nIn the MetaMask app: open its Browser tab and go to this link (copied to your clipboard if Termux:API is installed; it works only on this phone and only this run):\n  ${bridge.url}\nConnect, and approve each transaction in MetaMask. Waiting for MetaMask…`);
    } else {
      log(`\nOpen this link in the browser where MetaMask is installed, on THIS computer (it works only here and only this run):\n  ${bridge.url}\nConnect, and approve each transaction in MetaMask. Waiting for MetaMask…`);
      B.openBrowser(bridge.url);
    }
    let account; try { ({ account } = await bridge.ready); } catch (e) { log(e.message); bridge.close(); return null; }
    return { wallet: new B.MetaMaskSigner(bridge, provider, account), from: 'metamask', bridge };
  }
  const addr = KS.ownerAddress(dataDir);
  if (addr) {
    for (let i = 0; i < 3; i++) {
      const pass = await P.secret(`Passphrase for your owner keystore (${addr.slice(0, 6)}…${addr.slice(-4)})`, 'hidden · the key stays encrypted on this device');
      if (!pass) { log('Cancelled.'); return null; }
      try { return { wallet: await KS.unlockOwner(dataDir, pass, provider), from: 'keystore' }; } catch (_) { log('That passphrase does not open the keystore.'); }
    }
    log('Three wrong passphrases: nothing was sent.'); return null;
  }
  for (const k of d.signingKeys) { const x = get(k); if (x) { try { return { wallet: new ethers.Wallet(x.startsWith('0x') ? x : '0x' + x, provider), from: k }; } catch (_) { log(`${k} in your .env is not a valid private key.`); return null; } } }
  let key = await P.secret('Owner wallet private key (hidden; used for this run only)', d.hint || 'the wallet that owns the contract');
  if (!key) { log('Cancelled.'); return null; }
  let wallet; try { wallet = new ethers.Wallet(key.startsWith('0x') ? key : '0x' + key, provider); } catch (_) { log('That is not a valid private key. Nothing was sent.'); return null; }
  if (d.offerSave !== false && P.confirm && (await P.confirm('Keep this key encrypted on this device so next time you only type a passphrase?'))) {
    const p1 = await P.secret(`New passphrase (at least ${KS.MIN_PASS} characters; a few words is best)`, 'hidden');
    const p2 = p1 ? await P.secret('Same passphrase again', 'hidden') : null;
    if (p1 && p1 === p2 && !KS.passOk(p1)) { const a = await KS.saveOwner(dataDir, key, p1); log(`  ✓ owner key kept encrypted (keystore for ${a}); next time: your passphrase`); }
    else log('  not kept: ' + (p1 !== p2 ? 'the two passphrases differ' : KS.passOk(p1 || '') || 'cancelled'));
  }
  key = null;
  return { wallet, from: 'typed' };
}

module.exports = { ownerWallet };
