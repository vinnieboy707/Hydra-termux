import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { VaultWalLedger } from "./vault-wal-ledger.mjs";
dotenv.config();

const norm = (addr) => ethers.getAddress(addr.toLowerCase());

class RouterExecutionEngine {
    constructor() {
        this.logDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
        this.realRunPath = path.join(this.logDir, "real_execution_ledger.jsonl");
        this.errorRegPath = path.join(this.logDir, "error_immunity_registry.jsonl");
        this.knownErrors = new Set();
        this.walLedger = new VaultWalLedger();
        this.walLedger.syncFromJsonl(this.realRunPath);
    }

    logImmunity(context, err) {
        let msg = (err.reason || err.shortMessage || err.message || "UNKNOWN").slice(0, 120);
        const key = `${context}:${msg}`;
        if (this.knownErrors.has(key)) return;
        this.knownErrors.add(key);
        try { fs.appendFileSync(this.errorRegPath, JSON.stringify({ timestamp: new Date().toISOString(), context, error: msg }) + "\n", "utf8"); } catch {}
    }

    recordRealExecution(payload) {
        const record = { timestamp: new Date().toISOString(), ...payload };
        fs.appendFileSync(this.realRunPath, JSON.stringify(record) + "\n", "utf8");
        const taxSplit = this.walLedger.recordSettlement(record);
        console.log(`\n================================================================`);
        console.log(`🚀 [🔥 V3 MULTICALL ON-CHAIN SETTLEMENT] Tx: ${payload.txHash} | Net: +${payload.netSpreadBps}bps`);
        if (payload.sweptAmount) console.log(`💸 [💰 PROFIT DELIVERED TO EOA] +${payload.sweptAmount} ${payload.sweptSymbol} -> ${payload.recipient}`);
        if (taxSplit) console.log(`🏦 [POLICY T1 WAL] Gross: ${taxSplit.gross} ${taxSplit.symbol} | 30% Tax: ${taxSplit.taxReserve30Pct} | 70% Net: ${taxSplit.netWithdrawable70Pct}`);
        console.log(`================================================================\n`);
    }
}

const ARBITRUM_NETWORK = ethers.Network.from(42161);
const ARBITRUM_CONFIG = {
    rpcs: [process.env.ARBITRUM_RPC_URL, "https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com", "https://1rpc.io/arb"].filter(u => u?.startsWith("http")),
    contract: norm(process.env.CONTRACT_ADDRESS),
    multicall3: norm("0xcA11bde05977b3631167028862bE2a173976CA11"),
    weth: { symbol: "WETH", address: norm("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"), decimals: 18 },
    tokens: [
        { symbol: "USDC", address: norm("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"), decimals: 6 },
        { symbol: "USDT", address: norm("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"), decimals: 6 },
        { symbol: "WBTC", address: norm("0x2f2a2543B76a4166549F7aaB2e75Bef0aefC5b0f"), decimals: 8 },
        { symbol: "ARB",  address: norm("0x912CE59144191C1204E64559FE8253a0e49E6548"), decimals: 18 }
    ],
    exchanges: [
        { name: "Uniswap",     factory: norm("0x1F98431c8aD98523631AE4a59f267346ea31F984"), router: norm("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"), routerType: 1 },
        { name: "SushiSwap",   factory: norm("0x1af415a1EbA07a4986a52B6f2e7dE7003D82231e"), router: norm("0x8A21F6768C1f8075791D08546Dadf6daA0bE820c"), routerType: 1 },
        { name: "PancakeSwap", factory: norm("0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"), router: norm("0x1b81D678ffb9C0263b24A97847620C99d213eB14"), routerType: 0 },
        { name: "Camelot",     factory: norm("0x1a3c59160d2d3ce66579cf2f2061e89e000f6074"), router: norm("0x1F721E2E82F6676FCE4eA07A5958cF098D339e18"), routerType: 2 }
    ],
    feeTiers: [100, 500, 3000],
    tranchesWeth: ["0.05", "0.25", "1.0"]
};

const MULTICALL3_ABI = ["function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) external view returns (tuple(bool success, bytes returnData)[])"];
const V3_FACTORY_ABI = ["function getPool(address, address, uint24) external view returns (address)"];
const ALGEBRA_FACTORY_ABI = ["function poolByPair(address, address) external view returns (address)"];
const V3_POOL_ABI = ["function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)", "function liquidity() external view returns (uint128)"];
const ALGEBRA_POOL_ABI = ["function globalState() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)", "function liquidity() external view returns (uint128)"];
const ERC20_ABI = ["function balanceOf(address) external view returns (uint256)"];
const WETH_ABI = ["function balanceOf(address) external view returns (uint256)", "function withdraw(uint256) external"];
const CONTRACT_ABI = ["function initiateFlashLoan(address, uint256, bytes) external", "function rescueFunds(address, uint256) external"];

const v3Iface = new ethers.Interface(V3_POOL_ABI);
const algIface = new ethers.Interface(ALGEBRA_POOL_ABI);
const SLOT0_DATA = v3Iface.encodeFunctionData("slot0");
const GLOBAL_DATA = algIface.encodeFunctionData("globalState");
const LIQ_DATA = v3Iface.encodeFunctionData("liquidity");

const createStaticProvider = (url) => new ethers.JsonRpcProvider(url, ARBITRUM_NETWORK, { staticNetwork: ARBITRUM_NETWORK });

async function getHealthyProvider() {
    for (const url of ARBITRUM_CONFIG.rpcs) {
        try {
            const p = createStaticProvider(url);
            const block = await Promise.race([p.getBlockNumber(), new Promise((_, r) => setTimeout(() => r(new Error("TIMEOUT")), 3000))]);
            if (block > 0) { console.log(`🌐 [RPC LOCKED] ${url} @ block #${block}`); return p; }
        } catch {}
    }
    return createStaticProvider("https://arb1.arbitrum.io/rpc");
}

async function discoverAllPools(provider) {
    const discovered = [];
    for (const token of ARBITRUM_CONFIG.tokens) {
        for (const ex of ARBITRUM_CONFIG.exchanges) {
            if (ex.routerType === 2) {
                try {
                    const addr = await new ethers.Contract(ex.factory, ALGEBRA_FACTORY_ABI, provider).poolByPair(ARBITRUM_CONFIG.weth.address, token.address);
                    if (addr && addr !== ethers.ZeroAddress) discovered.push({ ex, token, fee: 500, poolAddr: addr, isAlgebra: true });
                } catch {}
            } else {
                const factory = new ethers.Contract(ex.factory, V3_FACTORY_ABI, provider);
                for (const fee of ARBITRUM_CONFIG.feeTiers) {
                    try {
                        const addr = await factory.getPool(ARBITRUM_CONFIG.weth.address, token.address, fee);
                        if (addr && addr !== ethers.ZeroAddress) discovered.push({ ex, token, fee, poolAddr: addr, isAlgebra: false });
                    } catch {}
                }
            }
        }
    }
    console.log(`📡 [MULTICALL3 REGISTRY] Indexed ${discovered.length} pools across Uniswap, SushiSwap, PancakeSwap & Camelot.`);
    return discovered;
}

async function ensureGasReserve(provider, wallet, engine) {
    const nativeGas = await provider.getBalance(wallet.address);
    if (nativeGas >= ethers.parseEther("0.003")) return nativeGas;
    try {
        const weth = new ethers.Contract(ARBITRUM_CONFIG.weth.address, WETH_ABI, wallet);
        const wethBal = await weth.balanceOf(wallet.address);
        const needed = ethers.parseEther("0.006") - nativeGas;
        const unwrapAmount = wethBal >= needed ? needed : wethBal;
        if (unwrapAmount >= ethers.parseEther("0.0005")) {
            console.log(`⛽ [AUTO GAS TOP-UP] Unwrapping ${ethers.formatEther(unwrapAmount)} WETH -> ETH...`);
            await (await weth.withdraw(unwrapAmount, { gasLimit: 60000 })).wait();
            return await provider.getBalance(wallet.address);
        }
    } catch (err) { engine.logImmunity("AUTO_WETH_UNWRAP_ERROR", err); }
    return nativeGas;
}

async function startAutoExecutionEngine() {
    const engine = new RouterExecutionEngine();
    let provider = await getHealthyProvider();
    let wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    let arbContract = new ethers.Contract(ARBITRUM_CONFIG.contract, CONTRACT_ABI, wallet);
    let multicall = new ethers.Contract(ARBITRUM_CONFIG.multicall3, MULTICALL3_ABI, provider);
    const wethContract = new ethers.Contract(ARBITRUM_CONFIG.weth.address, ERC20_ABI, provider);

    const poolRegistry = await discoverAllPools(provider);
    console.log("⚡ [Chronos V3 Multicall3 + Algebra + Balancer 0-Fee Engine] Active on:", ARBITRUM_CONFIG.contract);

    let lastBlock = 0, rpcIdx = 0;
    setInterval(async () => {
        try {
            const blockNumber = await provider.getBlockNumber();
            if (blockNumber <= lastBlock) return;
            lastBlock = blockNumber;

            const nativeGas = await ensureGasReserve(provider, wallet, engine);
            if (nativeGas < ethers.parseEther("0.002")) return;

            const feeData = await provider.getFeeData();
            if (blockNumber % 10 === 0) {
                console.log(`📡 [V3 MULTICALL HEARTBEAT] Block #${blockNumber} | Gas: ${ethers.formatUnits(feeData.gasPrice || 0n, "gwei")} gwei | ETH: ${ethers.formatEther(nativeGas).slice(0, 8)}`);
            }

            const calls = poolRegistry.flatMap(e => [
                { target: e.poolAddr, allowFailure: true, callData: e.isAlgebra ? GLOBAL_DATA : SLOT0_DATA },
                { target: e.poolAddr, allowFailure: true, callData: LIQ_DATA }
            ]);
            const results = await multicall.aggregate3(calls);
            const activeByToken = new Map();

            for (let i = 0; i < poolRegistry.length; i++) {
                const sRes = results[i * 2], lRes = results[i * 2 + 1];
                if (!sRes.success || !lRes.success || sRes.returnData === "0x" || lRes.returnData === "0x") continue;
                try {
                    const entry = poolRegistry[i];
                    const [liq] = v3Iface.decodeFunctionResult("liquidity", lRes.returnData);
                    if (liq === 0n) continue;
                    const dec = entry.isAlgebra ? algIface.decodeFunctionResult("globalState", sRes.returnData) : v3Iface.decodeFunctionResult("slot0", sRes.returnData);
                    if (!dec[6] || dec[0] === 0n) continue;
                    const fee = entry.isAlgebra ? (Number(dec[2]) || 500) : entry.fee;
                    const sym = entry.token.symbol;
                    if (!activeByToken.has(sym)) activeByToken.set(sym, []);
                    activeByToken.get(sym).push({ ...entry, sqrtPriceX96: dec[0], fee });
                } catch {}
            }

            const priorityGas = (feeData.gasPrice || ethers.parseUnits("0.02", "gwei")) * 140n / 100n;
            const abiCoder = new ethers.AbiCoder();
            const deadline = Math.floor(Date.now() / 1000) + 45;

            for (const [sym, pools] of activeByToken.entries()) {
                for (let i = 0; i < pools.length; i++) {
                    for (let j = 0; j < pools.length; j++) {
                        if (i === j) continue;
                        const p1 = pools[i], p2 = pools[j];
                        const p1Sq = p1.sqrtPriceX96 * p1.sqrtPriceX96, p2Sq = p2.sqrtPriceX96 * p2.sqrtPriceX96;
                        const grossBps = Number(((p1Sq > p2Sq ? p1Sq - p2Sq : p2Sq - p1Sq) * 10000n) / p1Sq);
                        const totalFeeBps = Math.ceil((p1.fee + p2.fee) / 100);
                        if (grossBps <= totalFeeBps + 10) continue;

                        const legs = [
                            { router: p1.ex.router, tokenIn: ARBITRUM_CONFIG.weth.address, tokenOut: p1.token.address, fee: p1.fee, routerType: p1.ex.routerType },
                            { router: p2.ex.router, tokenIn: p2.token.address, tokenOut: ARBITRUM_CONFIG.weth.address, fee: p2.fee, routerType: p2.ex.routerType }
                        ];
                        const arbData = abiCoder.encode(
                            ["tuple(address router, address tokenIn, address tokenOut, uint24 fee, uint8 routerType)[]", "uint256", "uint256"],
                            [legs, 1n, deadline]
                        );

                        for (const trancheStr of ARBITRUM_CONFIG.tranchesWeth) {
                            try {
                                const trancheWei = ethers.parseEther(trancheStr);
                                await arbContract.initiateFlashLoan.staticCall(ARBITRUM_CONFIG.weth.address, trancheWei, arbData, { gasPrice: priorityGas });
                                const preEoaWeth = await wethContract.balanceOf(wallet.address);
                                const tx = await arbContract.initiateFlashLoan(ARBITRUM_CONFIG.weth.address, trancheWei, arbData, { gasLimit: 1100000, gasPrice: priorityGas });
                                const receipt = await tx.wait();
                                const postEoaWeth = await wethContract.balanceOf(wallet.address);
                                const delta = postEoaWeth > preEoaWeth ? postEoaWeth - preEoaWeth : 0n;
                                engine.recordRealExecution({
                                    pair: `${p1.ex.name}(${p1.fee})->${p2.ex.name}(${p2.fee}) WETH/${sym}`,
                                    trancheWeth: trancheStr, netSpreadBps: grossBps - totalFeeBps, txHash: receipt.hash,
                                    ...(delta > 0n ? { sweptAmount: ethers.formatEther(delta), sweptSymbol: "WETH", recipient: wallet.address } : {})
                                });
                                return;
                            } catch (innerErr) { engine.logImmunity(`V3_${p1.ex.name}_${p2.ex.name}_${sym}_${trancheStr}`, innerErr); }
                        }
                    }
                }
            }
        } catch (netErr) {
            engine.logImmunity("RPC_NETWORK_ERROR", netErr);
            rpcIdx = (rpcIdx + 1) % ARBITRUM_CONFIG.rpcs.length;
            provider = createStaticProvider(ARBITRUM_CONFIG.rpcs[rpcIdx]);
            wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            arbContract = new ethers.Contract(ARBITRUM_CONFIG.contract, CONTRACT_ABI, wallet);
            multicall = new ethers.Contract(ARBITRUM_CONFIG.multicall3, MULTICALL3_ABI, provider);
        }
    }, 1000);
}

startAutoExecutionEngine().catch(console.error);
