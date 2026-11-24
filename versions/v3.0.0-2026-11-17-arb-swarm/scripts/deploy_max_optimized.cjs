require('dotenv').config();
const { ethers } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`🚀 [Chronos OS] Deploying ChronosFlashArbitrageMaxOptimized with account: ${deployer.address}`);

    // Balancer V2 Vault on Arbitrum One
    const BALANCER_VAULT = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

    const ContractFactory = await ethers.getContractFactory("ChronosFlashArbitrageMaxOptimized");
    const instance = await ContractFactory.deploy(BALANCER_VAULT);

    await instance.waitForDeployment();
    const contractAddress = await instance.getAddress();

    console.log(`✅ [Success] ChronosFlashArbitrageMaxOptimized deployed to: ${contractAddress}`);
    console.log(`👉 Add CONTRACT_ADDRESS=${contractAddress} to your .env file.`);
}

main().catch((error) => {
    console.error("❌ [Deployment Error]:", error);
    process.exitCode = 1;
});
