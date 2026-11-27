const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const ChronosErrorImmunityVault = require("./chronos-error-immunity.cjs");
require("dotenv").config();

const immunity = new ChronosErrorImmunityVault();

class ChronosProfitEngine {
    constructor() {
        this.logDir = path.join(process.cwd(), "logs");
        this.dryRunPath = path.join(this.logDir, "dry_run_ledger.jsonl");
        this.realRunPath = path.join(this.logDir, "real_execution_ledger.jsonl");
        this.statePath = path.join(this.logDir, "autonomous_state.json");
    }

    getBorrowAmount() {
        try {
            if (fs.existsSync(this.statePath)) {
                const data = JSON.parse(fs.readFileSync(this.statePath, "utf8"));
                return BigInt(data.currentBorrowAmountWei || ethers.parseEther("0.1").toString());
            }
        } catch (err) {
            immunity.interceptAndHeal(err, "STATE_LOAD_ERROR");
        }
        return ethers.parseEther("0.1");
    }

    saveBorrowAmount(amountWei) {
        try {
            fs.writeFileSync(this.statePath, JSON.stringify({ currentBorrowAmountWei: amountWei.toString(), updatedAt: new Date().toISOString() }, null, 2));
        } catch (err) {
            immunity.interceptAndHeal(err, "STATE_SAVE_ERROR");
        }
    }

    log(mode, payload) {
        try {
            const entry = JSON.stringify({ timestamp: new Date().toISOString(), mode, ...payload }) + "\n";
            if (mode === "DRY_RUN") {
                fs.appendFileSync(this.dryRunPath, entry, "utf8");
                console.log(`🔬 [PROFIT SCAN] Block #${payload.blockNumber} | Pair: ${payload.pair} | Spread: ${payload.spreadBps} bps | Gas: ${payload.gasPriceGwei} Gwei`);
            } else {
                fs.appendFileSync(this.realRunPath, entry, "utf8");
                console.log(`🚀 [🔥 PROFIT CAPTURED] Block #${payload.blockNumber} | Pair: ${payload.pair} | Tx: ${payload.txHash}`);
            }
        } catch (err) {
            immunity.interceptAndHeal(err, "LEDGER_LOG_ERROR");
        }
    }
}

const POLICY = {
    minNetProfitBps: 25,         // Minimum 0.25% profit
    maxGasLimit: 750000,         // Hard gas ceiling
    minGasBalanceEth: 0.005,     // Wallet balance safety floor
    gasFluctuationBufferMultiplier: 1.5
};

const TOKENS = {
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    WBTC: { address: "0x2F2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
    ARB:  { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18 }
};

const FACTORIES = {
    UniswapV3: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    SushiSwapV3: "0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e"
};

const FACTORY_ABI = ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"];
const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() external view returns (address)",
    "function liquidity() external view returns (uint128)"
];
const CONTRACT_ABI = ["function initiateUniversalFlashLoan(uint8 providerType, address tokenToBorrow, uint256 borrowAmount, bytes calldata arbitrageData) external"];

const PAIRS = [
    { name: "WETH/USDC", tokenA: "WETH", tokenB: "USDC", fees: [500, 100] },
    { name: "WBTC/WETH", tokenA: "WBTC", tokenB: "WETH", fees: [500, 3000, 100] },
    { name: "ARB/WETH",  tokenA: "ARB",  tokenB: "WETH", fees: [3000, 500, 100] }
];

async function startImmuneEngine() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    let provider;
    try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
    } catch (err) {
        immunity.interceptAndHeal(err, "PROVIDER_INIT_ERROR");
        return;
    }

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error("❌ [Config Error] CONTRACT_ADDRESS missing in environment variables.");
        process.exit(1);
    }

    const arbContract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    const engine = new ChronosProfitEngine();
    let currentBorrowAmount = engine.getBorrowAmount();

    console.log("⚡ [Chronos Immune Profit Engine] Active, Self-Healing & Profit-Focused...");
    console.log(`👛 [Signer Wallet]: ${wallet.address}`);
    console.log(`📜 [Smart Contract]: ${contractAddress}`);
    console.log(`💰 [Active Flash Loan Tranche]: ${ethers.formatEther(currentBorrowAmount)} WETH\n`);

    provider.on("block", async (blockNumber) => {
        try {
            const balanceWei = await provider.getBalance(wallet.address);
            const balanceEth = Number(ethers.formatEther(balanceWei));
            if (balanceEth < POLICY.minGasBalanceEth) return;

            const feeData = await provider.getFeeData();
            const currentGasPriceWei = feeData.gasPrice || ethers.parseUnits("0.01", "gwei");
            const gasPriceGwei = Number(ethers.formatUnits(currentGasPriceWei, "gwei"));

            for (const pair of PAIRS) {
                const tA = TOKENS[pair.tokenA];
                const tB = TOKENS[pair.tokenB];
                const dexResults = {};

                for (const [dexName, factoryAddress] of Object.entries(FACTORIES)) {
                    for (const fee of pair.fees) {
                        try {
                            const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
                            const poolAddress = await factory.getPool(tA.address, tB.address, fee);
                            if (!poolAddress || poolAddress === ethers.ZeroAddress) continue;

                            const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
                            const [slot0, token0Addr] = await Promise.all([pool.slot0(), pool.token0()]);

                            const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
                            if (sqrtPriceX96 === 0n || !slot0.unlocked) continue;

                            const isToken0A = token0Addr.toLowerCase() === tA.address.toLowerCase();
                            const decimals0 = isToken0A ? tA.decimals : tB.decimals;
                            const decimals1 = isToken0A ? tB.decimals : tA.decimals;

                            const q96 = 2n ** 96n;
                            const priceRatio = Number(sqrtPriceX96 * sqrtPriceX96) / Number(q96 * q96);
                            const adjustedPrice = priceRatio * (10 ** (decimals0 - decimals1));
                            const spotPrice = isToken0A ? 1 / adjustedPrice : adjustedPrice;

                            dexResults[dexName] = { poolAddress, spotPrice };
                            break;
                        } catch (poolErr) {
                            // Suppress and isolate pool-level query failures without crashing daemon
                        }
                    }
                }

                if (dexResults.UniswapV3 && dexResults.SushiSwapV3) {
                    const pUni = dexResults.UniswapV3.spotPrice;
                    const pSushi = dexResults.SushiSwapV3.spotPrice;
                    if (pUni <= 0 || pSushi <= 0) continue;

                    const spreadUniSushi = ((pSushi - pUni) / pUni) * 10000;
                    const spreadSushiUni = ((pUni - pSushi) / pSushi) * 10000;

                    let targetRoute = null;
                    let spreadBps = 0;

                    if (spreadUniSushi >= POLICY.minNetProfitBps) {
                        targetRoute = {
                            poolLeg1: dexResults.UniswapV3.poolAddress, zf1: true,
                            poolLeg2: dexResults.SushiSwapV3.poolAddress, zf2: false,
                            token: tA.address, route: "UniswapV3 ➔ SushiSwapV3"
                        };
                        spreadBps = spreadUniSushi;
                    } else if (spreadSushiUni >= POLICY.minNetProfitBps) {
                        targetRoute = {
                            poolLeg1: dexResults.SushiSwapV3.poolAddress, zf1: true,
                            poolLeg2: dexResults.UniswapV3.poolAddress, zf2: false,
                            token: tA.address, route: "SushiSwapV3 ➔ UniswapV3"
                        };
                        spreadBps = spreadSushiUni;
                    }

                    if (targetRoute) {
                        engine.log("DRY_RUN", {
                            blockNumber,
                            pair: pair.name,
                            route: targetRoute.route,
                            spreadBps: Number(spreadBps.toFixed(1)),
                            gasPriceGwei: Number(gasPriceGwei.toFixed(4))
                        });

                        const abiCoder = new ethers.AbiCoder();
                        const arbitrageData = abiCoder.encode(
                            ["address", "bool", "address", "bool", "uint256"],
                            [targetRoute.poolLeg1, targetRoute.zf1, targetRoute.poolLeg2, targetRoute.zf2, 0]
                        );

                        try {
                            // Pre-flight staticCall simulation
                            await arbContract.initiateUniversalFlashLoan.staticCall(0, targetRoute.token, currentBorrowAmount, arbitrageData, {
                                gasPrice: currentGasPriceWei
                            });

                            console.log(`🚀 [Profit Execution] Dispatching flash loan for ${pair.name} at ${spreadBps.toFixed(1)} bps...`);
                            const tx = await arbContract.initiateUniversalFlashLoan(0, targetRoute.token, currentBorrowAmount, arbitrageData, {
                                gasLimit: POLICY.maxGasLimit,
                                gasPrice: currentGasPriceWei
                            });
                            await tx.wait();

                            const profitEst = currentBorrowAmount * BigInt(Math.floor(spreadBps)) / 10000n;
                            currentBorrowAmount += profitEst / 2n;
                            engine.saveBorrowAmount(currentBorrowAmount);

                            engine.log("REAL_EXECUTION", { blockNumber, pair: pair.name, route: targetRoute.route, spreadBps: Number(spreadBps.toFixed(1)), txHash: tx.hash, newTranche: currentBorrowAmount.toString() });
                            return;
                        } catch (execErr) {
                            immunity.interceptAndHeal(execErr, "FLASH_LOAN_EXECUTION_FAILURE");
                        }
                    }
                }
            }
        } catch (blockErr) {
            immunity.interceptAndHeal(blockErr, "BLOCK_POLLING_FAILURE");
        }
    });
}

startImmuneEngine().catch(err => {
    immunity.interceptAndHeal(err, "FATAL_ENGINE_CRASH");
});
