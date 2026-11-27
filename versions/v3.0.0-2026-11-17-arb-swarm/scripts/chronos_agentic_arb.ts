import { ethers } from "ethers";
import { ChronosLedger } from "../src/ledger";
require("dotenv").config();

// --- ABI DEFINITIONS ---
const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const CONTRACT_ABI = [
    "function initiateFlashLoan(address tokenToBorrow, uint256 borrowAmount, bytes calldata arbitrageData) external"
];

// Multi-Exchange Liquidity Matrix (Arbitrum One)
const EXCHANGE_TOOL_REGISTRY = [
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
    }
];

async function runIntegratedAgenticEngine() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error("❌ [Config Error] CONTRACT_ADDRESS missing in environment.");
        process.exit(1);
    }

    const arbContract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    const ledger = new ChronosLedger();

    const poolInstances = EXCHANGE_TOOL_REGISTRY.map(pool => ({
        ...pool,
        contract: new ethers.Contract(pool.address, POOL_ABI, provider)
    }));

    console.log("⚡ [Chronos Autonomous Agent] Integrated Execution Matrix Active...");
    console.log(`👛 [Agent Signer]: ${wallet.address}`);
    console.log(`📜 [Target Contract]: ${contractAddress}`);

    provider.on("block", async (blockNumber) => {
        try {
            // 1. Ingest live telemetry concurrently across exchanges
            const slotResults = await Promise.all(
                poolInstances.map(async p => {
                    try {
                        const slot = await p.contract.slot0();
                        const price = Number((slot.sqrtPriceX96 * slot.sqrtPriceX96 * 10n ** 12n) / (1n << 192n)) / 1e18;
                        const normalizedPrice = price > 0 ? 1 / price : 0;
                        return { exchange: p.exchange, pair: p.pair, address: p.address, tokenBorrow: p.tokenBorrow, price: normalizedPrice };
                    } catch {
                        return null;
                    }
                })
            );

            const activePools = slotResults.filter(Boolean) as any[];
            console.log(`\n🔍 [Block #${blockNumber}] Evaluated ${activePools.length} exchange liquidity pools.`);

            let selectedRoute: any = null;
            let bestSpread = 0;
            const minProfitThresholdBps = 30; // 0.30% net profit floor

            // 2. Dual-Direction Permutation Analysis
            for (let i = 0; i < activePools.length; i++) {
                for (let j = i + 1; j < activePools.length; j++) {
                    const poolA = activePools[i];
                    const poolB = activePools[j];

                    if (poolA.price === 0 || poolB.price === 0) continue;

                    const spreadAB = ((poolB.price - poolA.price) / poolA.price) * 10000;
                    const spreadBA = ((poolA.price - poolB.price) / poolB.price) * 10000;

                    if (spreadAB > bestSpread && spreadAB > minProfitThresholdBps) {
                        bestSpread = spreadAB;
                        selectedRoute = {
                            poolLeg1: poolA.address,
                            zeroForOneLeg1: true,
                            poolLeg2: poolB.address,
                            zeroForOneLeg2: false,
                            tokenBorrow: poolA.tokenBorrow,
                            route: `${poolA.exchange} ➔ ${poolB.exchange}`
                        };
                    } else if (spreadBA > bestSpread && spreadBA > minProfitThresholdBps) {
                        bestSpread = spreadBA;
                        selectedRoute = {
                            poolLeg1: poolB.address,
                            zeroForOneLeg1: true,
                            poolLeg2: poolA.address,
                            zeroForOneLeg2: false,
                            tokenBorrow: poolB.tokenBorrow,
                            route: `${poolB.exchange} ➔ ${poolA.exchange} (Flipped)`
                        };
                    }
                }
            }

            if (selectedRoute) {
                console.log(`🎯 [Opportunity Identified] Route: ${selectedRoute.route} | Spread: ${bestSpread.toFixed(1)} bps`);

                const borrowAmount = ethers.parseEther("0.1"); // 0.1 WETH test execution size
                const abiCoder = new ethers.AbiCoder();
                const arbitrageData = abiCoder.encode(
                    ["address", "bool", "address", "bool", "uint256"],
                    [selectedRoute.poolLeg1, selectedRoute.zeroForOneLeg1, selectedRoute.poolLeg2, selectedRoute.zeroForOneLeg2, 0]
                );

                // 3. EVM Static Simulation (`eth_call` Dry-Run)
                console.log("🧪 [Simulation] Running eth_call dry-run against Balancer Vault and DEX routers...");
                await arbContract.initiateFlashLoan.staticCall(selectedRoute.tokenBorrow, borrowAmount, arbitrageData);
                console.log("✅ [Simulation Passed] Solvency and profitability verified.");

                // 4. On-Chain Execution Dispatch
                const tx = await arbContract.initiateFlashLoan(selectedRoute.tokenBorrow, borrowAmount, arbitrageData, {
                    gasLimit: 650000
                });

                console.log(`📦 [Broadcasted] Hash: ${tx.hash}`);
                const receipt = await tx.wait();
                console.log(`🎉 [Settled] Block #${receipt.blockNumber} | Gas Used: ${receipt.gasUsed.toString()}`);

                // 5. Immutable Ledger Record
                ledger.record({
                    timestamp: new Date().toISOString(),
                    blockNumber,
                    exchangeRoute: selectedRoute.route,
                    borrowAmount: borrowAmount.toString(),
                    simulatedProfit: `${bestSpread.toFixed(1)} bps`,
                    actualGasUsed: receipt.gasUsed.toString(),
                    txHash: tx.hash,
                    status: "SUCCESS"
                });

            } else {
                console.log(`✨ [Status] Markets balanced. Zero capital exposed.`);
            }
        } catch (err: any) {
            if (err.message && err.message.includes("execution reverted")) {
                console.log("🛡️ [Fail-Closed Triggered] Unprofitable state detected during simulation. Trade dropped safely; zero gas wasted.");
                ledger.record({
                    timestamp: new Date().toISOString(),
                    blockNumber,
                    exchangeRoute: "N/A",
                    borrowAmount: "0",
                    simulatedProfit: "0",
                    actualGasUsed: "0",
                    txHash: "",
                    status: "REVERTED_OFFCHAIN"
                });
            } else {
                console.error("⚠️ [Engine Warning]:", err.shortMessage || err.message);
            }
        }
    });
}

runIntegratedAgenticEngine().catch(console.error);
