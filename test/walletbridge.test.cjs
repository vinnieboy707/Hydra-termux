'use strict';
// MetaMask signing (lib/walletbridge.cjs): the real page, driven in a real browser (Chromium) where available, with a
// stand-in wallet (window.ethereum, EIP-1193) that sends through a local chain set to Arbitrum One's chain id. The
// real counterpart is MetaMask itself on your device; your deployed contract's owner is then checked on the real chain
// (verify-real: contract-deployed).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const ganache = require('ganache');
const B = require('../lib/walletbridge.cjs');
const D = require('../lib/deploy.cjs');

let chromium = null; try { ({ chromium } = require('playwright')); } catch (_) { chromium = null; }

async function chain() {
  const g = ganache.provider({ logging: { quiet: true }, chain: { chainId: 42161, hardfork: 'shanghai' }, miner: { blockGasLimit: '0x3B9ACA00' }, wallet: { deterministic: true, totalAccounts: 3, defaultBalance: 1000 } });
  const provider = new ethers.BrowserProvider(g, { chainId: 42161, name: 'arbitrum' });
  const accounts = await provider.send('eth_accounts', []);
  return { g, provider, account: ethers.getAddress(accounts[0]) };
}

// the stand-in wallet in the page: forwards the requests a dapp makes to MetaMask to the local chain (via the test)
const SHIM = `window.ethereum = { isMetaMask: true, _h: {}, on(e, f) { this._h[e] = f; },
  async request({ method, params }) {
    if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
    if (method === 'eth_chainId') return '0xa4b1';
    const r = await window.__wallet(method, params || []);
    if (r && r.error) { const e = new Error(r.error.message); e.code = r.error.code; throw e; }
    return r.result; } };`;

async function withPage(fn) {
  const { g, provider, account } = await chain();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let reject = false; const sent = [];
  await page.exposeFunction('__wallet', async (method, params) => {
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return { result: [account.toLowerCase()] };
    if (method === 'eth_sendTransaction') {
      if (reject) return { error: { code: 4001, message: 'User rejected the request.' } };
      const tx = params[0]; sent.push(tx);
      return { result: await g.request({ method: 'eth_sendTransaction', params: [{ ...tx, from: account }] }) };
    }
    return { error: { code: -32601, message: 'unsupported ' + method } };
  });
  await page.addInitScript(SHIM);
  try { await fn({ page, provider, account, sent, setReject: (v) => { reject = v; } }); } finally { await browser.close(); }
}

test('MetaMask signing: the real page deploys contract v2.3 and sends a setup step; the account that approved owns it', { skip: chromium ? false : 'Playwright is not installed here (the protocol test below still runs)' }, async () => {
  await withPage(async ({ page, provider, account, sent }) => {
    const bridge = B.startBridge({ log: () => {} }); await bridge.listening;
    await page.goto(bridge.url);
    await page.click('#go');
    const { account: got } = await bridge.ready;
    assert.strictEqual(got, account, 'the account MetaMask connected');
    const signer = new B.MetaMaskSigner(bridge, provider, got);
    // the deploy, exactly as chronos deploy does it (same constructor arguments, a label shown on the page)
    const art = D.loadArtifact(D.ARTIFACT_V2);
    const aave = '0x794a61358D6845594F94dc1DB02A252b5b4814aD', vault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
    const clicker = (async () => { for (let i = 0; i < 2; i++) { await page.waitForSelector('#step:not([hidden]) #send:not([disabled])', { timeout: 20000 }); await page.click('#send'); await page.waitForFunction(() => /Sent 0x/.test(document.getElementById('ss').textContent), null, { timeout: 20000 }); } })();
    const d = await D.deployContract(signer, art, aave, 8_000_000n, () => {}, vault, null, null);
    assert.ok(ethers.isAddress(d.address));
    assert.strictEqual(await page.textContent('#title'), 'Deploy ChronosFlashArbV2', 'the page told you what you approved');
    const arb = new ethers.Contract(d.address, art.abi, provider);
    assert.strictEqual(await arb.owner(), account, 'the MetaMask account owns the contract');
    // a setup step through the same page (setRouter), labelled
    const router = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
    const done = await D.sendAll(signer, [{ id: 'router:uni', title: `setRouter(${router}, true)`, why: 'uniswap_v3 router', tx: D.txFor({ fn: 'setRouter', args: [router, true] }, d.address) }], [200000n], () => {});
    await clicker;
    assert.strictEqual(done.length, 1); assert.strictEqual(await arb.allowedRouters(router), true, 'the setup step is on chain');
    assert.strictEqual(sent.length, 2); assert.ok(!sent[0].to, 'the first was a deployment'); assert.ok(sent[0].gas, 'the gas limit Chronos priced was passed to MetaMask');
    bridge.finish('Done'); await page.waitForFunction(() => /Done/.test(document.getElementById('log').textContent), null, { timeout: 10000 });
    bridge.close();
  });
});

test('MetaMask signing: a rejection in MetaMask sends nothing and stops the run', { skip: chromium ? false : 'Playwright is not installed here (the protocol test below still runs)' }, async () => {
  await withPage(async ({ page, provider, account, sent, setReject }) => {
    const bridge = B.startBridge({ log: () => {} }); await bridge.listening;
    await page.goto(bridge.url); await page.click('#go'); await bridge.ready;
    setReject(true);
    const signer = new B.MetaMaskSigner(bridge, provider, account);
    const p = signer.sendTransaction({ to: account, value: 1n }).then(() => null, (e) => e); // caught at once: the rejection is the expected answer
    await page.waitForSelector('#step:not([hidden]) #send:not([disabled])', { timeout: 20000 }); await page.click('#send');
    const err = await p; assert.ok(err instanceof Error); assert.match(err.message, /rejected in MetaMask: nothing was sent/);
    assert.strictEqual(sent.length, 0);
    bridge.close();
  });
});

test('the bridge refuses every request without its secret link, and every post that does not come from its own page', async () => {
  const bridge = B.startBridge({ log: () => {} }); await bridge.listening;
  const base = new URL(bridge.url); const root = `${base.protocol}//${base.host}`;
  assert.strictEqual((await fetch(root + '/')).status, 404, 'no secret: nothing is served');
  assert.strictEqual((await fetch(root + '/' + 'a'.repeat(36) + '/next')).status, 404, 'a guessed secret: nothing');
  const page = await fetch(bridge.url); assert.strictEqual(page.status, 200);
  const html = await page.text(); assert.match(html, /Content-Security-Policy/); assert.ok(!/<script src=/.test(html), 'no outside scripts');
  const hello = (origin) => fetch(bridge.url + 'hello', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify({ account: '0x' + '11'.repeat(20), chainId: 42161 }) });
  assert.strictEqual((await hello('https://evil.example')).status, 403, 'another website cannot connect a wallet');
  assert.strictEqual((await hello(null)).status, 403, 'a post without an origin is refused');
  const wrongChain = await fetch(bridge.url + 'hello', { method: 'POST', headers: { 'content-type': 'application/json', origin: root }, body: JSON.stringify({ account: '0x' + '11'.repeat(20), chainId: 1 }) });
  assert.strictEqual(wrongChain.status, 400, 'a wallet on another chain is refused');
  // the protocol, as the page speaks it: connect, receive a step, answer with a hash
  assert.strictEqual((await hello(root)).status, 200);
  assert.strictEqual((await bridge.ready).account, ethers.getAddress('0x' + '11'.repeat(20)));
  const p = bridge.request({ title: 'Test step', why: 'why', tx: { to: '0x' + '22'.repeat(20), data: '0x1234', value: 0n, gasLimit: 50000n } });
  const next = await (await fetch(bridge.url + 'next')).json();
  assert.strictEqual(next.title, 'Test step'); assert.strictEqual(next.tx.gas, '0xc350'); assert.strictEqual(next.tx.data, '0x1234');
  await fetch(bridge.url + 'result', { method: 'POST', headers: { 'content-type': 'application/json', origin: root }, body: JSON.stringify({ id: next.id, hash: '0x' + 'ab'.repeat(32) }) });
  assert.strictEqual(await p, '0x' + 'ab'.repeat(32));
  // the wallet switches account mid-run: whatever is waiting is refused
  const q = bridge.request({ title: 'Second', tx: { to: '0x' + '22'.repeat(20) } }).then(() => { throw new Error('should have been refused'); }, (e) => { throw e; });
  q.catch(() => {}); // handled below
  await fetch(bridge.url + 'event', { method: 'POST', headers: { 'content-type': 'application/json', origin: root }, body: JSON.stringify({ kind: 'accountsChanged', account: '0x' + '33'.repeat(20) }) });
  await assert.rejects(q, /account changed/);
  bridge.close();
});

test('the MetaMask signer refuses a transaction that differs from the one Chronos prepared', async () => {
  const account = ethers.getAddress('0x' + '11'.repeat(20)); const to = '0x' + '22'.repeat(20);
  const fakeBridge = { request: async () => '0x' + 'cd'.repeat(32) };
  const provider = { getTransaction: async () => ({ from: account, to: '0x' + '99'.repeat(20), data: '0x' }) };
  const s = new B.MetaMaskSigner(fakeBridge, provider, account);
  await assert.rejects(s.sendTransaction({ to, data: '0x' }), /went to/);
  const p2 = { getTransaction: async () => ({ from: '0x' + '44'.repeat(20), to, data: '0x' }) };
  const s2 = new B.MetaMaskSigner(fakeBridge, p2, account);
  await assert.rejects(s2.sendTransaction({ to, data: '0x' }), /was sent from/);
});
