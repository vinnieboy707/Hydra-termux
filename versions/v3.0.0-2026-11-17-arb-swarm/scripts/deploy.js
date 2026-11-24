import hre from "hardhat";

async function main() {
  console.log("=========================================================");
  console.log("CHRONOS OS: DEPLOYING CHRONOS FLASH ARBITRAGE CONTRACT");
  console.log("=========================================================");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📦 Deploying with account: ${deployer.address}`);

  const ChronosFlashArb = await hre.ethers.getContractFactory("ChronosFlashArb");
  const contract = await ChronosFlashArb.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`✅ ChronosFlashArb deployed successfully to: ${address}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
