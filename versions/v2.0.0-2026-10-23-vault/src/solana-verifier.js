'use strict';
const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
let genesisChecked = false;

const rpcUrl = () => process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC_PRIMARY || 'https://api.mainnet-beta.solana.com';
const wallets = () => {
  const envWallets = process.env.CHRONOS_SOL_SETTLEMENT_WALLETS || process.env.SOLANA_WALLET_PUBKEY || '';
  return envWallets.split(',').map((s) => s.trim()).filter((a) => B58.test(a));
};
const mints = () => Array.from(new Set([USDC_MINT, ...(process.env.CHRONOS_SOL_MINTS || '').split(',').map((s) => s.trim()).filter((m) => B58.test(m))]));

async function rpc(method, params) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(rpcUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || 'rpc error');
    return j.result;
  } finally { clearTimeout(t); }
}

async function assertMainnet() {
  if (genesisChecked) return;
  const g = await rpc('getGenesisHash', []);
  if (g !== MAINNET_GENESIS) throw new Error('RPC is not Solana mainnet-beta (genesis ' + g + ')');
  genesisChecked = true;
}

async function verifyInboundSolana(signature, opts) {
  const claimedUSD = opts && opts.claimedUSD;
  const ours = wallets();
  if (!ours.length) throw new Error('no Solana settlement wallet configured');
  await assertMainnet();
  const tx = await rpc('getTransaction', [signature, { commitment: 'finalized', maxSupportedTransactionVersion: 0, encoding: 'json' }]);
  if (!tx) throw new Error('no finalized transaction for this signature');
  if (!tx.meta || tx.meta.err) throw new Error('transaction failed on chain');

  const watch = mints();
  const key = (b) => b.owner + '|' + b.mint;
  const pre = new Map((tx.meta.preTokenBalances || []).map((b) => [key(b), BigInt(b.uiTokenAmount.amount)]));
  const post = new Map((tx.meta.postTokenBalances || []).map((b) => [key(b), { amt: BigInt(b.uiTokenAmount.amount), dec: b.uiTokenAmount.decimals, owner: b.owner, mint: b.mint }]));
  const keys = new Set([...pre.keys(), ...post.keys()]);
  let usd = 0, outsideSender = false;
  const transfers = [];
  for (const k of keys) {
    const p = post.get(k);
    const owner = k.split('|')[0], mint = k.split('|')[1];
    if (!watch.includes(mint)) continue;
    const delta = (p ? p.amt : 0n) - (pre.get(k) || 0n);
    if (delta > 0n && ours.includes(owner)) {
      const amount = Number(delta) / Math.pow(10, p.dec);
      usd += amount; transfers.push({ token: mint === USDC_MINT ? 'USDC' : mint.slice(0, 6), to: owner, usd: amount });
    } else if (delta < 0n && !ours.includes(owner)) outsideSender = true;
  }
  if (!transfers.length) throw new Error('no stablecoin credit to settlement wallet in tx');
  if (!outsideSender) throw new Error('credit did not come from outside address');
  if (claimedUSD !== undefined && Math.abs(claimedUSD - usd) > 0.01) {
    throw new Error('claimed amount does not match on-chain amount');
  }
  return { recognizedUSD: usd, blockNumber: tx.slot, blockTime: tx.blockTime, confirmations: 'finalized', transfers, wallet: transfers[0].to };
}

async function recentInbound(limitPerAccount) {
  const out = new Map();
  await assertMainnet();
  for (const owner of wallets()) {
    for (const mint of mints()) {
      const accts = await rpc('getTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed' }]);
      for (const a of (accts && accts.value) || []) {
        const sigs = await rpc('getSignaturesForAddress', [a.pubkey, { limit: limitPerAccount || 50, commitment: 'finalized' }]);
        for (const s of sigs || []) {
          if (s.err || out.has(s.signature)) continue;
          try { out.set(s.signature, (await verifyInboundSolana(s.signature)).recognizedUSD); } catch (_) {}
        }
      }
    }
  }
  return out;
}

module.exports = { verifyInboundSolana, recentInbound, wallets, rpc, MAINNET_GENESIS, USDC_MINT };
