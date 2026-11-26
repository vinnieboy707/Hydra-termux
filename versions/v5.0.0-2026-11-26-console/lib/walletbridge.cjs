'use strict';
// MetaMask (or any browser wallet) as your owner wallet, without your private key ever leaving the wallet.
//   · A small page is served on THIS machine only (127.0.0.1), behind a one-time secret link printed in your terminal.
//   · You open it in the browser that has MetaMask; it connects, switches MetaMask to Arbitrum One, and shows each
//     transaction Chronos prepared (title, why, gas limit). You approve or reject each one in MetaMask itself.
//   · Chronos waits for each one on chain from its receipt before preparing the next (exactly as with your keystore).
// MetaMaskSigner is an ethers signer backed by that page, so deploy, setup, payouts and owner settings use MetaMask
// with no other change. The page has no outside scripts; requests must carry the secret and come from the page itself
// (Origin checked), so no other website you visit can use the bridge. Nothing is ever signed without your MetaMask click.
const http = require('http');
const crypto = require('crypto');
const { ethers } = require('ethers');

const ARBITRUM = { chainId: 42161, hex: '0xa4b1', name: 'Arbitrum One', rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' };
const hex = (v) => (v === undefined || v === null ? undefined : '0x' + BigInt(v).toString(16));

const PAGE = (token, nonce) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'">
<title>Chronos · sign with MetaMask</title><style nonce="${nonce}">
body{font:15px/1.45 system-ui,sans-serif;margin:0;background:#0f1115;color:#e8e8ea}main{max-width:640px;margin:0 auto;padding:20px 16px}
h1{font-size:19px;margin:0 0 4px}.q{color:#9aa0a6}.card{background:#181b21;border:1px solid #2a2f38;border-radius:10px;padding:14px;margin:14px 0}
button{font:inherit;padding:10px 16px;border-radius:8px;border:0;background:#f6851b;color:#111;font-weight:600;cursor:pointer}button:disabled{opacity:.5;cursor:default}
code{font-size:12.5px;word-break:break-all}.ok{color:#6fcf97}.err{color:#ff7b72}li{margin:4px 0}</style></head><body><main>
<h1>Chronos · owner wallet</h1><div class="q">Every transaction is approved by you in MetaMask. Your key never leaves MetaMask.</div>
<div class="card" id="conn"><button id="go">Connect MetaMask</button> <span id="cs" class="q"></span></div>
<div class="card" id="step" hidden><div id="title" style="font-weight:600"></div><div id="why" class="q"></div><div id="meta" class="q" style="margin:6px 0"></div>
<button id="send">Approve in MetaMask</button> <span id="ss" class="q"></span></div>
<div class="card"><div class="q">Log</div><ul id="log"></ul></div></main>
<script nonce="${nonce}">
const T=${JSON.stringify(token)}, CH=${JSON.stringify(ARBITRUM)}; const $=(i)=>document.getElementById(i);
const log=(s,c)=>{const li=document.createElement('li');li.textContent=s;if(c)li.className=c;$('log').prepend(li);};
const post=(p,b)=>fetch('/'+T+'/'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});
let acct=null, cur=null;
async function chain(){const e=window.ethereum;try{await e.request({method:'wallet_switchEthereumChain',params:[{chainId:CH.hex}]});}
 catch(x){if(x&&x.code===4902){await e.request({method:'wallet_addEthereumChain',params:[{chainId:CH.hex,chainName:CH.name,nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:[CH.rpc],blockExplorerUrls:[CH.explorer]}]});}else throw x;}
 const id=await e.request({method:'eth_chainId'}); if(parseInt(id,16)!==CH.chainId) throw new Error('MetaMask is not on Arbitrum One');}
$('go').onclick=async()=>{const e=window.ethereum; if(!e){$('cs').textContent='No wallet in this browser. Open this link in the browser where MetaMask is installed.';$('cs').className='err';return;}
 $('go').disabled=true; try{const a=await e.request({method:'eth_requestAccounts'}); acct=a[0]; await chain();
 e.on&&e.on('accountsChanged',(x)=>{post('event',{kind:'accountsChanged',account:x[0]||null});log('Account changed in MetaMask: Chronos stops the remaining steps.','err');});
 e.on&&e.on('chainChanged',(x)=>{post('event',{kind:'chainChanged',chainId:parseInt(x,16)});});
 await post('hello',{account:acct,chainId:CH.chainId}); $('cs').textContent='Connected '+acct+' on Arbitrum One'; $('cs').className='ok'; log('Connected '+acct); poll();}
 catch(x){$('go').disabled=false;$('cs').textContent=(x&&x.message)||String(x);$('cs').className='err';}};
async function poll(){for(;;){let r; try{r=await (await fetch('/'+T+'/next')).json();}catch(_){await new Promise(z=>setTimeout(z,1500));continue;}
 if(r.done){$('step').hidden=true;log(r.message||'Finished. You can close this page.','ok');return;}
 if(!r.id||(cur&&cur.id===r.id)){await new Promise(z=>setTimeout(z,1000));continue;}
 cur=r; $('step').hidden=false; $('title').textContent=r.title; $('why').textContent=r.why||''; $('meta').textContent=(r.tx.to?'to '+r.tx.to:'new contract')+(r.tx.gas?' · gas limit '+parseInt(r.tx.gas,16):'')+(r.tx.value&&r.tx.value!=='0x0'?' · sends '+(Number(BigInt(r.tx.value))/1e18)+' ETH':''); $('ss').textContent=''; $('send').disabled=false;}}
$('send').onclick=async()=>{const r=cur; $('send').disabled=true; $('ss').textContent='Waiting for you in MetaMask…';
 try{await chain(); const h=await window.ethereum.request({method:'eth_sendTransaction',params:[Object.assign({from:acct},r.tx)]});
 await post('result',{id:r.id,hash:h}); $('ss').textContent='Sent '+h+' · Chronos is waiting for it on chain'; log(r.title+': sent '+h,'ok');}
 catch(x){await post('result',{id:r.id,error:(x&&x.code===4001)?'rejected':((x&&x.message)||String(x))}); $('ss').textContent=(x&&x.code===4001)?'You rejected it: nothing was sent.':'Error: '+((x&&x.message)||x); log(r.title+': not sent','err');}};
</script></body></html>`;

/**
 * Start the bridge. → { url, ready (Promise → { account }), request(step) → Promise<hash>, close(), status() }
 * step = { title, why, tx: { to?, data?, value?, gasLimit? } }. Rejected in MetaMask → Error('rejected in MetaMask').
 */
function startBridge({ host = '127.0.0.1', port = 0, log = () => {}, timeoutMs = 15 * 60000 } = {}) {
  const token = crypto.randomBytes(18).toString('hex'); const nonce = crypto.randomBytes(12).toString('base64');
  let account = null, chainId = null, origin = null, readyRes, readyRej, current = null, finished = null, closed = false;
  const ready = new Promise((res, rej) => { readyRes = res; readyRej = rej; });
  const pending = new Map(); let seq = 0;
  const body = (req) => new Promise((res) => { let s = ''; req.on('data', (d) => { s += d; if (s.length > 16384) req.destroy(); }); req.on('end', () => { try { res(JSON.parse(s || '{}')); } catch (_) { res(null); } }); });
  const send = (res, code, type, data) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }); res.end(data); };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] !== token) return send(res, 404, 'text/plain', 'not found'); // no secret, no bridge
    const p = parts[1] || '';
    if (req.method === 'POST') {
      // only the page itself may post: same origin as the bridge (a website you visit cannot)
      const o = req.headers.origin; if (!o || o !== origin) return send(res, 403, 'text/plain', 'forbidden');
      const b = await body(req); if (!b) return send(res, 400, 'text/plain', 'bad request');
      if (p === 'hello') {
        if (account) return send(res, 409, 'text/plain', 'already connected');
        if (!ethers.isAddress(b.account) || Number(b.chainId) !== ARBITRUM.chainId) return send(res, 400, 'text/plain', 'not Arbitrum One');
        account = ethers.getAddress(b.account); chainId = Number(b.chainId); log(`  ✓ MetaMask connected: ${account} on Arbitrum One`); readyRes({ account });
        return send(res, 200, 'application/json', '{}');
      }
      if (p === 'result') {
        const w = pending.get(b.id); if (!w) return send(res, 404, 'text/plain', 'no such step');
        pending.delete(b.id); current = null;
        if (b.hash && /^0x[0-9a-fA-F]{64}$/.test(b.hash)) w.res(b.hash.toLowerCase());
        else w.rej(new Error(b.error === 'rejected' ? 'rejected in MetaMask: nothing was sent' : `MetaMask did not send it: ${String(b.error || 'unknown').slice(0, 200)}`));
        return send(res, 200, 'application/json', '{}');
      }
      if (p === 'event') { // the wallet changed account or network mid-way: every step still waiting is refused
        const why = b.kind === 'accountsChanged' ? 'the MetaMask account changed' : 'MetaMask left Arbitrum One';
        if (b.kind === 'accountsChanged' || Number(b.chainId) !== ARBITRUM.chainId) { for (const [, w] of pending) w.rej(new Error(`${why}: stopped, nothing more is sent`)); pending.clear(); current = null; finished = `${why}: Chronos stopped`; }
        return send(res, 200, 'application/json', '{}');
      }
      return send(res, 404, 'text/plain', 'not found');
    }
    if (p === '') return send(res, 200, 'text/html; charset=utf-8', PAGE(token, nonce));
    if (p === 'next') {
      if (finished) return send(res, 200, 'application/json', JSON.stringify({ done: true, message: finished }));
      return send(res, 200, 'application/json', JSON.stringify(current ? { id: current.id, title: current.title, why: current.why, tx: current.tx } : {}));
    }
    return send(res, 404, 'text/plain', 'not found');
  });
  const listening = new Promise((res) => server.listen(port, host, () => { const a = server.address(); origin = `http://${host}:${a.port}`; res(); }));
  server.unref();
  const timer = setTimeout(() => { if (!account) readyRej(new Error('MetaMask did not connect within 15 minutes: nothing was sent')); }, timeoutMs); timer.unref();
  return {
    listening,
    get url() { return `${origin}/${token}/`; },
    ready,
    /** hand one transaction to the page; resolves with its hash once you approve it in MetaMask */
    request(step) {
      if (closed || finished) return Promise.reject(new Error(finished || 'the MetaMask page is closed: nothing was sent'));
      if (current) return Promise.reject(new Error('one transaction at a time'));
      const id = String(++seq);
      const tx = { ...(step.tx.to ? { to: ethers.getAddress(step.tx.to) } : {}), ...(step.tx.data ? { data: step.tx.data } : {}), value: hex(step.tx.value || 0n), ...(step.tx.gasLimit ? { gas: hex(step.tx.gasLimit) } : {}) };
      current = { id, title: step.title || 'Transaction', why: step.why || '', tx };
      return new Promise((res, rej) => {
        const t = setTimeout(() => { if (pending.has(id)) { pending.delete(id); current = null; rej(new Error('no answer from MetaMask within 15 minutes: nothing was sent')); } }, timeoutMs); t.unref();
        pending.set(id, { res: (h) => { clearTimeout(t); res(h); }, rej: (e) => { clearTimeout(t); rej(e); } });
      });
    },
    finish(message) { finished = message || 'Finished. You can close this page.'; },
    close() { closed = true; finished = finished || 'Closed.'; for (const [, w] of pending) w.rej(new Error('closed: nothing more is sent')); pending.clear(); clearTimeout(timer); server.close(); },
    status() { return { account, chainId, waiting: !!current }; },
  };
}

/** an ethers signer whose every transaction is approved by you in MetaMask through the bridge */
class MetaMaskSigner extends ethers.AbstractSigner {
  constructor(bridge, provider, account) { super(provider); this.bridge = bridge; this.account = account; this.titles = []; }
  connect(provider) { return new MetaMaskSigner(this.bridge, provider, this.account); }
  async getAddress() { return this.account; }
  /** the next transaction's title and reason on the page (what you are approving and why) */
  label(title, why) { this.titles.push({ title, why }); return this; }
  async sendTransaction(tx) {
    const t = await ethers.resolveProperties(tx);
    if (t.from && ethers.getAddress(t.from) !== this.account) throw new Error('transaction is from another account');
    const lab = this.titles.shift() || { title: t.to ? `Call ${t.to}` : 'Deploy your contract', why: '' };
    // the nonce and fee are MetaMask's (it shows them to you); Chronos passes the destination, data, value and gas limit
    const hash = await this.bridge.request({ ...lab, tx: { to: t.to || undefined, data: t.data || undefined, value: t.value || 0n, gasLimit: t.gasLimit || undefined } });
    for (let i = 0; i < 120; i++) { // MetaMask sends through its own node: wait until ours sees it
      const r = await this.provider.getTransaction(hash).catch(() => null);
      if (r) {
        if (ethers.getAddress(r.from) !== this.account) throw new Error(`${hash} was sent from ${r.from}, not ${this.account}`);
        const want = t.to ? ethers.getAddress(t.to) : null, got = r.to ? ethers.getAddress(r.to) : null; // null = a deployment
        if (want !== got) throw new Error(`${hash} went to ${got || 'a new contract'}, not ${want || 'a new contract'}`);
        if (t.data && r.data && r.data.toLowerCase() !== String(t.data).toLowerCase()) throw new Error(`${hash} carries different data than Chronos prepared`);
        return r;
      }
      await new Promise((z) => setTimeout(z, 1000));
    }
    throw new Error(`${hash} was approved in MetaMask but your node has not seen it after 2 minutes; check it on arbiscan.io before trying again`);
  }
  async signTransaction() { throw new Error('MetaMask sends transactions itself; Chronos never holds a signed transaction'); }
  async signMessage() { throw new Error('not used'); }
  async signTypedData() { throw new Error('not used'); }
}

/** open the link in the default browser where possible (desktop xdg-open/open, Termux termux-open-url); else print it */
function openBrowser(url) {
  const { spawn } = require('child_process');
  const cmd = process.env.TERMUX_VERSION ? 'termux-open-url' : process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { const c = spawn(cmd, args, { stdio: 'ignore', detached: true }); c.on('error', () => {}); c.unref(); return true; } catch (_) { return false; }
}

module.exports = { startBridge, MetaMaskSigner, openBrowser, ARBITRUM };
