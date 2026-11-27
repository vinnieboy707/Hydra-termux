require('dotenv').config();
const { ethers } = require('ethers');

async function transferPartialTokens() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ [Error] PRIVATE_KEY not found in environment.");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    const tokenAddress = "0xead1a3bdc58c193ba5a8644447b2da40d1368fca";
    const destinationAddress = "0xbdf5cC5F73e81E5BE2d495f04BAc1A864372407a";
    
    const abi = ["function transfer(address to, uint256 value) public returns (bool)"];
    const contract = new ethers.Contract(tokenAddress, abi, wallet);

    // Transfer equivalent to $500 USD (~16,129 rANT at $0.031/token)
    const transferAmount = "16129.03";
    console.log(`🚀 [Transfer Initiated] Sending ${transferAmount} rANT (~$500 USD) to MetaMask destination...`);
    
    const amount = ethers.parseUnits(transferAmount, 18);
    const tx = await contract.transfer(destinationAddress, amount);
    console.log(`📦 [Tx Submitted] Hash: ${tx.hash}`);
    
    await tx.wait();
    console.log("✅ [Success] Partial rANT transfer successfully completed!");
}

transferPartialTokens();
