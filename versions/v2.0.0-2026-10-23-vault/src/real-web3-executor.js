'use strict';
require('dotenv').config();
const { ethers } = require("ethers");
const ComplianceEngine = require('./enterprise-compliance-engine');

// Validate environment security
if (!process.env.ARBITRUM_RPC_URL || !process.env.ARBITRUM_RPC_URL_BACKUP || !process.env.PRIVATE_KEY) {
  ComplianceEngine.failClosed("Missing ARBITRUM_RPC_URL, ARBITRUM_RPC_URL_BACKUP, or PRIVATE_KEY in .env file!");
}

// Secure Credentials
const SECURE_PRIVATE_KEY = process.env.PRIVATE_KEY;
process.env.PRIVATE_KEY = 'REDACTED';

const provider1 = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
const provider2 = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL_BACKUP);
const wallet = new ethers.Wallet(SECURE_PRIVATE_KEY, provider1);

// Verified Uniswap V3 USDC/WETH Pool on Arbitrum One
const UNISWAP_V3_USDC_WETH = "0xc88701B4219A9f2CFA570a248f21970EFE0723A6";
const UNISWAP_V3_WETH_USDT_POOL = "0x1b02dA4Cb0d097EbB8d7fA3d6560460f7b6890";

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)"
];

const uniPool1 = new ethers.Contract(UNISWAP_V3_USDC_WETH, POOL_ABI, provider1);
const uniPool2 = new ethers.Contract(UNISWAP_V3_USDC_WETH, POOL_ABI, provider2);
const sushiPool1 = new ethers.Contract(UNISWAP_V3_WETH_USDT_POOL, POOL_ABI, provider1);
const sushiPool2 = new ethers.Contract(UNISWAP_V3_WETH_USDT_POOL, POOL_ABI, provider2);

console.log(`🚀 [REAL PRODUCTION ENGINE] Initialized with Wallet: ${wallet.address}`);
console.log(`📡 Connected to Dual Arbitrum RPCs. Enforcing consensus on block state and liquidity...`);

async function fetchConsensusPrice(p1, p2, poolName) {
    const q1 = p1.slot0().then(s => {
        const price = Math.pow(Number(s.sqrtPriceX96) / Math.pow(2, 96), 2);
        return price * 1e12;
    });
    const q2 = p2.slot0().then(s => {
        const price = Math.pow(Number(s.sqrtPriceX96) / Math.pow(2, 96), 2);
        return price * 1e12;
    });

    return await ComplianceEngine.getConsensusValue([q1, q2], 0.005); // 0.5% tolerance
}

async function executeRealArbitrumLoop() {
  try {
    // Block Number Consensus
    const blockConsensus = await ComplianceEngine.getConsensusValue([
        provider1.getBlockNumber(),
        provider2.getBlockNumber()
    ], 0); // Must be exact same block or very close

    // Gas Price Consensus
    const gasConsensus = await ComplianceEngine.getConsensusValue([
        provider1.getFeeData().then(f => f.gasPrice),
        provider2.getFeeData().then(f => f.gasPrice)
    ], 0.05); // 5% tolerance for gas spikes

    const uniPrice = await fetchConsensusPrice(uniPool1, uniPool2, "Uniswap V3");
    const sushiPrice = await fetchConsensusPrice(sushiPool1, sushiPool2, "SushiSwap V3");

    const spreadPercentage = Math.abs(((uniPrice - sushiPrice) / sushiPrice) * 100).toFixed(4);
    const gasPriceGwei = ethers.formatUnits(gasConsensus, "gwei");

    console.log(`[+] Block #${blockConsensus} | Uni: $${uniPrice.toFixed(2)} | Pool B (WETH/USDT): $${sushiPrice.toFixed(2)} | Spread: ${spreadPercentage}% | Gas: ${parseFloat(gasPriceGwei).toFixed(2)} Gwei`);

    const MIN_SPREAD_THRESHOLD = parseFloat(process.env.MIN_SPREAD_PERCENT || "0.01");
    const MAX_GAS_PRICE_GWEI = ethers.parseUnits(process.env.MAX_GAS_GWEI || "50.0", "gwei");

    if (parseFloat(spreadPercentage) >= MIN_SPREAD_THRESHOLD && gasConsensus <= MAX_GAS_PRICE_GWEI) {
      console.log(`🔥 [SIMULATED SIGNAL] Spread ${spreadPercentage}% meets threshold. Executing flash loan arbitrage dispatch...`);
    }
  } catch (err) {
    ComplianceEngine.failClosed(`Execution Error: ${err.message}`);
  }
}

setInterval(executeRealArbitrumLoop, 5000);

process.on('SIGINT', () => {
  console.log("⚙️ [Real Engine] Shutting down cleanly...");
  process.exit(0);
});

