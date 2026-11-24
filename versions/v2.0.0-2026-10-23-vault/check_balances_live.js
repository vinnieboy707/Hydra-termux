'use strict';
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

async function checkBalances() {
    console.log('========================================================');
    console.log('CHRONOS OS // COMPREHENSIVE BALANCE AUDIT');
    console.log('========================================================');

    const ledgerPath = './unified_financial_ledger.wal';
    let totalRevenue = 0;
    let totalSpendable = 0;
    let entryCount = 0;

    if (fs.existsSync(ledgerPath)) {
        const lines = fs.readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean);
        entryCount = lines.length;
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                totalRevenue += Number(entry.revenueUSD || entry.spendAmountUSD || 0);
                totalSpendable += Number(entry.spendableTapToPayAllocation || entry.operationsAllocation || 0);
            } catch (e) {}
        }
    }
    console.log(`[INTERNAL WAL] Total Entries: ${entryCount}`);
    console.log(`[INTERNAL WAL] Total Tracked Revenue: $${totalRevenue.toFixed(2)} USD`);
    console.log(`[INTERNAL WAL] Total Spendable Liquidity: $${totalSpendable.toFixed(2)} USD`);

    const rpcUrl = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
        try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const wallet = new ethers.Wallet(privateKey, provider);
            const balance = await provider.getBalance(wallet.address);
            console.log(`[ARBITRUM ONE] Sender Address (${wallet.address}): ${ethers.formatEther(balance)} ETH`);
        } catch (err) {
            console.log(`[ARBITRUM ONE] Could not fetch balance: ${err.message}`);
        }
    }
    console.log('========================================================');
}

checkBalances();
