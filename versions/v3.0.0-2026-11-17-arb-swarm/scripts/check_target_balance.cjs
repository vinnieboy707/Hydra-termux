const { ethers } = require('ethers');
require('dotenv').config();

async function checkBalance() {
    const targetAddress = "0xbdf5cC5F73e81E5BE2d495f04BAc1A864372407a";
    const arbitrumRpc = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";

    console.log("🔍 [Balance Check] Connecting to Arbitrum Mainnet RPC...");
    const provider = new ethers.JsonRpcProvider(arbitrumRpc);

    try {
        const balanceWei = await provider.getBalance(targetAddress);
        const balanceEth = ethers.formatEther(balanceWei);
        
        const feeData = await provider.getFeeData();
        const gasGwei = ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');

        console.log("==========================================");
        console.log(`🏦 Target Address:     ${targetAddress}`);
        console.log(`💰 Native ETH Balance: ${balanceEth} ETH`);
        console.log(`⛽ Current Gas Price:  ${parseFloat(gasGwei).toFixed(4)} Gwei`);
        console.log("==========================================");
    } catch (err) {
        console.error("❌ [Balance Check Error]:", err.message);
    }
}

checkBalance();
