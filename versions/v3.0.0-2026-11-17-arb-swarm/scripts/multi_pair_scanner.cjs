const { ethers } = require("ethers");
require("dotenv").config();

const TOKENS = {
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    WBTC: { address: "0x2F2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
    ARB:  { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 }
};

const FACTORIES = {
    UniswapV3: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    SushiSwapV3: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e" // Correct Arbitrum One V3 Factory
};

const FACTORY_ABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)"
];

// Check multiple common fee tiers [500 (0.05%), 3000 (0.3%), 100 (0.01%)]
const PAIRS_TO_SCAN = [
    { name: "WETH/USDC", tokenA: "WETH", tokenB: "USDC", fees: [500, 100] },
    { name: "WBTC/WETH", tokenA: "WBTC", tokenB: "WETH", fees: [500, 3000, 100] },
    { name: "ARB/WETH",  tokenA: "ARB",  tokenB: "WETH", fees: [3000, 500, 100] }
];

async function scanDynamicPools() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    console.log("🔍 [Multi-Pair Dynamic Scanner] Resolving pools across Arbitrum factories...");
    const blockNumber = await provider.getBlockNumber();
    console.log(`⛓️ Current Block: #${blockNumber}\n`);

    for (const pair of PAIRS_TO_SCAN) {
        console.log(`📊 Pair: [${pair.name}]`);
        const tA = TOKENS[pair.tokenA];
        const tB = TOKENS[pair.tokenB];

        for (const [dexName, factoryAddress] of Object.entries(FACTORIES)) {
            let foundPool = false;
            for (const fee of pair.fees) {
                try {
                    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
                    const poolAddress = await factory.getPool(tA.address, tB.address, fee);

                    if (poolAddress && poolAddress !== ethers.ZeroAddress) {
                        const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
                        const [slot0, token0Addr] = await Promise.all([
                            pool.slot0(),
                            pool.token0()
                        ]);

                        const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
                        if (sqrtPriceX96 > 0n) {
                            const isToken0A = token0Addr.toLowerCase() === tA.address.toLowerCase();
                            const decimals0 = isToken0A ? tA.decimals : tB.decimals;
                            const decimals1 = isToken0A ? tB.decimals : tA.decimals;

                            const q96 = 2n ** 96n;
                            const priceRatio = Number(sqrtPriceX96 * sqrtPriceX96) / Number(q96 * q96);
                            const adjustedPrice = priceRatio * (10 ** (decimals0 - decimals1));
                            const spotPrice = isToken0A ? 1 / adjustedPrice : adjustedPrice;

                            console.log(`   🏊 [${dexName}] (Fee: ${fee}): Spot = $${spotPrice.toFixed(4)} | Unlocked: ${slot0.unlocked}`);
                            foundPool = true;
                            break;
                        }
                    }
                } catch (err) {
                    // Try next fee tier
                }
            }
            if (!foundPool) {
                console.log(`   ❌ [${dexName}]: No active initialized pool found.`);
            }
        }
        console.log();
    }
}

scanDynamicPools();
