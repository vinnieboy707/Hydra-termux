'use strict';
// The key agent (2.9.11): signs trades on this phone with your executor key, so the engine can trade 24/7 without a
// cloud key. How it keeps the key safe:
//   · the key is stored only in the standard encrypted keystore (data/keystore/executor.json, lib/keystore.cjs). You
//     type its passphrase once, at `chronos executor unlock`; the agent opens the keystore in memory and the
//     passphrase is dropped. Nothing is written in plaintext, nothing is sent anywhere.
//   · the agent is its own small process, apart from the engine. An engine restart (watchdog, PM2, an update) does
//     not lock it; a phone restart does (the engine then holds trading and tells you: chronos executor unlock).
//   · it answers only on a socket file in data/keystore (folder 700, socket 600: only your Termux user can reach it),
//     and it signs only what a trade needs: chain 42161, to YOUR contract (fixed when you unlock), no ETH attached,
//     the contract's execute() and nothing else, at most 0.05 ETH of worst-case gas each, at most 30 a minute. A
//     transfer, an approval, a message signature or a call to any other address is refused, even from the engine.
//   · every signature is logged (data/keystore/agent.log: time, hash; no key material).
// The engine talks to it through AgentSigner (an ethers signer, used exactly like the KMS signer).
const fs = require('fs');
const net = require('net');
const path = require('path');
const { ethers } = require('ethers');

const CHAIN_ID = 42161n;
// Arbitrum's own per-transaction gas limit (its gas limit also carries the L1 data cost, which spikes with L1 fees, so a
// lower number could refuse a profitable trade). The fee cap below is what bounds the money.
const DEFAULT_MAX_GAS = 32_000_000n;
// gas limit × max fee, the most one signature could ever cost (Arbitrum charges the base fee, so the real cost is far
// lower; the executor's own ETH balance is the hard bound). Set CHRONOS_AGENT_MAX_TX_ETH to change it.
const DEFAULT_MAX_TX_WEI = ethers.parseEther('0.05');
const MAX_PER_MIN = 30;
const LOCKED = 'executor key is locked (the key agent is not running on this phone): run chronos executor unlock';

const sockOf = (dataDir) => path.join(dataDir, 'keystore', 'agent.sock');
const logOf = (dataDir) => path.join(dataDir, 'keystore', 'agent.log');

/** the selectors the agent will sign: the execute() of contract v1 and v2, read from their ABIs */
function executeSelectors() {
  const SH = require('./shadow.cjs');
  return new Set([SH.IFACE.getFunction('execute').selector, SH.IFACE2.getFunction('execute').selector]);
}

/** the signing policy; → null when the transaction may be signed, else why not */
function refuse(tx, { contract, selectors, maxGas = DEFAULT_MAX_GAS, maxTxWei = DEFAULT_MAX_TX_WEI }) {
  if (BigInt(tx.chainId || 0) !== CHAIN_ID) return `chain ${tx.chainId} is not Arbitrum One`;
  if (!tx.to || tx.to.toLowerCase() !== contract.toLowerCase()) return `only your contract ${contract} is signed for, not ${tx.to || 'a deployment'}`;
  if (BigInt(tx.value || 0) !== 0n) return 'a trade never carries ETH';
  if (tx.type !== 2) return 'only type-2 (EIP-1559) transactions are signed';
  const sel = String(tx.data || '0x').slice(0, 10).toLowerCase();
  if (!selectors.has(sel)) return `only the contract's execute() is signed (got ${sel})`;
  const gas = BigInt(tx.gasLimit || 0), fee = BigInt(tx.maxFeePerGas || 0);
  if (gas <= 0n || gas > maxGas) return `gas limit ${gas} is outside 1…${maxGas}`;
  if (gas * fee > maxTxWei) return `worst-case gas ${ethers.formatEther(gas * fee)} ETH is over the ${ethers.formatEther(maxTxWei)} ETH cap per trade`;
  return null;
}

/** runs the agent in this process (the detached child of `chronos executor unlock`). → { close, address, ready } */
function serve({ dataDir, wallet, contract, maxGas, maxTxWei, log = () => {} }) {
  if (!ethers.isAddress(contract || '')) throw new Error('no contract address: set CHRONOS_FLASH_ARB_ADDRESS first');
  const selectors = executeSelectors();
  const sock = sockOf(dataDir); const dir = path.dirname(sock);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700);
  if (fs.existsSync(sock)) fs.unlinkSync(sock); // a socket left by an agent that is gone (checked by the caller): not a user file
  const recent = []; let signed = 0; const started = Date.now();
  const answer = async (req) => {
    if (req.op === 'address') return { address: wallet.address };
    if (req.op === 'status') return { address: wallet.address, contract: ethers.getAddress(contract), signed, upSec: Math.round((Date.now() - started) / 1000), maxTxEth: ethers.formatEther(maxTxWei || DEFAULT_MAX_TX_WEI) };
    if (req.op === 'stop') { setImmediate(() => close()); return { stopped: true }; }
    if (req.op !== 'sign') return { error: 'unknown request' };
    let tx; try { tx = ethers.Transaction.from(req.unsigned); } catch (_) { return { error: 'not an unsigned transaction' }; }
    if (tx.signature) return { error: 'already signed' };
    const why = refuse(tx, { contract, selectors, maxGas, maxTxWei });
    if (why) { log(`refused: ${why}`); return { error: 'refused by the key agent: ' + why }; }
    const now = Date.now(); while (recent.length && now - recent[0] > 60000) recent.shift();
    if (recent.length >= MAX_PER_MIN) return { error: `refused by the key agent: more than ${MAX_PER_MIN} signatures in a minute` };
    recent.push(now);
    const raw = await wallet.signTransaction(tx);
    signed++;
    try { fs.appendFileSync(logOf(dataDir), JSON.stringify({ at: new Date().toISOString(), hash: ethers.keccak256(raw), nonce: tx.nonce }) + '\n', { mode: 0o600 }); } catch (_) { /* the log never blocks a trade */ }
    return { raw };
  };
  const server = net.createServer((c) => {
    let buf = '';
    c.setTimeout(10000, () => c.destroy());
    c.on('error', () => {});
    c.on('data', (d) => {
      buf += d; if (buf.length > 200000) return c.destroy();
      const i = buf.indexOf('\n'); if (i < 0) return;
      let req; try { req = JSON.parse(buf.slice(0, i)); } catch (_) { req = {}; }
      answer(req).then((r) => c.end(JSON.stringify(r) + '\n'), (e) => c.end(JSON.stringify({ error: String(e.message || e).slice(0, 200) }) + '\n'));
    });
  });
  const old = process.umask(0o177); // the socket is created 600
  const ready = new Promise((res, rej) => { server.once('error', rej); server.listen(sock, () => { process.umask(old); try { fs.chmodSync(sock, 0o600); } catch (_) {} res(); }); });
  function close() { try { server.close(); } catch (_) {} try { fs.unlinkSync(sock); } catch (_) {} }
  return { ready, close, address: wallet.address, sock };
}

/** one request to the agent; throws LOCKED when it is not running */
function call(dataDir, req, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const c = net.createConnection(sockOf(dataDir)); let buf = ''; let done = false;
    const fin = (f, v) => { if (done) return; done = true; clearTimeout(t); c.destroy(); f(v); };
    const t = setTimeout(() => fin(reject, new Error('the key agent did not answer within ' + timeoutMs / 1000 + ' s')), timeoutMs);
    c.on('connect', () => c.write(JSON.stringify(req) + '\n'));
    c.on('data', (d) => { buf += d; const i = buf.indexOf('\n'); if (i < 0) return; let r; try { r = JSON.parse(buf.slice(0, i)); } catch (_) { return fin(reject, new Error('the key agent sent an unreadable answer')); } if (r.error) fin(reject, new Error(r.error)); else fin(resolve, r); });
    c.on('error', (e) => fin(reject, ['ENOENT', 'ECONNREFUSED'].includes(e.code) ? new Error(LOCKED) : e));
    c.on('end', () => fin(reject, new Error('the key agent closed without answering')));
  });
}

/** is an agent answering here? → its status, or null */
async function status(dataDir) { try { return await call(dataDir, { op: 'status' }, 3000); } catch (_) { return null; } }

/** the engine's signer: everything goes through the agent; the key is never in the engine's memory */
class AgentSigner extends ethers.AbstractSigner {
  /** opts.call: tests only (an agent that lies, to prove the engine checks every signature it gets back) */
  constructor(dataDir, provider = null, opts = {}) { super(provider); this.dataDir = dataDir; this.opts = opts; this._call = opts.call || call; }
  connect(provider) { return new AgentSigner(this.dataDir, provider, this.opts); }
  // asked every time (a local socket, about a millisecond): a locked agent is noticed at once, never hidden by a cache
  async getAddress() { return ethers.getAddress((await this._call(this.dataDir, { op: 'address' })).address); }
  async signTransaction(txReq) {
    const from = await this.getAddress();
    const t = ethers.Transaction.from({ ...txReq, from: undefined });
    const { raw } = await this._call(this.dataDir, { op: 'sign', unsigned: t.unsignedSerialized });
    const s = ethers.Transaction.from(raw);
    if (!s.from || s.from.toLowerCase() !== from.toLowerCase()) throw new Error('the key agent signed as another account');
    if (s.unsignedHash !== t.unsignedHash) throw new Error('the key agent signed a different transaction than the one Chronos prepared');
    return raw;
  }
  async signMessage() { throw new Error('the executor key signs trades only'); }
  async signTypedData() { throw new Error('the executor key signs trades only'); }
}

/** start a detached agent: passphrase handed over a pipe (never argv or env). → { ok, address } or { ok:false, why } */
function start({ dataDir, contract, passphrase, maxTxEth = null, timeoutMs = 120000 }) {
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [__filename, 'serve', dataDir, contract, String(maxTxEth || '')], { detached: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = ''; let done = false;
    const fin = (r) => { if (done) return; done = true; clearTimeout(t); try { child.stdout.destroy(); } catch (_) {} child.unref(); resolve(r); };
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} fin({ ok: false, why: 'the key agent did not start within ' + timeoutMs / 1000 + ' s' }); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; const i = out.indexOf('\n'); if (i < 0) return; const line = out.slice(0, i); if (line.startsWith('READY ')) fin({ ok: true, address: line.slice(6).trim(), pid: child.pid }); else fin({ ok: false, why: line.replace(/^ERR /, '') }); });
    child.on('exit', (code) => fin({ ok: false, why: `the key agent stopped (exit ${code})` }));
    child.stdin.on('error', () => {});
    child.stdin.end(passphrase + '\n');
  });
}

// ── the agent process itself ──────────────────────────────────────────────────────────────────────────────────────
async function main(dataDir, contract, maxTxEth) {
  process.title = 'chronos-keyagent';
  process.on('SIGHUP', () => {}); // a closed terminal never locks it
  process.stdout.on('error', () => {});
  const say = (s) => { try { process.stdout.write(s + '\n'); } catch (_) {} };
  let pass = '';
  for await (const chunk of process.stdin) { pass += chunk; if (pass.includes('\n')) break; }
  pass = pass.split('\n')[0];
  try {
    if (await status(dataDir)) { say('ERR a key agent is already running here (chronos executor status)'); process.exit(1); }
    const KS = require('./keystore.cjs');
    let wallet; try { wallet = await KS.unlockKey(dataDir, 'executor', pass); } catch (_) { say('ERR that passphrase does not open the executor keystore'); process.exit(1); }
    pass = null;
    const cap = /^(0?\.\d+|\d+(\.\d+)?)$/.test(maxTxEth || '') ? ethers.parseEther(maxTxEth) : DEFAULT_MAX_TX_WEI;
    const a = serve({ dataDir, wallet, contract, maxTxWei: cap, log: () => {} });
    await a.ready;
    say('READY ' + wallet.address);
    process.stdout.end();
    const bye = () => { a.close(); process.exit(0); };
    process.on('SIGTERM', bye); process.on('SIGINT', bye);
  } catch (e) { say('ERR ' + String(e.message || e).slice(0, 200)); process.exit(1); }
}

if (require.main === module && process.argv[2] === 'serve') main(process.argv[3], process.argv[4], process.argv[5]);

module.exports = { serve, call, status, start, refuse, executeSelectors, AgentSigner, sockOf, logOf, LOCKED, DEFAULT_MAX_TX_WEI, DEFAULT_MAX_GAS, MAX_PER_MIN };
