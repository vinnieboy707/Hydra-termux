import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`[+] Deploying ChronosFlashArb with account: ${deployer.address}`);

  const AAVE_POOL_ARBITRUM = "0x794a61358d6845594f94dc1db02a252b5b4814aabd";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const EXECUTOR = process.env.EXECUTOR_WALLET_ADDRESS || "0x52a7158a00000000000000000000000000000052";

  const ChronosFlashArb = await hre.ethers.getContractFactory("ChronosFlashArb");
  const flashArb = await ChronosFlashArb.deploy(
    AAVE_POOL_ARBITRUM,
    UNISWAP_V3_ROUTER,
    SUSHISWAP_ROUTER,
    EXECUTOR
  );

  await flashArb.waitForDeployment();
  console.log(`[✔] ChronosFlashArb deployed to: ${await flashArb.getAddress()}`);
}

main().

cd ~/chronos-infrastructure-core

# =========================================================================
# CHRONOS OS // COMPLETE DEPLOYMENT SCRIPT & EXECUTION MATRIX
# =========================================================================
echo "🚀 Finalizing Hardhat deployment script and verifying node execution readiness..."

# 1. Complete the deploy_flash_arb.mjs script safely
cat << 'EOF' > scripts/deploy_flash_arb.mjs
import hre from "hardhat";

async function main() {
  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error("[!] CRITICAL: No deployer wallet accounts configured. Set PRIVATE_KEY in .env.production.");
  }

  const deployer = signers[0];
  console.log(`[+] Deploying ChronosFlashArb with account: ${deployer.address}`);

  const AAVE_POOL_ARBITRUM = "0x794a61358d6845594f94dc1db02a252b5b4814aabd";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const SUSHISWAP_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const EXECUTOR = process.env.EXECUTOR_WALLET_ADDRESS || "0x52a7158a00000000000000000000000000000052";

  const ChronosFlashArb = await hre.ethers.getContractFactory("ChronosFlashArb");
  const flashArb = await ChronosFlashArb.deploy(
    AAVE_POOL_ARBITRUM,
    UNISWAP_V3_ROUTER,
    SUSHISWAP_ROUTER,
    EXECUTOR
  );

  await flashArb.waitForDeployment();
  console.log(`[✔] ChronosFlashArb successfully deployed to address: ${await flashArb.getAddress()}`);
}

main().catch((error) => {
  console.error("[!] Deployment Error:", error.message);
  process.exitCode = 1;
});
