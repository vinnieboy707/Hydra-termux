const { ethers } = require('ethers');
require('dotenv').config();

async function auditWallets() {
    const evmAddress = process.env.PRIMARY_SETTLEMENT_ADDRESS || "0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0";
    const arbitrumRpc = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";

    console.log("🔍 [Wallet & Gas Audit] Connecting to Arbitrum Mainnet RPC...");
    const provider = new ethers.JsonRpcProvider(arbitrumRpc);

    try {
        const balanceWei = await provider.getBalance(evmAddress);
        const balanceEth = ethers.formatEther(balanceWei);
        
        const feeData = await provider.getFeeData();
        const gasGwei = ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');

        console.log("==========================================");
        console.log(`🏦 Primary EVM Address: ${evmAddress}`);
        console.log(`💰 Native ETH Balance:  ${balanceEth} ETH`);
        console.log(`⛽ Current Gas Price:   ${parseFloat(gasGwei).toFixed(4)} Gwei`);
        console.log("==========================================");
    } catch (err) {
        console.error("❌ [Audit Error]:", err.message);
    }
}

auditWallets();
