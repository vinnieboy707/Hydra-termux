const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

class ChronosHighYieldEngine {
    constructor() {
        this.logDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
        this.errorRegPath = path.join(this.logDir, "error_immunity_registry.jsonl");
        this.dryRunPath = path.join(this.logDir, "dry_run_ledger.jsonl");
        this.realRunPath = path.join(this.logDir, "real_execution_ledger.jsonl");
        this.statePath = path.join(this.logDir, "autonomous_state.json");
        this.knownErrors = new Set();
    }

    logErrorOnce(err, context) {
        const msg = (err.shortMessage || err.reason || err.message || "UNKNOWN_ERROR").slice(0, 220);
        const key = `${context}:${msg}`;
        if (this.knownErrors.has(key)) return;
        this.knownErrors.add(key);

        const record = {
            timestamp: new Date().toISOString(),
            context,
            error: msg,
            policyStatus: "IMMUNIZED_SINGLE_ENTRY"
        };
        try {
            fs.appendFileSync(this.errorRegPath, JSON.stringify(record) + "\n", "utf8");
        } catch {}
        console.warn(`🛡️ [Immunity Recorded] [${context}]: ${msg}`);
    }

    getState() {
        try {
            if (fs.existsSync(this.statePath)) {
                return JSON.parse(fs.readFileSync(this.statePath, "utf8"));
            }
        } catch {}
        return {
            currentBorrowAmountWei: ethers.parseEther("0.008").toString(), // Optimal starting liquidity tranche
            totalRealizedProfitWei: "0",
            policyT1TaxReserveWei: "0"
        };
    }

    saveState(state) {
        try {
            fs.writeFileSync(this.statePath, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
        } catch (e) {
            this.logErrorOnce(e, "STATE_SAVE");
        }
    }

    recordLedger(mode, payload) {
        const entry = JSON.stringify({ timestamp: new Date().toISOString(), mode, ...payload }) + "\n";
        if (mode === "DRY_RUN") {
            fs.appendFileSync(this.dryRunPath, entry, "utf8");
            console.log(`🔬 [High-Yield Scan] Block #${payload.blockNumber} | ${payload.pair} | ${payload.route} | Spread: ${payload.spreadBps} bps | Tranche: ${payload.trancheEth} ETH`);
        } else {
            fs.appendFileSync(this.realRunPath, entry, "utf8");
            const grossWei = BigInt(payload.grossProfitWei || "0");
            const taxReserveWei = (grossWei * 30n) / 100n; // Policy T1: 30% tax reserve
            console.log(`\n================================================================`);
            console.log(`🚀 [🔥 REAL ON-CHAIN HIGH-YIELD FLASH LOAN EXECUTED]`);
            console.log(`📈 Pair: ${payload.pair} | Spread: ${payload.spreadBps} bps`);
            console.log(`🔍 TxHash: ${payload.txHash}`);
            console.log(`🏦 Policy T1 Tax Reserve (30%): ${ethers.formatEther(taxReserveWei)} WETH`);
            console.log(`💰 New Tranche Principal: ${ethers.formatEther(payload.newTrancheWei)} WETH`);
            console.log(`================================================================\n`);
        }
    }
}

const POLICY = {
    minNetProfitBps: 8,          // 8 bps (0.08%) hurdle
    maxGasLimit: 850000,
    minBalanceEth: 0.0004,
    pollIntervalMs: 2500
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
    "function token1() external view returns (address)",
    "function liquidity() external view returns (uint128)"
];
const CONTRACT_ABI = ["function initiateFlashLoan(address tokenToBorrow, uint256 borrowAmount, bytes calldata arbitrageData) external"];

const PAIRS = [
    { name: "WETH/USDC", tokenA: "WETH", tokenB: "USDC", fees: [500, 100, 3000] },
    { name: "WBTC/WETH", tokenA: "WBTC", tokenB: "WETH", fees: [500, 3000, 100] },
    { name: "ARB/WETH",  tokenA: "ARB",  tokenB: "WETH", fees: [3000, 500, 100] }
];

async function startHighYieldEngine() {
    const engine = new ChronosHighYieldEngine();
    const rpcUrl = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x232B196e6efa9455de1072092f7F3aB3D2870501";

    const arbContract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
    let state = engine.getState();
    let currentTranche = BigInt(state.currentBorrowAmountWei);
    let lastBlockScanned = 0;
    let isScanning = false;

    const initBal = await provider.getBalance(wallet.address);
    console.log("⚡ [Chronos High-Yield Engine] Fully Activated & Scanning...");
    console.log(`👛 [Signer]: ${wallet.address} | Gas Balance: ${ethers.formatEther(initBal)} ETH`);
    console.log(`📜 [Contract]: ${contractAddress}`);
    console.log(`💰 [Adaptive Tranche]: ${ethers.formatEther(currentTranche)} WETH\n`);

    setInterval(async () => {
        if (isScanning) return;
        isScanning = true;
        try {
            const blockNumber = await provider.getBlockNumber();
            if (blockNumber <= lastBlockScanned) {
                isScanning = false;
                return;
            }
            lastBlockScanned = blockNumber;

            const [balanceWei, feeData] = await Promise.all([
                provider.getBalance(wallet.address),
                provider.getFeeData()
            ]);
            const balanceEth = Number(ethers.formatEther(balanceWei));
            const currentGasPrice = feeData.gasPrice || ethers.parseUnits("0.02", "gwei");
            const gasPriceGwei = Number(ethers.formatUnits(currentGasPrice, "gwei"));

            let scanSummary = [];

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
                            const [slot0, token0Addr, token1Addr, liq] = await Promise.all([
                                pool.slot0(),
                                pool.token0(),
                                pool.token1(),
                                pool.liquidity()
                            ]);

                            const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
                            if (sqrtPriceX96 === 0n || !slot0.unlocked || BigInt(liq) === 0n) continue;

                            const isToken0A = token0Addr.toLowerCase() === tA.address.toLowerCase();
                            const decimals0 = isToken0A ? tA.decimals : tB.decimals;
                            const decimals1 = isToken0A ? tB.decimals : tA.decimals;

                            const priceRatio = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
                            const adjustedPrice = priceRatio * (10 ** (decimals0 - decimals1));
                            const spotPrice = isToken0A ? adjustedPrice : (1 / adjustedPrice);

                            dexResults[dexName] = { poolAddress, spotPrice, token0: token0Addr, token1: token1Addr, liquidity: BigInt(liq) };
                            break;
                        } catch {}
                    }
                }

                if (dexResults.UniswapV3 && dexResults.SushiSwapV3) {
                    const pUni = dexResults.UniswapV3.spotPrice;
                    const pSushi = dexResults.SushiSwapV3.spotPrice;
                    if (pUni <= 0 || pSushi <= 0) continue;

                    const spreadUniSushi = ((pSushi - pUni) / pUni) * 10000;
                    const spreadSushiUni = ((pUni - pSushi) / pSushi) * 10000;
                    const maxSpread = Math.max(spreadUniSushi, spreadSushiUni);
                    scanSummary.push(`${pair.name}:${maxSpread.toFixed(1)}bps`);

                    let targetRoute = null;
                    let spreadBps = 0;

                    if (spreadUniSushi >= POLICY.minNetProfitBps && spreadUniSushi < 1200) {
                        const pool1 = dexResults.UniswapV3;
                        const pool2 = dexResults.SushiSwapV3;
                        const zf1 = pool1.token0.toLowerCase() === tA.address.toLowerCase();
                        const zf2 = pool2.token0.toLowerCase() !== tA.address.toLowerCase();

                        targetRoute = {
                            poolLeg1: pool1.poolAddress, zf1,
                            poolLeg2: pool2.poolAddress, zf2,
                            token: tA.address, route: "UniswapV3 ➔ SushiSwapV3"
                        };
                        spreadBps = spreadUniSushi;
                    } else if (spreadSushiUni >= POLICY.minNetProfitBps && spreadSushiUni < 1200) {
                        const pool1 = dexResults.SushiSwapV3;
                        const pool2 = dexResults.UniswapV3;
                        const zf1 = pool1.token0.toLowerCase() === tA.address.toLowerCase();
                        const zf2 = pool2.token0.toLowerCase() !== tA.address.toLowerCase();

                        targetRoute = {
                            poolLeg1: pool1.poolAddress, zf1,
                            poolLeg2: pool2.poolAddress, zf2,
                            token: tA.address, route: "SushiSwapV3 ➔ UniswapV3"
                        };
                        spreadBps = spreadSushiUni;
                    }

                    if (targetRoute) {
                        engine.recordLedger("DRY_RUN", {
                            blockNumber,
                            pair: pair.name,
                            route: targetRoute.route,
                            spreadBps: Number(spreadBps.toFixed(1)),
                            trancheEth: ethers.formatEther(currentTranche),
                            gasPriceGwei: Number(gasPriceGwei.toFixed(4))
                        });

                        const minRequiredProfit = (currentTranche * BigInt(Math.floor(POLICY.minNetProfitBps))) / 10000n;
                        const abiCoder = new ethers.AbiCoder();
                        const arbitrageData = abiCoder.encode(
                            ["address", "bool", "address", "bool", "uint256"],
                            [targetRoute.poolLeg1, targetRoute.zf1, targetRoute.poolLeg2, targetRoute.zf2, minRequiredProfit]
                        );

                        try {
                            await arbContract.initiateFlashLoan.staticCall(targetRoute.token, currentTranche, arbitrageData, {
                                gasPrice: currentGasPrice
                            });

                            console.log(`🚀 [EXECUTION DISPATCH] Launching flash loan for ${pair.name} at ${spreadBps.toFixed(1)} bps...`);
                            const tx = await arbContract.initiateFlashLoan(targetRoute.token, currentTranche, arbitrageData, {
                                gasLimit: POLICY.maxGasLimit,
                                gasPrice: currentGasPrice
                            });

                            const receipt = await tx.wait();
                            const grossProfit = (currentTranche * BigInt(Math.floor(spreadBps))) / 10000n;
                            const taxReserve = (grossProfit * 30n) / 100n;
                            const netCompoundedProfit = grossProfit - taxReserve;

                            currentTranche += netCompoundedProfit;
                            state.currentBorrowAmountWei = currentTranche.toString();
                            state.totalRealizedProfitWei = (BigInt(state.totalRealizedProfitWei || "0") + grossProfit).toString();
                            state.policyT1TaxReserveWei = (BigInt(state.policyT1TaxReserveWei || "0") + taxReserve).toString();
                            engine.saveState(state);

                            engine.recordLedger("REAL_EXECUTION", {
                                blockNumber,
                                pair: pair.name,
                                route: targetRoute.route,
                                spreadBps: Number(spreadBps.toFixed(1)),
                                txHash: receipt.hash,
                                grossProfitWei: grossProfit.toString(),
                                newTrancheWei: currentTranche.toString()
                            });
                        } catch (execErr) {
                            engine.logErrorOnce(execErr, `HIGH_YIELD_SIM_${pair.name}`);
                        }
                    }
                }
            }

            console.log(`💓 [Block #${blockNumber}] Gas: ${gasPriceGwei.toFixed(3)} Gwei | ETH: ${balanceEth.toFixed(4)} | Spreads: [${scanSummary.join(" | ")}]`);
        } catch (pollErr) {
            engine.logErrorOnce(pollErr, "ENGINE_POLL_LOOP");
        } finally {
            isScanning = false;
        }
    }, POLICY.pollIntervalMs);
}

startHighYieldEngine().catch(err => console.error("Fatal Engine Crash:", err.message));
