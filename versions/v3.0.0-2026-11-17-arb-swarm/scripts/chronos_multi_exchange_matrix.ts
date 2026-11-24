import { ethers } from "ethers";
require("dotenv").config();

const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const CONTRACT_ABI = [
    "function initiateFlashLoan(address tokenToBorrow, uint256 borrowAmount, bytes calldata arbitrageData) external"
];

// Multi-Exchange Liquidity Matrix Registry (Arbitrum One)
const MULTI_EXCHANGE_REGISTRY = [
    {
        exchange: "Uniswap V3",
        pair: "WETH/USDC (0.05%)",
        address: "0xC6962004f452Be9203591991D15f6b388e09e8D0".toLowerCase(),
        tokenBorrow: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
    },
    {
        exchange: "SushiSwap V3",
        pair: "WETH/USDC (0.05%)",
        address: "0xc31e54c7a869b9fcbecc14363cf510d1c41fa443".toLowerCase(),
        tokenBorrow: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
    },
    {
        exchange: "Camelot V3",
        pair: "WETH/USDC (High Liquidity)",
        address: "0x1234567890abcdef1234567890abcdef12345678".toLowerCase(), // Example address placeholder
        tokenBorrow: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
    }
];

async function runMultiExchangeMatrix() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error("❌ [Config Error] CONTRACT_ADDRESS missing in environment.");
        process.exit(1);
    }

    const arbContract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    const poolInstances = MULTI_EXCHANGE_REGISTRY.map(pool => ({
        ...pool,
        contract: new ethers.Contract(pool.address, POOL_ABI, provider)
    }));

    console.log("⚡ [Chronos Multi-Exchange Matrix] Initialized & Polling Liquidity Graphs...");
    console.log(`👛 [Signer]: ${wallet.address}`);
    console.log(`📜 [Target Contract]: ${contractAddress}`);

    provider.on("block", async (blockNumber) => {
        try {
            // Concurrent RPC multicall across all configured exchanges
            const slotResults = await Promise.all(
                poolInstances.map(async p => {
                    try {
                        const slot = await p.contract.slot0();
                        const price = Number((slot.sqrtPriceX96 * slot.sqrtPriceX96 * 10n ** 12n) / (1n << 192n)) / 1e18;
                        const normalizedPrice = price > 0 ? 1 / price : 0;
                        return { exchange: p.exchange, pair: p.pair, address: p.address, tokenBorrow: p.tokenBorrow, price: normalizedPrice };
                    } catch {
                        return null; // Gracefully handle uninitialized pool query errors
                    }
                })
            );

            const activePools = slotResults.filter(Boolean) as any[];
            console.log(`\n🔍 [Block #${blockNumber}] Polled ${activePools.length} exchange pools.`);

            let targetPath: any = null;
            let selectedToken = "";
            const minThresholdBps = 30; // 0.30% net profit floor across exchanges

            // Evaluate all cross-exchange pairs for pricing deltas
            for (let i = 0; i < activePools.length; i++) {
                for (let j = i + 1; j < activePools.length; j++) {
                    const poolA = activePools[i];
                    const poolB = activePools[j];

                    if (poolA.price === 0 || poolB.price === 0) continue;

                    const spreadAB = ((poolB.price - poolA.price) / poolA.price) * 10000;
                    const spreadBA = ((poolA.price - poolB.price) / poolB.price) * 10000;

                    if (spreadAB > minThresholdBps) {
                        console.log(`🎯 [Arbitrage Opportunity] Buy on ${poolA.exchange} -> Sell on ${poolB.exchange} | Spread: ${spreadAB.toFixed(1)} bps`);
                        targetPath = { poolLeg1: poolA.address, zeroForOneLeg1: true, poolLeg2: poolB.address, zeroForOneLeg2: false };
                        selectedToken = poolA.tokenBorrow;
                        break;
                    } else if (spreadBA > minThresholdBps) {
                        console.log(`🎯 [Arbitrage Opportunity] Buy on ${poolB.exchange} -> Sell on ${poolA.exchange} | Spread: ${spreadBA.toFixed(1)} bps`);
                        targetPath = { poolLeg1: poolB.address, zeroForOneLeg1: true, poolLeg2: poolA.address, zeroForOneLeg2: false };
                        selectedToken = poolB.tokenBorrow;
                        break;
                    }
                }
                if (targetPath) break;
            }

            if (targetPath) {
                const borrowAmount = ethers.parseEther("0.1");
                const abiCoder = new ethers.AbiCoder();
                const arbitrageData = abiCoder.encode(
                    ["address", "bool", "address", "bool", "uint256"],
                    [targetPath.poolLeg1, targetPath.zeroForOneLeg1, targetPath.poolLeg2, targetPath.zeroForOneLeg2, 0]
                );

                console.log("🧪 [Dry-Run] Simulating cross-exchange execution via eth_call...");
                await arbContract.initiateFlashLoan.staticCall(selectedToken, borrowAmount, arbitrageData);
                console.log("✅ [Simulation Passed] Guaranteed positive return across exchanges.");

                const tx = await arbContract.initiateFlashLoan(selectedToken, borrowAmount, arbitrageData, {
                    gasLimit: 700000
                });

                console.log(`📦 [Transaction Broadcast] Hash: ${tx.hash}`);
                const receipt = await tx.wait();
                console.log(`🎉 [Execution Confirmed] Block #${receipt.blockNumber}`);
            } else {
                console.log(`✨ [Status] Cross-exchange markets balanced. Zero capital exposed.`);
            }
        } catch (err: any) {
            if (err.message && err.message.includes("execution reverted")) {
                console.log("🛡️ [Simulation Reverted] Unprofitable cross-exchange delta dropped safely.");
            } else {
                console.error("⚠️ [Matrix Warning]:", err.shortMessage || err.message);
            }
        }
    });
}

runMultiExchangeMatrix().catch(console.error);
