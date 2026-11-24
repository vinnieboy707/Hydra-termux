const { execSync } = require("child_process");
const path = require("path");
const dbPath = path.resolve(__dirname, "../data/chronos_production.db");
try {
  execSync('sqlite3 "' + dbPath + '" "CREATE TABLE IF NOT EXISTS verified_revenue_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER NOT NULL, chain TEXT NOT NULL, tx_hash TEXT UNIQUE, gross_yield_usd REAL NOT NULL, net_cleared_usd REAL NOT NULL, gas_used_gwei REAL NOT NULL, status TEXT NOT NULL);" 2>/dev/null');
} catch (_) {}

try {
  execSync('sqlite3 "' + dbPath + '" "CREATE TABLE IF NOT EXISTS verified_revenue_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp INTEGER NOT NULL, chain TEXT NOT NULL, tx_hash TEXT UNIQUE, gross_yield_usd REAL NOT NULL, net_cleared_usd REAL NOT NULL, gas_used_gwei REAL NOT NULL, status TEXT NOT NULL);" 2>/dev/null');
} catch (_) {}

// =======================================================
// APEX v3.0 DYNAMIC GAS SCALING & SQLITE LEDGER PERSISTENCE
// =======================================================



const BASE_MIN_SPREAD_THRESHOLD = 0.0020; // 20 bps base floor

function calculateDynamicArbitrageYield(spread, expectedTradeSizeUsd, gasGwei) {
  const grossYieldUsd = expectedTradeSizeUsd * spread;
  const totalSwapFeeUsd = expectedTradeSizeUsd * 0.0010; // 10 bps two-hop DEX fees
  const gasCostUsd = (gasGwei * 1e9 * 180000 / 1e18) * 2480; // Estimated 180k gas @ $2,480 ETH
  const netYieldUsd = grossYieldUsd - totalSwapFeeUsd - gasCostUsd;
  
  // Dynamic threshold: scales based on gas cost to secure >= 2.5x overhead coverage
  const requiredBps = Math.max(BASE_MIN_SPREAD_THRESHOLD, (gasCostUsd * 2.5 / expectedTradeSizeUsd) + 0.0010);
  const isActionable = netYieldUsd >= 2.50 && spread >= requiredBps;

  return { netYieldUsd, requiredBps, isActionable };
}


function recordVerifiedYield(chain, txHash, grossUsd, netUsd, gasGwei) {
  try {
    const q = "INSERT OR IGNORE INTO verified_revenue_ledger (timestamp, chain, tx_hash, gross_yield_usd, net_cleared_usd, gas_used_gwei, status) VALUES (" + Date.now() + ", '" + chain + "', '" + txHash + "', " + grossUsd + ", " + netUsd + ", " + gasGwei + ", 'CONFIRMED_CLEARED');";
    execSync('sqlite3 "' + dbPath + '" "' + q + '"');
  } catch (_) {}
}



// ==========================================
// APEX v3.0 PRIVATE MEV BUILDER DISPATCH
// ==========================================
const PRIVATE_RELAYS = [
  process.env.ARBITRUM_PRIVATE_RELAY || "https://rpc.titanbuilder.xyz",
  "https://arb1.arbitrum.io/rpc"
];

async function broadcastPrivateTx(signedRawTx) {
  require('./send-guard').assertLiveAllowed('broadcastPrivateTx');
  for (const relay of PRIVATE_RELAYS) {
    try {
      const res = await fetch(relay, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_sendRawTransaction",
          params: [signedRawTx]
        })
      });
      const data = await res.json();
      if (data && data.result) return data.result;
    } catch (_) {}
  }
  return null;
}


// ==========================================
// APEX v3.0 PROFIT HURDLE & FLASH LOAN GATES
// ==========================================
const MIN_SPREAD_THRESHOLD = 0.0035; // 35 bps minimum hurdle (covers DEX fees + L1 rollup gas)
const MIN_NET_PROFIT_USD = 2.50;     // Fail-closed threshold: minimum $2.50 verified clear profit

function calculateNetArbitrageYield(spread, expectedTradeSizeUsd, gasGwei) {
  const grossYieldUsd = expectedTradeSizeUsd * spread;
  // Two-hop DEX swap fee (Uniswap 5 bps + SushiSwap 5 bps = 10 bps min)
  const totalSwapFeeUsd = expectedTradeSizeUsd * 0.0010;
  // Estimated L2 execution gas cost in USD (Arbitrum ~180k gas units)
  const gasCostUsd = (gasGwei * 1e9 * 180000 / 1e18) * 2480; 
  const netYieldUsd = grossYieldUsd - totalSwapFeeUsd - gasCostUsd;
  return { netYieldUsd, isActionable: netYieldUsd >= MIN_NET_PROFIT_USD && spread >= MIN_SPREAD_THRESHOLD };
}


function sanitizeAddress(addr) {
  if (!addr || typeof addr !== "string") return "0x0000000000000000000000000000000000000000";
  const cleaned = addr.replace(/[^0-9a-fA-F]/g, "");
  return ("0x" + cleaned.slice(-40)).toLowerCase();
}
'use strict';
const { ethers } = require("ethers");
const { ingestVerifiedTransaction } = require('./revenue_engine_247');

const RPC_URL = process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Verified Uniswap V3 USDC/WETH Pool on Ethereum Mainnet
const UNISWAP_V3_USDC_WETH = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
const UNISWAP_V3_WETH_USDT_POOL = "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36";

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const uniPool = new ethers.Contract(UNISWAP_V3_USDC_WETH, POOL_ABI, provider);
const sushiPool = new ethers.Contract(UNISWAP_V3_WETH_USDT_POOL, POOL_ABI, provider);

console.log("🚀 [Arbitrage Execution Engine] Armed and scanning real-time L2 liquidity corridors...");

const META_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function factory() view returns (address)"
];
const KNOWN_TOKENS = {
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH"
};
const KNOWN_FACTORIES = {
  "0x1f98431c8ad98523631ae4a59f267346ea31f984": "Uniswap V3",
  "0xbaceb8ec6b9355dfc0269c18bac9d6e2bdc29c4f": "SushiSwap V3"
};
const poolInfo = new Map();

async function loadPoolInfo(poolContract) {
  const addr = String(poolContract.target);
  if (poolInfo.has(addr)) return poolInfo.get(addr);
  const meta = new ethers.Contract(addr, META_ABI, provider);
  const [t0, t1, fac] = await Promise.all([meta.token0(), meta.token1(), meta.factory()]);
  const info = {
    s0: KNOWN_TOKENS[t0.toLowerCase()] || t0,
    s1: KNOWN_TOKENS[t1.toLowerCase()] || t1,
    dex: KNOWN_FACTORIES[fac.toLowerCase()] || ("unknown factory " + fac)
  };
  poolInfo.set(addr, info);
  console.log("[POOL] " + addr + " token0=" + info.s0 + " token1=" + info.s1 + " dex=" + info.dex);
  return info;
}

// Returns USD per WETH, or null if bad data / not a WETH-stablecoin pool.
async function fetchPrice(poolContract) {
  try {
    const info = await loadPoolInfo(poolContract);
    const slot0 = await poolContract.slot0();
    const r = Number(slot0.sqrtPriceX96) / Math.pow(2, 96);
    const raw = r * r; // token1 raw units per token0 raw unit
    const stable = (s) => s === "USDC" || s === "USDT";
    let price = null;
    if (info.s0 === "WETH" && stable(info.s1)) price = raw * 1e12;
    else if (stable(info.s0) && info.s1 === "WETH") price = 1e12 / raw;
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch (err) {
    console.error("[-] fetchPrice failed: " + err.message);
    return null;
  }
}

async function executeArbitrageLoop() {
  try {
    const blockNumber = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || 0n;

    const uniPrice = await fetchPrice(uniPool);
    const sushiPrice = await fetchPrice(sushiPool);

    if (uniPrice === null || sushiPrice === null) { console.error('[-] price unavailable, skipping block'); return; }
    const spreadPercentage = Math.abs(((uniPrice - sushiPrice) / sushiPrice) * 100).toFixed(4);
    const gasPriceGwei = ethers.formatUnits(gasPrice, "gwei");

    console.log(`[+] Block #${blockNumber} | Gas: ${parseFloat(gasPriceGwei).toFixed(3)} Gwei | Spread: ${spreadPercentage}% | Uni: $${uniPrice.toFixed(2)} | Pool B (WETH/USDT): $${sushiPrice.toFixed(2)}`);

    if (parseFloat(spreadPercentage) > 5) { console.error('[-] spread ' + spreadPercentage + '% is implausible, treating as data fault'); return; }
    if (parseFloat(spreadPercentage) >= 0.5 && gasPrice < ethers.parseUnits("1.5", "gwei")) {
      console.log(`🔥 [SIMULATED SIGNAL] Spread ${spreadPercentage}% exceeds threshold. Logging only; no execution is wired up.`);
      console.log('[SIMULATED SIGNAL] no transaction sent, nothing booked to the ledger');
    }
  } catch (err) {
    console.error(`[-] Execution Loop Notice: ${err.message}`);
  }
}

setInterval(executeArbitrageLoop, 10000);

process.on('SIGINT', () => {
  console.log("⚙️ [Execution Engine] Gracefully shutting down worker...");
  process.exit(0);
});
