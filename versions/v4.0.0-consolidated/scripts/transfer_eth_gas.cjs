require('dotenv').config();
const { ethers } = require('ethers');

async function transferGas() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ [Error] PRIVATE_KEY not found in environment.");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    const destinationAddress = "0xbdf5cC5F73e81E5BE2d495f04BAc1A864372407a";
    
    // Amount of native ETH to transfer for gas (e.g., 0.005 ETH)
    const ethAmount = "0.005";
    console.log(`🚀 [Gas Transfer] Sending ${ethAmount} ETH to MetaMask destination...`);
    
    const tx = await wallet.sendTransaction({
        to: destinationAddress,
        value: ethers.parseEther(ethAmount)
    });
    
    console.log(`📦 [Tx Submitted] Hash: ${tx.hash}`);
    await tx.wait();
    console.log("✅ [Success] ETH gas transfer successfully completed!");
}

transferGas();
