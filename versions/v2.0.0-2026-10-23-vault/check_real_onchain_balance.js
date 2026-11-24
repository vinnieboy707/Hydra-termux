'use strict';
const { ethers } = require('ethers');

async function checkSecondaryAccountBalance() {
    console.log('========================================================');
    console.log('CHRONOS OS // SECONDARY ACCOUNT REAL ON-CHAIN BALANCE CHECK');
    console.log('========================================================');
    console.log('[MODE]: Zero Simulation. Querying live network RPC for secondary wallet.');

    const rpcUrl = 'https://arb1.arbitrum.io/rpc';
    const secondaryPrivateKey=process.env.PRIVATEKEY  /* REDACTED: moved to env */;

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(secondaryPrivateKey, provider);

        console.log(`[+] Connected to Arbitrum RPC: ${rpcUrl}`);
        console.log(`[+] Secondary Wallet Address: ${wallet.address}`);

        const balanceWei = await provider.getBalance(wallet.address);
        const balanceETH = ethers.formatEther(balanceWei);

        console.log('--------------------------------------------------------');
        console.log(`💰 SECONDARY WALLET ON-CHAIN BALANCE: ${balanceETH} ETH`);
        console.log('--------------------------------------------------------');

        if (balanceWei === 0n) {
            console.log('⚠️ [NOTICE]: Secondary wallet balance is 0.0 ETH.');
        } else {
            console.log('✅ [SUCCESS]: Secondary wallet has active real funds for gas execution.');
        }
    } catch (err) {
        console.error('❌ [RPC ERROR]:', err.message);
    }
}

checkSecondaryAccountBalance();
