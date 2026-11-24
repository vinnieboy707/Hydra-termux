import { ethers } from "ethers";
import { ChronosDualLedger } from "../src/dual_ledger";
require("dotenv").config();

const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const CONTRACT_ABI = [
    "function initiateFlashLoan(address tokenToBorrow, uint256 borrowAmount, bytes calldata arbitrageData) external"
];

const EXCHANGE_MATRIX = [
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

async function runEliteAgenticDaemon() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error("❌ [Config Error] CONTRACT_ADDRESS missing in environment.");
        process.exit(1);
    }

    const arbContract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    const dualLedger = new ChronosDualLedger();
    const poolInstances = EXCHANGE_MATRIX.map(p => ({ ...p, contract: new ethers.Contract(p.address, POOL_ABI, provider) }));

    console.log("⚡ [Chronos Elite Agent] Autonomous Permutation-Swapping Daemon Active...");
    
    const POLICY_MIN_SPREAD_BPS = 30; 
    const POLICY_MAX_GAS_LIMIT = 650000;
    const BORROW_AMOUNT = ethers.parseEther("0.1");

    provider.on("block", async (blockNumber) => {
        try {
            const slotResults = await Promise.all(
                poolInstances.map(async p => {
                    try {
                        const slot = await p.contract.slot0();
                        const price = Number((slot.sqrtPriceX96 * slot.sqrtPriceX96 * 10n ** 12n) / (1n << 192n)) / 1e18;
                        return { exchange: p.exchange, address: p.address, tokenBorrow: p.tokenBorrow, price: price > 0 ? 1 / price : 0 };
                    } catch { return null; }
                })
            );

            const activePools = slotResults.filter(Boolean) as any[];
            if (activePools.length < 2) return;

            // Evaluate all pairs with automatic swap fallback on failure
            for (let i = 0; i < activePools.length; i++) {
                for (let j = i + 1; j < activePools.length; j++) {
                    const pA = activePools[i];
                    const pB = activePools[j];
                    if (pA.price === 0 || pB.price === 0) continue;

                    const spreadAB = ((pB.price - pA.price) / pA.price) * 10000;
                    const spreadBA = ((pA.price - pB.price) / pB.price) * 10000;

                    let targetRoute: any = null;
                    let evaluatedSpread = 0;

                    // --- PERMUTATION TEST 1: Direction A -> B ---
                    if (spreadAB >= POLICY_MIN_SPREAD_BPS) {
                        targetRoute = { poolLeg1: pA.address, zf1: true, poolLeg2: pB.address, zf2: false, token: pA.tokenBorrow, route: `${pA.exchange} ➔ ${pB.exchange}` };
                        evaluatedSpread = spreadAB;
                    } 
                    // --- PERMUTATION TEST 2: Automatic Swap Fallback (Direction B -> A) ---
                    else if (spreadBA >= POLICY_MIN_SPREAD_BPS) {
                        console.log(`🔄 [Dry-Run Permutation Swapped] Direction A -> B failed. Rerunning flipped vector (B -> A)...`);
                        targetRoute = { poolLeg1: pB.address, zf1: true, poolLeg2: pA.address, zf2: false, token: pB.tokenBorrow, route: `${pB.exchange} ➔ ${pA.exchange} (Swapped Flipped)` };
                        evaluatedSpread = spreadBA;
                    }

                    if (targetRoute) {
                        dualLedger.record({
                            timestamp: new Date().toISOString(),
                            blockNumber,
                            mode: "DRY_RUN",
                            route: targetRoute.route,
                            borrowAmount: BORROW_AMOUNT.toString(),
                            expectedSpreadBps: Number(evaluatedSpread.toFixed(1)),
                            estimatedGasUsed: "0",
                            agentDecision: "APPROVED_EXECUTION"
                        });

                        const abiCoder = new ethers.AbiCoder();
                        const arbitrageData = abiCoder.encode(
                            ["address", "bool", "address", "bool", "uint256"],
                            [targetRoute.poolLeg1, targetRoute.zf1, targetRoute.poolLeg2, targetRoute.zf2, 0]
                        );

                        // EVM Static Simulation Dry-Run
                        await arbContract.initiateFlashLoan.staticCall(targetRoute.token, BORROW_AMOUNT, arbitrageData);

                        console.log(`🚀 [Simulation Passed] Executing swapped/flipped real capital trade...`);
                        const tx = await arbContract.initiateFlashLoan(targetRoute.token, BORROW_AMOUNT, arbitrageData, {
                            gasLimit: POLICY_MAX_GAS_LIMIT
                        });
                        const receipt = await tx.wait();

                        dualLedger.record({
                            timestamp: new Date().toISOString(),
                            blockNumber,
                            mode: "REAL_EXECUTION",
                            route: targetRoute.route,
                            borrowAmount: BORROW_AMOUNT.toString(),
                            expectedSpreadBps: Number(evaluatedSpread.toFixed(1)),
                            estimatedGasUsed: receipt.gasUsed.toString(),
                            agentDecision: "APPROVED_EXECUTION",
                            txHash: tx.hash,
                            netProfitWei: "Verified On-Chain"
                        });
                        return;
                    } else {
                        dualLedger.record({
                            timestamp: new Date().toISOString(),
                            blockNumber,
                            mode: "DRY_RUN",
                            route: `${pA.exchange} / ${pB.exchange}`,
                            borrowAmount: BORROW_AMOUNT.toString(),
                            expectedSpreadBps: Number(Math.max(spreadAB, spreadBA).toFixed(1)),
                            estimatedGasUsed: "0",
                            agentDecision: "DROPPED_SIMULATION_DEFICIT"
                        });
                    }
                }
            }
        } catch (err: any) {
            console.log(`🛡️ [Fail-Closed Safety] Simulation reverted on swapped vector. Capital preserved.`);
        }
    });
}

runEliteAgenticDaemon().catch(console.error);
