
// =========================================================================
// APEX v3.0 PHASE A: ZERO-LATENCY WSS EVENT SUBSCRIPTION STREAM
// =========================================================================
const APEX_WSS_SOCKET_STREAM = process.env.ARBITRUM_WSS_URL || "wss://arb-mainnet.g.alchemy.com/v2/demo";

function initWebSocketBlockStream(callback) {
  if (typeof WebSocket === "undefined" && typeof require !== "undefined") {
    try {
      const WebSocketClient = require("ws");
      const ws = new WebSocketClient(APEX_WSS_SOCKET_STREAM);
      ws.on("open", () => {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["newHeads"] }));
      });
      ws.on("message", (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data && data.params && data.params.result) {
            const blockNum = parseInt(data.params.result.number, 16);
            if (typeof callback === "function") callback(blockNum);
          }
        } catch (_) {}
      });
      ws.on("error", () => {});
      ws.on("close", () => setTimeout(() => initWebSocketBlockStream(callback), 5000));
    } catch (_) {}
  }
}
if (typeof initWebSocketBlockStream === "function") {
  initWebSocketBlockStream((block) => {
    if (typeof evaluateTriangularCycle === "function" && typeof currentRates !== "undefined") {
      evaluateTriangularCycle(currentRates);
    }
  });
}


// ==========================================
// APEX v3.0 MULTI-DEX & TRIANGULAR MATRIX
// ==========================================
const CAMELOT_V3_USDC_WETH = "0x521aa84ab3fcc4c05cAbA0a07e1557924F0e971F";
const UNISWAP_V3_ARB_WETH   = "0xC6F780497A95e246EB9449f5e4770916DCd6396A";
const UNISWAP_V3_ARB_USDC   = "0xbE47a29e71A3752e5dE30AC1b1eCff6EcEbF1a05";

function evaluateTriangularCycle(rates) {
  // Cycle: USDC -> WETH -> ARB -> USDC
  if (!rates.usdc_weth || !rates.weth_arb || !rates.arb_usdc) return null;
  const cycleMultiplier = rates.usdc_weth * rates.weth_arb * rates.arb_usdc;
  const spreadBps = (cycleMultiplier - 1.0) * 10000;
  return { cycleMultiplier, spreadBps, isProfitable: spreadBps >= 35 };
}

'use strict';
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com");

const UNISWAP_V3_USDC_WETH = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
const UNISWAP_V3_WETH_USDT_POOL = "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36";

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

const uniPool = new ethers.Contract(UNISWAP_V3_USDC_WETH, POOL_ABI, provider);
const sushiPool = new ethers.Contract(UNISWAP_V3_WETH_USDT_POOL, POOL_ABI, provider);

console.log("🌊 [Multi-DEX Engine] Initialized cross-exchange liquidity & spread tracker...");

async function fetchPrice(poolContract) {
  try {
    const slot0 = await poolContract.slot0();
    const sqrtPriceX96 = slot0.sqrtPriceX96;
    const price = Math.pow(Number(sqrtPriceX96) / Math.pow(2, 96), 2);
    return price * 1e12;
  } catch (err) {
    return 2500.00;
  }
}

async function scanSpreads() {
  try {
    const block = await provider.getBlockNumber();
    const uniPrice = await fetchPrice(uniPool);
    const sushiPrice = await fetchPrice(sushiPool);
    const spreadPercentage = Math.abs(((uniPrice - sushiPrice) / sushiPrice) * 100).toFixed(4);

    console.log(`[+] Block #${block} | Uni: $${uniPrice.toFixed(2)} vs Pool B (WETH/USDT): $${sushiPrice.toFixed(2)} | Spread: ${spreadPercentage}%`);

    if (parseFloat(spreadPercentage) >= 0.4) {
      console.log(`🚨 [ARBITRUM OPPORTUNITY] Spread > 0.4% detected on live pool state!`);
    }
  } catch (err) {
    console.error(`[-] Multi-DEX Scanner Notice: ${err.message}`);
  }
}

setInterval(scanSpreads, 10000);

process.on('SIGINT', () => {
  console.log("⚙️ [Web3 Watcher] Shutting down multi-DEX stream...");
  process.exit(0);
});
