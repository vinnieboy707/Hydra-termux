const hre = require("hardhat");

async function main() {
    console.log("🚀 [Deployer] Initializing deployment of ChronosFlashArb to Arbitrum One...");

    const [deployer] = await hre.ethers.getSigners();
    console.log(`📦 Deploying contracts with account: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Account balance: ${hre.ethers.formatEther(balance)} ETH`);

    const ChronosFlashArb = await hre.ethers.getContractFactory("ChronosFlashArb");
    const chronosFlashArb = await ChronosFlashArb.deploy();

    await chronosFlashArb.waitForDeployment();
    const contractAddress = await chronosFlashArb.getAddress();

    console.log(`✅ [Success] ChronosFlashArb deployed to: ${contractAddress}`);
}

main().catch((error) => {
    console.error("❌ [Deployer] Deployment failed:", error);
    process.exitCode = 1;
});
