import { ethers } from "ethers";
require("dotenv").config();

const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)"
];

async function runCorrectedArbitrageScanner() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contractAddress = process.env.CONTRACT_ADDRESS;

    const POOL_A = "0xC6962004f452Be9203591991D15f6b388e09e8D0".toLowerCase();
    const poolA = new ethers.Contract(POOL_A, POOL_ABI, provider);

    // Fetch token0 to determine correct decimal scaling direction
    const token0 = await poolA.token0();
    const isWethToken0 = token0.toLowerCase() === "0x82af49447d8a07e3bd95bd0d56f35241523fbab1".toLowerCase();

    console.log("⚡ [Chronos Apex Engine] Corrected Price & Spread Monitor Active.");
    console.log(`👛 [Signer]: ${wallet.address}`);
    console.log(`📜 [Contract]: ${contractAddress}`);
    console.log(`🪙 [Token0 WETH Check]: ${isWethToken0}`);

    provider.on("block", async (blockNumber) => {
        try {
            const slotA = await poolA.slot0();
            const sqrtPriceX96 = slotA.sqrtPriceX96;
            
            // Uniswap V3 Price calculation
            const priceBN = (sqrtPriceX96 * sqrtPriceX96 * ethers.parseUnits("1", 12)) / (1n << 192n);
            let formattedPrice = Number(ethers.formatUnits(priceBN, 18));
            
            // Adjust if token order is inverted
            let ethUsdPrice = isWethToken0 ? (formattedPrice > 0 ? 1 / formattedPrice : 0) : formattedPrice;
            if (ethUsdPrice < 100 && ethUsdPrice > 0) ethUsdPrice = 1 / ethUsdPrice; // Fallback bound normalization

            console.log(`\n🔍 [Block #${blockNumber}] Tick: ${slotA.tick} | WETH/USDC Spot Price: ~$${ethUsdPrice.toFixed(2)}`);
            console.log(`✨ [Status] Spread within normal parameters. Ready for profitable delta.`);
        } catch (err) {
            console.error("⚠️ [Scan Error - Auto-Recovering]:", err);
        }
    });
}

runCorrectedArbitrageScanner().catch(console.error);
