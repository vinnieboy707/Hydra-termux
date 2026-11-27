'use strict';
// The real counterpart of every stand-in in the test suite. The tests use local stand-ins (a local chain, test
// contracts, fake KMS / sync / notification / webhook endpoints) so they can prove failure handling that the real
// systems cannot be made to produce on demand. Each stand-in is listed in test/counterparts.json with the check below
// that exercises the SAME behaviour against the real system, and `chronos verify-real` runs them all. A check that
// cannot run here (nothing configured, or it belongs to the cloud engine) says so and is never counted as a pass.
// Read-only on chain: nothing is signed or sent. The only outward actions are a test notification on this phone, a
// signed "verify" event to your webhook, and a device status request to your release service.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { redact } = require('./safety.cjs');

const ROOT = path.join(__dirname, '..');
const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || '');
const PASS = 'pass', FAIL = 'fail', SKIP = 'not run';
// every table the portal page uses (portal/counterparts.json; its render test checks the two lists match)
const PORTAL_TABLES = ['agent_events', 'approvals', 'balances_verified', 'chain_policies', 'chain_trades', 'competitors', 'devices', 'executions', 'heartbeats', 'mainnet_progress', 'opportunities', 'payouts', 'pool_moves', 'profit_gap', 'releases', 'reports', 'revenue_entries', 'route_insights', 'route_stats', 'shadow_runs', 'venue_usage'];
// the portal's public values (the page ships them; row-level security, not secrecy, protects the data)
const portalUrl = () => process.env.CHRONOS_PORTAL_SUPABASE_URL || 'https://qpjbikkfkpzywyzanrgv.supabase.co';
const PORTAL_KEY = 'sb_publishable_nDPXYh455bf-U7Usq8OV8g_UTkgh1qp';
const portalKey = () => process.env.CHRONOS_PORTAL_PUBLISHABLE_KEY || PORTAL_KEY;

/** id → { title, run(ctx) → { status, detail } } */
const CHECKS = {
  'rpc-is-arbitrum': {
    title: 'your RPC is Arbitrum One and current',
    async run(x) {
      const p = await x.provider();
      const b = await p.getBlock('latest');
      const age = Math.round(Date.now() / 1000 - Number(b.timestamp));
      return age <= 120 ? { status: PASS, detail: `chain 42161 · block ${b.number} · ${age}s old` } : { status: FAIL, detail: `latest block is ${age}s old: the node is behind` };
    },
  },
  'backup-nodes': {
    title: 'every other Arbitrum node you set is Arbitrum One and current (failover and balance checks use them)',
    async run(x) {
      const keys = ['ARB_RPC_URL_2', 'ARB_RPC_URL_3', 'ARB_RPC_URL_4', 'ARB_RPC_URL_5', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL'].filter((k) => /^https?:\/\//.test(x.get(k) || ''));
      if (!keys.length) return { status: SKIP, detail: 'no backup node set: chronos set ARB_RPC_URL_2 (a different provider)' };
      const bad = [], good = [];
      for (const k of keys) {
        try {
          const p = new ethers.JsonRpcProvider(x.get(k), 42161, { staticNetwork: ethers.Network.from(42161) });
          const [id, b] = await Promise.all([p.send('eth_chainId', []), p.getBlock('latest')]); p.destroy();
          const age = Math.round(Date.now() / 1000 - Number(b.timestamp));
          if (BigInt(id) !== 42161n) bad.push(`${k}: chain ${BigInt(id)}, not Arbitrum One`); else if (age > 120) bad.push(`${k}: ${age}s behind`); else good.push(k);
        } catch (e) { bad.push(`${k}: ${redact(e.shortMessage || e.message).slice(0, 60)}`); }
      }
      return bad.length ? { status: FAIL, detail: bad.join('; ') } : { status: PASS, detail: `${good.join(', ')} answer as Arbitrum One` };
    },
  },
  'node-plans': {
    title: 'each node\'s provider and plan are known, it answers within its plan, and the scanning node is paced to fit it (lib/providers.cjs)',
    async run(x) {
      const PR = require('./providers.cjs');
      const nodes = PR.nodeEntries(x.get); if (!nodes.length) return { status: SKIP, detail: 'no https node set' };
      const out = [], bad = [];
      for (const n of nodes) {
        const f = PR.profile(n.url, x.get);
        try {
          // one JSON-RPC batch of 2 (inside every plan's cap) proves the provider accepts batches the way Chronos sends them
          const r = await fetch(n.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }, { jsonrpc: '2.0', id: 2, method: 'eth_blockNumber', params: [] }]), signal: AbortSignal.timeout(10000) });
          const txt = await r.text();
          if (r.status === 429 || PR.isLimitError(txt)) { bad.push(`${n.key} (${f.name}${f.plan ? ' ' + f.plan : ''}): at its plan limit now (${r.status})`); continue; }
          const j = JSON.parse(txt); const id = Array.isArray(j) ? j.find((y) => y.id === 1) : null;
          if (!id || BigInt(id.result) !== 42161n) { bad.push(`${n.key}: batch not answered as Arbitrum One`); continue; }
          out.push(`${n.key} ${f.name}${f.plan ? ' ' + f.plan : ''}`);
        } catch (e) { bad.push(`${n.key}: ${redact(e.message).slice(0, 50)}`); }
      }
      const prim = PR.rankForScanning(nodes, x.get)[0];
      const iv = PR.minScanInterval(prim.url, x.get, 236);
      const pace = iv ? ` · scanning node ${prim.key} is paced to one scan per ${iv} s or more (its plan)` : ` · scanning node ${prim.key} has no published limit`;
      return bad.length ? { status: FAIL, detail: bad.join('; ') + pace } : { status: PASS, detail: out.join(', ') + pace };
    },
  },
  'blockscout-witness': {
    title: 'an independent witness (Blockscout, else Etherscan with your key) sees the same chain as your node, and your contract',
    async run(x) {
      // 2.9.15: Blockscout indexes a few seconds behind the chain; a witness that lags is not your node's fault, so only
      // YOUR node falling behind fails (by more than 240 blocks, about a minute). When Blockscout does not answer (it
      // began asking for keys in 2026), Etherscan API V2 with your ETHERSCAN_API_KEY is the witness instead.
      const BS = require('./blockscout.cjs'); const base = BS.baseUrl(x.get); const p = await x.provider();
      const witnesses = [];
      if (base) { const bs = new BS.Blockscout(base, { fetchImpl: x.fetchImpl || fetch }); witnesses.push({ name: 'Blockscout', head: () => bs.head(), contract: async (c) => { const a = await bs.address(c); return a ? a.isContract : false; } }); }
      const ek = x.get('ETHERSCAN_API_KEY');
      if (ek) { const ES = new (require('./etherscan.cjs').Etherscan)(ek, { fetchImpl: x.fetchImpl || fetch }); witnesses.push({ name: 'Etherscan', head: () => ES.head(), contract: (c) => ES.isContract(c) }); }
      if (!witnesses.length) return { status: SKIP, detail: 'no witness: CHRONOS_BLOCKSCOUT_URL is off and no ETHERSCAN_API_KEY' };
      const tried = []; const mine = await p.getBlockNumber();
      for (const w of witnesses) {
        let head; try { head = await w.head(); } catch (e) { tried.push(`${w.name}: ${redact(e.message).slice(0, 60)}`); continue; }
        const behind = head - mine; const bad = [];
        if (behind > 240) bad.push(`your node is ${behind} blocks behind ${w.name}: it is stale (check it, or add another node)`);
        const c = x.get('CHRONOS_FLASH_ARB_ADDRESS'); let cd = '';
        if (/^0x[0-9a-fA-F]{40}$/.test(c || '')) { let isC = null; try { isC = await w.contract(c); } catch (_) { isC = null; } if (isC === false) bad.push(`${w.name} does not see a contract at ${c}`); else if (isC) cd = ' · your contract seen'; }
        const note = behind < -40 ? ` (${w.name} indexes ${-behind} blocks behind your node: normal)` : '';
        return bad.length ? { status: FAIL, detail: bad.join('; ') } : { status: PASS, detail: `${w.name} block ${head} · your node ${mine}${cd}${note}${tried.length ? ' · ' + tried.join(' · ') : ''}` };
      }
      return { status: FAIL, detail: `no witness answered: ${tried.join(' · ')}${ek ? '' : ' · fix: chronos set ETHERSCAN_API_KEY (a second witness)'}` };
    },
  },
  'multicall3': {
    title: 'Multicall3 answers on the real chain',
    async run(x) {
      const B = require('./batch.cjs'); const p = await x.provider();
      if (!(await B.multicallAvailable(p))) return { status: FAIL, detail: 'no code at Multicall3 ' + B.MULTICALL3 };
      const b = new B.Batcher(p, { blockTag: 'latest', multicall: true });
      const I = new ethers.Interface(['function decimals() view returns (uint8)']);
      const [u, w] = await Promise.all([b.call(USDC, I.encodeFunctionData('decimals')), b.call(WETH, I.encodeFunctionData('decimals'))]);
      const d = [u, w].map((r) => (r.ok ? Number(I.decodeFunctionResult('decimals', r.data)[0]) : null));
      return d[0] === 6 && d[1] === 18 ? { status: PASS, detail: 'batched reads: USDC 6 decimals, WETH 18' } : { status: FAIL, detail: `batched reads returned ${d.join('/')}` };
    },
  },
  'aave-reads': {
    title: 'real Aave V3: premium, flash-loanable reserves, oracle, liquidity',
    async run(x) {
      const C = require('./chain.cjs'); const p = await x.provider();
      const a = await C.readAave(p, C.limiter ? C.limiter(4) : null);
      const flash = a.assets.filter((s) => s.flashEnabled && s.price8 > 0n && s.available !== null);
      const usdc = a.assets.find((s) => s.address === USDC.toLowerCase());
      if (!usdc || usdc.decimals !== 6) return { status: FAIL, detail: 'USDC reserve not read correctly' };
      return flash.length ? { status: PASS, detail: `premium ${a.premiumBps} bps · ${flash.length} flash-loanable reserves priced and with liquidity` } : { status: FAIL, detail: 'no flash-loanable reserve read' };
    },
  },
  'venues-real': {
    title: 'every venue in venues.json is the real factory / quoter / router it claims',
    async run(x) {
      const C = require('./chain.cjs'); const p = await x.provider();
      const venues = JSON.parse(fs.readFileSync(process.env.CHRONOS_VENUES_FILE || path.join(ROOT, 'venues.json'), 'utf8'));
      const { report } = await C.validateVenues(p, venues, C.limiter ? C.limiter(4) : null);
      const bad = report.filter((r) => !r.ok);
      return bad.length ? { status: FAIL, detail: bad.map((r) => `${r.id}: ${r.why}`).join('; ') } : { status: PASS, detail: `${report.length} venues confirmed on chain (${report.filter((r) => r.executable).length} executable)` };
    },
  },
  'real-quote': {
    title: 'a real quote: 1000 USDC → WETH on Uniswap V3 0.05%',
    async run(x) {
      const C = require('./chain.cjs'); const p = await x.provider();
      const venues = JSON.parse(fs.readFileSync(process.env.CHRONOS_VENUES_FILE || path.join(ROOT, 'venues.json'), 'utf8'));
      const v = venues.venues.find((y) => y.kind === 'v3' && y.quoter && /uni/i.test(y.id || y.name || ''));
      if (!v) return { status: FAIL, detail: 'no Uniswap V3 quoter in venues.json' };
      const q = new ethers.Contract(v.quoter, C.ABI.quoterV2, p);
      const r = await q.quoteExactInputSingle.staticCall({ tokenIn: USDC, tokenOut: WETH, amountIn: 1000n * 10n ** 6n, fee: 500, sqrtPriceLimitX96: 0n });
      const out = Number(ethers.formatUnits(r[0], 18));
      return out > 0 ? { status: PASS, detail: `1000 USDC → ${out.toFixed(5)} WETH (≈ $${(1000 / out).toFixed(2)} per ETH)` } : { status: FAIL, detail: 'quote returned 0' };
    },
  },
  'wss-feed': {
    title: 'your websocket node streams new Arbitrum blocks',
    async run(x) {
      const { BlockFeed, wssUrls } = require('./blockfeed.cjs');
      const urls = wssUrls(x.get);
      if (!urls.length) return { status: SKIP, detail: 'no wss url set: chronos set ARBITRUM_WSS_URL' };
      const got = await new Promise((resolve) => {
        const seen = [];
        const f = new BlockFeed({ urls, onBlock: (n) => { seen.push(n); if (seen.length >= 2) { f.stop(); resolve(seen); } } }).start();
        setTimeout(() => { f.stop(); resolve(seen); }, 20000);
      });
      return got.length >= 2 ? { status: PASS, detail: `blocks ${got[0]} → ${got[got.length - 1]} received live` } : { status: FAIL, detail: `${got.length} block(s) in 20 s` };
    },
  },
  'contract-deployed': {
    title: 'your deployed contract is the one the engine expects',
    async run(x) {
      const a = x.get('CHRONOS_FLASH_ARB_ADDRESS');
      if (!isAddr(a)) return { status: SKIP, detail: isAddr(x.get('CONTRACT_ADDRESS')) ? `no Chronos contract yet (CONTRACT_ADDRESS ${x.get('CONTRACT_ADDRESS')} is not used unless it is one): chronos mainnet` : 'no contract address yet: chronos mainnet' };
      const p = await x.provider();
      if ((await p.getCode(a)) === '0x') return { status: FAIL, detail: 'no code at ' + a };
      const c = new ethers.Contract(a, ['function POOL() view returns (address)', 'function owner() view returns (address)', 'function paused() view returns (bool)'], p);
      const [pool, owner, paused] = await Promise.all([c.POOL(), c.owner(), c.paused()]);
      const C = require('./chain.cjs');
      if (pool.toLowerCase() !== C.AAVE_POOL.toLowerCase()) return { status: FAIL, detail: 'contract POOL() is not the real Aave pool' };
      const info = await require('./contractinfo.cjs').read(p, a);
      if (info.kind === 2 && info.vault && info.vault !== require('./live.cjs').BALANCER_VAULT.toLowerCase()) return { status: FAIL, detail: `contract v2 borrows from ${info.vault}, not the Balancer V2 vault` };
      // the zero-fee lenders are the edge: with none wired every loan pays Aave's 5 bps ($0.50 per $1,000), more than a
      // typical Arbitrum arbitrage earns (all 865 samples on 2026-11-25 paid it). Said loudly, not as a pass.
      const L = require('./live.cjs'); const zero = info.kind === 2 ? [info.vault && 'Balancer', info.morpho && L.MORPHO && info.morpho === L.MORPHO.toLowerCase() && 'Morpho', info.v4 && L.UNI_V4 && info.v4 === L.UNI_V4.toLowerCase() && 'Uniswap V4'].filter(Boolean) : [];
      if (!zero.length) return { status: FAIL, detail: `contract v${info.kind} has no zero-fee lender (Balancer, Morpho, Uniswap V4): every loan pays Aave 5 bps. ${info.kind === 1 ? 'Deploy contract v2.3: chronos deploy --v2' : 'Redeploy v2.3 with them: chronos deploy --v2'}` };
      return { status: PASS, detail: `contract v${info.kind} · zero-fee lenders: ${zero.join(', ')} · Aave pool wired · owner ${owner.slice(0, 8)}… · ${paused ? 'PAUSED' : 'not paused'}` };
    },
  },
  'contract-v2-probe': {
    title: 'contract v2 against the real Aave, Balancer, Uniswap/Sushi/Pancake (one eth_call, nothing sent)',
    async run(x) {
      const dir = path.join(ROOT, 'contracts', 'v2');
      if (!fs.existsSync(path.join(dir, 'ForkProbe.json'))) return { status: SKIP, detail: 'contract v2 is not in this release' };
      const { runV2Probe } = require('./v2probe.cjs');
      const checks = await runV2Probe(await x.provider(), dir);
      x.extra.v2 = checks;
      const bad = checks.filter((c) => !c.ok);
      return bad.length ? { status: FAIL, detail: `${checks.length - bad.length}/${checks.length}: failed ${bad.map((c) => c.name).join(', ')}` } : { status: PASS, detail: `${checks.length}/${checks.length} real-protocol checks pass` };
    },
  },
  'kms-signer': {
    title: 'the executor key is a real Cloud KMS HSM key',
    async run(x) {
      const k = x.get('CHRONOS_EXECUTOR_KMS_KEY');
      if (!k) return { status: SKIP, detail: 'no KMS key here (it runs on the cloud engine: cloud/gcp-setup.sh)' };
      const { KmsSigner } = require('./kms.cjs');
      try { const addr = await new KmsSigner(k).getAddress(); return { status: PASS, detail: `HSM key answers · address ${addr}` }; }
      catch (e) { return /metadata|ENOTFOUND|169\.254/.test(String(e.message)) ? { status: SKIP, detail: 'KMS signing only works on the cloud engine (no Google metadata server on this device)' } : { status: FAIL, detail: redact(e.message).slice(0, 140) }; }
    },
  },
  'executor-agent': {
    title: 'your executor key on this phone: the key agent is unlocked, signs as the executor, is an operator on your real contract with gas, and refuses anything but a trade',
    async run(x) {
      const KS = require('./keystore.cjs'); const KA = require('./keyagent.cjs');
      const dir = x.dataDir || require('./live.cjs').DATA;
      const ks = KS.executorAddress(dir);
      if (!ks) return { status: SKIP, detail: 'no executor keystore on this device (chronos executor import; or the Cloud KMS key on your cloud engine)' };
      const st = await KA.status(dir);
      if (!st) return { status: FAIL, detail: 'locked: the key agent is not running (a phone restart?): chronos executor unlock' };
      if (st.address.toLowerCase() !== ks.toLowerCase()) return { status: FAIL, detail: `the agent signs as ${st.address}, the keystore is ${ks}: chronos executor lock, then unlock` };
      const want = x.get('CHRONOS_EXECUTOR_ADDRESS');
      if (isAddr(want) && want.toLowerCase() !== ks.toLowerCase()) return { status: FAIL, detail: `CHRONOS_EXECUTOR_ADDRESS is ${want}, the keystore here is ${ks}` };
      const a = x.get('CHRONOS_FLASH_ARB_ADDRESS');
      if (!isAddr(a)) return { status: SKIP, detail: 'no contract address yet: chronos mainnet' };
      if (st.contract.toLowerCase() !== a.toLowerCase()) return { status: FAIL, detail: `the agent was unlocked for contract ${st.contract}, yours is now ${a}: chronos executor lock, then unlock` };
      // the agent's own policy, on the real agent: a plain ETH transfer to your contract and a call to another address are refused
      const signer = new KA.AgentSigner(dir);
      for (const probe of [{ to: a, value: 1n, data: '0x' }, { to: '0x' + '0'.repeat(39) + '1', value: 0n, data: '0x' }]) {
        try { await signer.signTransaction({ type: 2, chainId: 42161n, nonce: 0, gasLimit: 21000n, maxFeePerGas: 1n, maxPriorityFeePerGas: 0n, ...probe }); return { status: FAIL, detail: 'the key agent signed a transaction that is not a trade: lock it now (chronos executor lock)' }; }
        catch (e) { if (!/refused by the key agent/.test(e.message)) return { status: FAIL, detail: 'policy probe: ' + redact(e.message).slice(0, 120) }; }
      }
      const p = await x.provider();
      const c = new ethers.Contract(a, ['function operators(address) view returns (bool)'], p);
      const [isOp, bal] = await Promise.all([c.operators(ks), p.getBalance(ks)]);
      if (!isOp) return { status: FAIL, detail: `${ks} is not an operator on ${a}: chronos deploy (owner, YES)` };
      const eth = Number(ethers.formatEther(bal));
      return { status: PASS, detail: `unlocked · signs as ${ks} · operator on your contract · ${eth.toFixed(5)} ETH for gas · ${st.signed} signed since unlock · transfer and foreign-address probes refused` };
    },
  },
  'drive-remote': {
    title: 'Google Drive through rclone answers (the key pull on update), and if not, why in words',
    async run(x) {
      const DP = require('./drivepull.cjs');
      const ready = await DP.remoteReady();
      if (!ready.ok) return { status: SKIP, detail: ready.why };
      const folder = x.get('CHRONOS_DRIVE_ENV_FOLDER');
      const { execFile } = require('child_process');
      const target = folder ? `gdrive:${String(folder).replace(/^\/+|\/+$/g, '')}` : 'gdrive:';
      const r = await new Promise((res) => execFile(ready.bin, ['lsf', target, '--max-depth', '1', '--fast-list', '--drive-skip-shortcuts'], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => res({ err, stdout: String(stdout || ''), stderr: String(stderr || '') })));
      if (!r.err) return { status: PASS, detail: `${target} answers · ${r.stdout.split('\n').filter(Boolean).length} item(s) at the top` };
      const e = DP.explain(r, 60000, folder);
      return { status: e.fatal ? FAIL : PASS, detail: e.why };
    },
  },
  'data-apis': {
    title: 'your 1inch and Etherscan API keys answer on Arbitrum One (read-only calls)',
    async run(x) {
      const C = require('./catalog.cjs'); const out = []; let bad = false;
      for (const k of ['ONEINCH_API_KEY', 'ETHERSCAN_API_KEY']) {
        const v = x.get(k); if (!v) continue;
        const r = await C.SECRETS.find((s) => s.key === k).test(v);
        out.push(`${k}: ${r.ok ? r.msg : 'FAILED · ' + r.msg}`); if (!r.ok) bad = true;
      }
      if (!out.length) return { status: SKIP, detail: 'neither is set (chronos set ONEINCH_API_KEY · chronos set ETHERSCAN_API_KEY)' };
      return { status: bad ? FAIL : PASS, detail: out.join(' · ') };
    },
  },
  'narrate-voice': {
    title: 'chronos narrate has a voice on this device (the speech engine answers; nothing is spoken by this check)',
    async run(x) {
      const V = require('./voice.cjs'); const b = V.backend(x.get);
      if (!b) return { status: SKIP, detail: 'no speech engine here: on the phone install the Termux:API app, then pkg install termux-api' };
      const e = V.engines(); if (b.bin === 'termux-tts-speak' && (!e || !e.length)) return { status: FAIL, detail: 'termux-tts-speak is installed but no voice engine answered: open the Termux:API app once and allow it' };
      return { status: PASS, detail: `${b.name}${e && e.length ? ` · engines: ${e.map((y) => y.name + (y.default ? ' (default)' : '')).join(', ')}` : ''}` };
    },
  },
  'aave-liquidation-sources': {
    title: 'chronos liquidations can read Aave V3 on Arbitrum One and Base through Etherscan (each pool answers with its addresses provider)',
    async run(x) {
      const key = x.get('ETHERSCAN_API_KEY'); if (!key) return { status: SKIP, detail: 'no ETHERSCAN_API_KEY (chronos set ETHERSCAN_API_KEY)' };
      const L = require('./liquidations.cjs'); const { ethers } = require('ethers'); const I = new ethers.Interface(['function ADDRESSES_PROVIDER() view returns (address)']);
      const out = []; let bad = false;
      for (const c of Object.values(L.CHAINS)) {
        try { const es = new L.EtherscanV2(key, c.id, { fetchImpl: x.fetchImpl || fetch }); const p = I.decodeFunctionResult('ADDRESSES_PROVIDER', await es.call(c.pool, I.encodeFunctionData('ADDRESSES_PROVIDER')))[0]; if (p === ethers.ZeroAddress) throw new Error('no provider'); out.push(`${c.name} pool answers (provider ${p.slice(0, 8)}…)`); }
        catch (e) { bad = true; out.push(`${c.name}: ${redact(e.message).slice(0, 80)}`); }
      }
      return { status: bad ? FAIL : PASS, detail: out.join(' · ') };
    },
  },
  'burst-nodes': {
    title: 'burst mode: every node in it answers as Arbitrum One through the fast-fail client (no retry on a limit, short timeout); which nodes are kept out and why',
    async run(x) {
      const FAN = require('./fan.cjs'); const PR = require('./providers.cjs');
      if (String(x.get('CHRONOS_SCAN_MODE') || 'burst').toLowerCase() === 'paced') return { status: SKIP, detail: 'CHRONOS_SCAN_MODE=paced: burst mode is off' };
      const send = x.get('ARB_RPC_URL') || x.get('RPC_URL') || x.get('ARBITRUM_RPC_URL');
      const m = FAN.members(PR.nodeEntries(x.get), x.get, send, String(x.get('CHRONOS_BURST_NODES') || 'free').toLowerCase());
      if (!m.members.length) return { status: SKIP, detail: 'no node can join burst mode: ' + (m.out.map((o) => `${o.key}: ${o.why}`).join('; ') || 'no https nodes') };
      const res = await Promise.all(m.members.map(async (e) => { const t0 = Date.now(); try { const id = BigInt(await FAN.fastProvider(e.url, { get: x.get }).send('eth_chainId', [])); return id === 42161n ? `${e.key} ✓ ${Date.now() - t0} ms` : `${e.key} ✗ chain ${id}`; } catch (err) { return `${e.key} ✗ ${redact(err.shortMessage || err.message).slice(0, 50)}`; } }));
      const bad = res.filter((r) => r.includes('✗'));
      return { status: bad.length === res.length ? FAIL : PASS, detail: `${res.join(' · ')}${m.out.length ? ' · kept out: ' + m.out.map((o) => o.key).join(', ') : ''}${bad.length && bad.length < res.length ? ' (a failing node only cools down; the others carry the scan)' : ''}` };
    },
  },
  'device-service': {
    title: 'your release service (Supabase) knows this device',
    async run() {
      try { const s = await require('./device.cjs').status(); return s.status === 'approved' ? { status: PASS, detail: `approved · pairing code ${s.code}` } : { status: FAIL, detail: `device is ${s.status}: approve it in the portal → Devices` }; }
      catch (e) { return { status: FAIL, detail: e.status === 403 ? 'not enrolled: chronos device' : 'release service not reachable: ' + redact(e.message).slice(0, 80) }; }
    },
  },
  'phone-notify': {
    title: 'a real notification reaches this phone',
    async run() {
      const { onPath } = require('./notify.cjs');
      if (!onPath('termux-notification')) return { status: SKIP, detail: 'termux-notification not installed (pkg install termux-api, plus the Termux:API app)' };
      const r = require('child_process').spawnSync('termux-notification', ['--id', 'chronos-verify', '--title', 'Chronos verify-real', '--content', 'Notifications work.'], { timeout: 15000 });
      return r.status === 0 ? { status: PASS, detail: 'sent: look for "Chronos verify-real" on your phone' } : { status: FAIL, detail: `termux-notification exited ${r.status}` };
    },
  },
  'alert-webhook': {
    title: 'your alert webhook accepts a signed event',
    async run(x) {
      const url = require('./hookurl.cjs').effective(x.get, 'CHRONOS_ALERT_WEBHOOK_URL');
      if (!url) return { status: SKIP, detail: 'turned off (CHRONOS_ALERT_WEBHOOK_URL=off)' };
      const send = require('./webhook.cjs').createWebhook({ url, secret: x.get('CHRONOS_ALERT_WEBHOOK_SECRET') || null, minGapMs: 0 });
      if (!send) return { status: FAIL, detail: 'webhook url must be https' };
      const r = await send('verify', { message: 'chronos verify-real test event' });
      return r.status >= 200 && r.status < 300 ? { status: PASS, detail: `HTTP ${r.status}` } : { status: FAIL, detail: r.status ? `HTTP ${r.status}` : 'not reachable' };
    },
  },
  'notify-webhook': {
    title: 'your alert notifications webhook (CHRONOS_WEBHOOK_URL) accepts a message',
    async run(x) {
      const HU = require('./hookurl.cjs'); const url = HU.effective(x.get, 'CHRONOS_WEBHOOK_URL');
      if (!url) return { status: SKIP, detail: 'turned off (CHRONOS_WEBHOOK_URL=off)' };
      if (!/^https:\/\//.test(url)) return { status: FAIL, detail: 'must be https' };
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
      try {
        const body = JSON.stringify({ content: 'Chronos verify-real: notifications work.', text: 'Chronos verify-real: notifications work.', title: 'Chronos verify-real', message: 'notifications work', level: 'info', kind: 'verify', channel: 'notify' });
        const r = await fetch(url, { method: 'POST', headers: HU.headersFor(url, body), body, signal: ac.signal });
        return r.ok ? { status: PASS, detail: `HTTP ${r.status}: look for "Chronos verify-real" where this webhook posts` } : { status: FAIL, detail: `HTTP ${r.status}` };
      } catch (_) { return { status: FAIL, detail: 'not reachable' }; } finally { clearTimeout(t); }
    },
  },
  'portal-backend': {
    title: 'your portal database: every table it uses exists and a signed-out visitor can read none of it',
    async run() {
      const bad = [];
      for (const t of PORTAL_TABLES) {
        const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), 10000);
        try {
          const r = await fetch(`${portalUrl()}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: portalKey() }, signal: ac.signal });
          const body = await r.text(); let j = null; try { j = JSON.parse(body); } catch (_) { /* not json */ }
          if (r.status === 200 && Array.isArray(j) && j.length === 0) continue;               // allowed to ask, sees nothing
          if ((r.status === 401 || r.status === 403) && /42501|permission denied/i.test(body)) continue; // refused outright
          bad.push(r.status === 200 ? `${t}: a signed-out visitor can read rows` : /PGRST205|42P01|does not exist/.test(body) ? `${t}: table missing` : `${t}: HTTP ${r.status}`);
        } catch (e) { bad.push(`${t}: ${e.name === 'AbortError' ? 'timed out' : 'not reachable'}`); }
        finally { clearTimeout(timer); }
      }
      return bad.length ? { status: FAIL, detail: bad.join('; ') } : { status: PASS, detail: `${PORTAL_TABLES.length} tables present, all closed to signed-out visitors` };
    },
  },
  'relay-realtime': {
    title: 'the price-move relay: your Supabase Realtime accepts a listener on topic chronos-pool-moves (what every engine joins)',
    async run() {
      const RL = require('./relay.cjs');
      const url = RL.realtimeUrl(portalUrl().replace(/\/?$/, '/'), portalKey());
      if (!url) return { status: SKIP, detail: 'not a supabase.co project url' };
      return await new Promise((resolve) => {
        let done = false; const finish = (r) => { if (!done) { done = true; clearTimeout(t); l.stop(); resolve(r); } };
        const t = setTimeout(() => finish({ status: FAIL, detail: l.why ? `no join within 15 s (${l.why})` : 'no join within 15 s' }), 15000);
        const l = new RL.Listener({ url, onPools: () => {}, log: () => finish({ status: PASS, detail: 'joined chronos-pool-moves: engines receive pool moves' }) }).start();
        if (!l.WS) finish({ status: SKIP, detail: 'no websocket client on this device' });
      });
    },
  },
  'ai-agent': {
    title: 'your OpenRouter key and model are accepted (key status only: no completion is billed)',
    async run(x) {
      const key = x.get('OPENROUTER_API_KEY');
      if (!key) return { status: SKIP, detail: 'AI agent off: chronos set OPENROUTER_API_KEY (the model is chosen for you)' };
      const am = await require('./agentmodel.cjs').resolve(x.get, x.dataDir || require('./live.cjs').DATA);
      if (!am) return { status: FAIL, detail: 'OpenRouter model list not reachable' };
      const model = am.model;
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
      try {
        const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { authorization: `Bearer ${key}` }, signal: ac.signal });
        if (r.status !== 200) return { status: FAIL, detail: `key refused: HTTP ${r.status}` };
        const m = await fetch('https://openrouter.ai/api/v1/models', { signal: ac.signal }).then((y) => y.json());
        const found = (m.data || []).some((y) => y.id === model);
        return found ? { status: PASS, detail: `key accepted · model ${model} exists${am.chosen ? ' (newest Claude Sonnet, chosen for you)' : ''}` } : { status: FAIL, detail: `model ${model} is not offered by OpenRouter` };
      } finally { clearTimeout(t); }
    },
  },
};

/** runs the checks (all, or `only`) against the real systems and records the result in data/live/realcheck.json */
async function verifyReal({ envFile, only = null, log = () => {}, dataDir = null } = {}) {
  const { parseEnvFile } = require('./config.cjs');
  const env = envFile ? parseEnvFile(envFile) : {};
  const get = (k) => (process.env[k] !== undefined ? process.env[k] : env[k]);
  let prov = null;
  const x = {
    get, extra: {}, dataDir,
    async provider() {
      if (prov) return prov;
      const { loadConfig } = require('./config.cjs');
      const cfg = loadConfig(envFile);
      if (!cfg.rpcUrl) throw new Error('no RPC url in .env: chronos setup');
      prov = await require('./chain.cjs').connect(cfg);
      return prov;
    },
  };
  const results = [];
  for (const [id, c] of Object.entries(CHECKS)) {
    if (only && !only.includes(id)) continue;
    let r;
    try { r = await c.run(x); } catch (e) { r = { status: FAIL, detail: redact(e.shortMessage || e.message || String(e)).slice(0, 160) }; }
    results.push({ id, title: c.title, ...r });
    log(results[results.length - 1]);
  }
  const out = { at: new Date().toISOString(), results, v2: x.extra.v2 || null };
  if (dataDir) { try { fs.mkdirSync(path.join(dataDir, 'live'), { recursive: true }); fs.writeFileSync(path.join(dataDir, 'live', 'realcheck.json'), JSON.stringify(out, null, 2), { mode: 0o600 }); } catch (_) { /* best effort */ } }
  return out;
}

module.exports = { CHECKS, verifyReal, PASS, FAIL, SKIP, PORTAL_TABLES, PORTAL_KEY };
