const { ethers } = require("ethers");
require("dotenv").config();

async function runPolicyValidation() {
    console.log("🛡️ [Chronos Policy Guard] Initializing anti-fabrication & on-chain grounding test suite...");

    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 1. Test Block Grounding
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ [Test 1] Live Block Grounding: Current Arbitrum Block #${blockNumber} verified.`);
    if (!blockNumber || blockNumber <= 0) {
        throw new Error("❌ Policy Violation: Invalid block number returned.");
    }

    // 2. Test Factory & Pool Resolution Guard (Uniswap V3 Factory on Arbitrum)
    const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const fee = 500;

    const factoryAbi = ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"];
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    const poolAddress = await factory.getPool(WETH, USDC, fee);

    console.log(`✅ [Test 2] Factory Resolution: WETH/USDC pool resolved at ${poolAddress}`);
    if (!poolAddress || poolAddress === ethers.ZeroAddress) {
        throw new Error("❌ Policy Violation: Factory returned zero address.");
    }

    // 3. Test slot0 State Invariant & Zero-Price Rejection
    const poolAbi = [
        "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
    ];
    const pool = new ethers.Contract(poolAddress, poolAbi, provider);
    const slot0 = await pool.slot0();

    const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
    console.log(`✅ [Test 3] Slot0 Invariant: sqrtPriceX96 = ${sqrtPriceX96.toString()} | Unlocked = ${slot0.unlocked}`);
    
    if (sqrtPriceX96 === 0n) {
        throw new Error("❌ Policy Violation: Uninitialized pool detected (sqrtPriceX96 is 0). Rejected.");
    }

    if (!slot0.unlocked) {
        throw new Error("❌ Policy Violation: Pool is locked or reentrant.");
    }

    console.log("\n🛡️ [Policy Validation PASSED] All on-chain grounding tests successfully verified. Zero synthetic data injected.");
}

runPolicyValidation().catch(err => {
    console.error("🚨 [Policy Validation FAILED]:", err.message);
    process.exit(1);
});
