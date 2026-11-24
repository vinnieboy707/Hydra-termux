const { ethers } = require('ethers');
require('dotenv').config();

async function checkTx() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const txHash = "0x40c7a0688cfd0bd41799eae46a571a1fdf71895d1554334e0ecdc77c6b5b2a7f";

    console.log(`🔍 [On-Chain Audit] Fetching receipt for transaction: ${txHash}`);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
        console.log("⏳ [Pending] Transaction is still propagating or not yet mined.");
        return;
    }

    console.log("==========================================");
    console.log(`📦 Block Number:       ${receipt.blockNumber}`);
    console.log(`⚡ Confirmations:      ${await provider.getBlockNumber() - receipt.blockNumber + 1}`);
    console.log(`⛽ Gas Used:           ${receipt.gasUsed.toString()}`);
    console.log(`✅ Status:             ${receipt.status === 1 ? 'SUCCESS (Confirmed)' : 'FAILED'}`);
    console.log("==========================================");
}

checkTx();
