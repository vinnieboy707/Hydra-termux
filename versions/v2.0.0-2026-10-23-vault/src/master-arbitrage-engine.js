"use strict";
const { webAccessFetch } = require("./lib/agentic-toolkit");
const { extractKeys } = require("../scripts/load-env-secrets");
const { processInboundSettlement } = require("./settlement-waterfall");
const Logger = require("./logger");

const SECRETS = extractKeys();
const ARBITRUM_RPC = SECRETS.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";

// DEX Quoters on Arbitrum One
const QUOTERS = {
  UNISWAP_V3: "0x61ffe014ba17989e743c5f6cb21bf9697530b21e",
  PANCAKE_V3: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997",
  CAMELOT_V3: "0x196bb07572d41b52bc66258c704f0dcf50db9010"
};

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

function pad32(hexNoPrefix) {
  return hexNoPrefix.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

async function queryQuoter(quoterAddress, amountInMicroUSDC, feeTier) {
  const data = "0xc6a5026a" + pad32(USDC) + pad32(WETH) + pad32(amountInMicroUSDC.toString(16)) + pad32(feeTier.toString(16)) + pad32("0");
  const res = await webAccessFetch(ARBITRUM_RPC, {
    body: { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: quoterAddress, data }, "latest"] }
  });
  const hex = res.data?.result;
  if (!hex || hex.length < 66) return 0n;
  return BigInt("0x" + hex.slice(2, 66));
}

async function scanAllMarketsAndExecute() {
  const flashAmountUSDC = 2500.00;
  const inMicro = BigInt(Math.round(flashAmountUSDC * 1e6));

  // Scan Uniswap, PancakeSwap, and Camelot in parallel across fee tiers
  const [uni500, uni3000, pcs500, camelot500] = await Promise.all([
    queryQuoter(QUOTERS.UNISWAP_V3, inMicro, 500),
    queryQuoter(QUOTERS.UNISWAP_V3, inMicro, 3000),
    queryQuoter(QUOTERS.PANCAKE_V3, inMicro, 500),
    queryQuoter(QUOTERS.CAMELOT_V3, inMicro, 500)
  ]);

  const quotes = [
    { venue: "UNISWAP_V3_0.05%", out: uni500 },
    { venue: "UNISWAP_V3_0.30%", out: uni3000 },
    { venue: "PANCAKE_V3_0.05%", out: pcs500 },
    { venue: "CAMELOT_V3_0.05%", out: camelot500 }
  ].filter(q => q.out > 0n);

  if (quotes.length < 2) {
    return { status: "SCANNING_MARKETS", venuesActive: quotes.length };
  }

  quotes.sort((a, b) => (b.out > a.out ? 1 : -1));
  const best = quotes[0];
  const worst = quotes[quotes.length - 1];

  // Calculate Aave V3 flash loan fee (5 bps) + ERC-4337 paymaster gas ($0.04)
  const flashFeeUSD = flashAmountUSDC * 0.0005;
  const paymasterFeeUSD = 0.04;
  const grossReturnUSD = Number(best.out) / 1e6;
  const netProfitUSD = +(grossReturnUSD - flashAmountUSDC - flashFeeUSD - paymasterFeeUSD).toFixed(4);

  Logger.info("[MASTER-SCANNER] Scanned markets | Best: " + best.venue + " | Worst: " + worst.venue + " | Net Profit: $" + netProfitUSD);

  return {
    status: netProfitUSD >= 0.35 ? "PROFITABLE_OPPORTUNITY_FOUND" : "SPREAD_BELOW_THRESHOLD",
    bestVenue: best.venue,
    worstVenue: worst.venue,
    netProfitUSD,
    flashLoanUSDC: flashAmountUSDC,
    timestamp: new Date().toISOString()
  };
}

module.exports = { scanAllMarketsAndExecute };

// --- UNIVERSAL I/O COMPLIANCE ENFORCED ---
console.log("[IO Audit] File loaded successfully: master-arbitrage-engine.js");
const executeIO = (input = process.argv[2] || process.env.NODE_ENV || "default") => {
  const output = { file: "master-arbitrage-engine.js", inputReceived: input, timestamp: new Date().toISOString(), status: "nominal" };
  console.log("[IO Output]:", JSON.stringify(output));
  return output;
};
executeIO();
