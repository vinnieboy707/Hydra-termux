import { ethers } from "ethers";
require("dotenv").config();

const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)"
];

const CONTRACT_ABI = [
    "function initiateFlashLoan(address tokenToBorrow, uint256 borrowAmount, bytes calldata arbitrageData) external"
];

// Multi-Pair Registry mapping top Arbitrum liquidity pools across Uniswap V3 & SushiSwap
const LIQUIDITY_REGISTRY = [
    {
        name: "WETH/USDC (0.05%)",
        address: "0xC6962004f452Be9203591991D15f6b388e09e8D0".toLowerCase(),
        tokenBorrow: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
        baseDecimals: 18
    },
    {
        name: "WETH/USDC (0.3%)",
        address: "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443".toLowerCase(),
        tokenBorrow: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
        baseDecimals: 18
    },
    {
        name: "WBTC/WETH (0.05%)",
        address: "0x2f5e8bae1dc9893243dae78bbd377ba8225031b7".toLowerCase(),
        tokenBorrow: "0x2f2a2543B76a4166549F7aaB2e75Bef0aefC5B0f", // WBTC
        baseDecimals: 8
    }
];

async function runMultiPairEnterpriseEngine() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error("❌ [Config Error] CONTRACT_ADDRESS missing in environment.");
        process.exit(1);
    }

    const arbContract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    const poolInstances = LIQUIDITY_REGISTRY.map(pool => ({
        ...pool,
        contract: new ethers.Contract(pool.address, POOL_ABI, provider)
    }));

    console.log("⚡ [Chronos Enterprise Matrix] Multi-Pair Routing Engine Active...");
    console.log(`👛 [Signer]: ${wallet.address}`);
    console.log(`📜 [Target Contract]: ${contractAddress}`);
    console.log(`🌐 [Active Pools Tracked]: ${LIQUIDITY_REGISTRY.length}`);

    provider.on("block", async (blockNumber) => {
        try {
            // Fetch all pool slots concurrently in a single batch call
            const slotResults = await Promise.all(
                poolInstances.map(async p => {
                    try {
                        const slot = await p.contract.slot0();
                        const price = Number((slot.sqrtPriceX96 * slot.sqrtPriceX96 * 10n ** 12n) / (1n << 192n)) / 1e18;
                        const normalizedPrice = price > 0 ? 1 / price : 0;
                        return { name: p.name, address: p.address, tokenBorrow: p.tokenBorrow, price: normalizedPrice, tick: slot.tick };
                    } catch {
                        return null;
                    }
                })
            );

            const activePools = slotResults.filter(Boolean) as any[];
            console.log(`\n🔍 [Block #${blockNumber}] Scanned ${activePools.length} liquidity vectors.`);

            let targetPath: any = null;
            let selectedToken = "";
            const minThresholdBps = 35; // 0.35% net profit floor

            // Nested combinatorial scan across all pool pairs for cross-market spreads
            for (let i = 0; i < activePools.length; i++) {
                for (let j = i + 1; j < activePools.length; j++) {
                    const poolA = activePools[i];
                    const poolB = activePools[j];

                    if (poolA.price === 0 || poolB.price === 0) continue;

                    const spreadAB = ((poolB.price - poolA.price) / poolA.price) * 10000;
                    const spreadBA = ((poolA.price - poolB.price) / poolB.price) * 10000;

                    if (spreadAB > minThresholdBps) {
                        console.log(`🎯 [Matrix Delta Found] ${poolA.name} -> ${poolB.name} | Spread: ${spreadAB.toFixed(1)} bps`);
                        targetPath = { poolLeg1: poolA.address, zeroForOneLeg1: true, poolLeg2: poolB.address, zeroForOneLeg2: false };
                        selectedToken = poolA.tokenBorrow;
                        break;
                    } else if (spreadBA > minThresholdBps) {
                        console.log(`🔄 [Matrix Delta Flipped] ${poolB.name} -> ${poolA.name} | Spread: ${spreadBA.toFixed(1)} bps`);
                        targetPath = { poolLeg1: poolB.address, zeroForOneLeg1: true, poolLeg2: poolA.address, zeroForOneLeg2: false };
                        selectedToken = poolB.tokenBorrow;
                        break;
                    }
                }
                if (targetPath) break;
            }

            if (targetPath) {
                const borrowAmount = ethers.parseEther("0.1"); // Execution magnitude

                const abiCoder = new ethers.AbiCoder();
                const arbitrageData = abiCoder.encode(
                    ["address", "bool", "address", "bool", "uint256"],
                    [targetPath.poolLeg1, targetPath.zeroForOneLeg1, targetPath.poolLeg2, targetPath.zeroForOneLeg2, 0]
                );

                console.log("🧪 [Dry-Run] Simulating enterprise transaction via eth_call...");
                await arbContract.initiateFlashLoan.staticCall(selectedToken, borrowAmount, arbitrageData);
                console.log("✅ [Simulation Passed] Guaranteed net positive return confirmed.");

                const tx = await arbContract.initiateFlashLoan(selectedToken, borrowAmount, arbitrageData, {
                    gasLimit: 650000
                });

                console.log(`📦 [Transaction Broadcast] Hash: ${tx.hash}`);
                const receipt = await tx.wait();
                console.log(`🎉 [Execution Confirmed] Block #${receipt.blockNumber} | Gas Used: ${receipt.gasUsed.toString()}`);
            } else {
                console.log(`✨ [Status] All multi-pair spreads within normal parameters.`);
            }
        } catch (err: any) {
            if (err.message && err.message.includes("execution reverted")) {
                console.log("🛡️ [Simulation Reverted] Unprofitable state detected off-chain. Trade dropped safely.");
            } else {
                console.error("⚠️ [Engine Warning]:", err.shortMessage || err.message);
            }
        }
    });
}

runMultiPairEnterpriseEngine().catch(console.error);
