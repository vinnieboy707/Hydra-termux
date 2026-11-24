'use strict';
require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');
const { ethers } = require('ethers');

async function auditAll() {
  console.log('========================================================');
  console.log('CHRONOS OS // LIVE MULTI-CHAIN BALANCE AUDIT (PUBLICNODE)');
  console.log('========================================================');

  // 1. Solana Balance
  try {
    const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const pubkey = new PublicKey('ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr');
    const lamports = await conn.getBalance(pubkey);
    console.log(`[Solana] Address: ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr`);
    console.log(`[Solana] Balance: ${lamports / 1e9} SOL`);
  } catch (err) {
    console.log(`[Solana] Error: ${err.message}`);
  }

  // 2. EVM Balances with publicnode & official RPCs
  const address = '0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0';
  console.log(`[EVM] Address: ${address}`);
  
  const rpcs = {
    'Ethereum Mainnet': { url: 'https://ethereum.publicnode.com', chainId: 1 },
    'Arbitrum One': { url: 'https://arb1.arbitrum.io/rpc', chainId: 42161 },
    'Optimism': { url: 'https://mainnet.optimism.io', chainId: 10 },
    'Base': { url: 'https://mainnet.base.org', chainId: 8453 }
  };

  for (const [chain, config] of Object.entries(rpcs)) {
    try {
      const network = ethers.Network.from(config.chainId);
      const provider = new ethers.JsonRpcProvider(config.url, network, { staticNetwork: true });
      const bal = await provider.getBalance(address);
      console.log(`[${chain}] Balance: ${ethers.formatEther(bal)} ETH`);
    } catch (e) {
      console.log(`[${chain}] Error: ${e.message}`);
    }
  }
  console.log('========================================================');
}

auditAll();
