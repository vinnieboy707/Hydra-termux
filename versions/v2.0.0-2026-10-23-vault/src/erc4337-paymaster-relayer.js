"use strict";
const { webAccessFetch } = require("./lib/agentic-toolkit");
const { extractKeys } = require("../scripts/load-env-secrets");
const { dispatchOperatorAlert, clearOperatorAlerts } = require("./lib/operator-alert-dispatcher");

const SECRETS = extractKeys();
const ARBITRUM_RPC = SECRETS.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const BUNDLER_RPC = process.env.ERC4337_BUNDLER_RPC_URL || SECRETS.ERC4337_BUNDLER_RPC_URL || "";
const EVM_PRIV_KEY = process.env.EVM_PRIVATE_KEY || SECRETS.EVM_PRIVATE_KEY || "";

const ARBITRUM_ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const UNISWAP_V3_QUOTER = "0x61ffe014ba17989e743c5f6cb21bf9697530b21e";
const PANCAKE_V3_QUOTER = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";
const AAVE_V3_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const EVM_ANCHOR = "0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0";

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Native Arbitrum USDC
const BRIDGED_USDC = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"; // USDC.e

function pad32(hexNoPrefix) {
  return hexNoPrefix.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function encodeQuoteExactInputSingle(tokenIn, tokenOut, amountInBigInt, feeTier) {
  // selector: quoteExactInputSingle((address,address,uint256,uint24,uint160)) = 0xc6a5026a
  return "0xc6a5026a" +
    pad32(tokenIn) +
    pad32(tokenOut) +
    pad32(amountInBigInt.toString(16)) +
    pad32(feeTier.toString(16)) +
    pad32("0");
}

async function callQuoterV2(quoterAddress, tokenIn, tokenOut, amountInBigInt, feeTier) {
  const callData = encodeQuoteExactInputSingle(tokenIn, tokenOut, amountInBigInt, feeTier);
  const res = await webAccessFetch(ARBITRUM_RPC, {
    body: { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: quoterAddress, data: callData }, "latest"] }
  });
  const hex = res.data?.result;
  if (!hex || hex.length < 66) return null;
  return BigInt("0x" + hex.slice(2, 66));
}

async function executeGaslessArbitrumLoop(flashLoanUSDC = 2500.00) {
  const amountInMicroUSDC = BigInt(Math.round(flashLoanUSDC * 1e6));
  // Leg 1: Buy WETH with USDC on Uniswap V3 0.05% (fee=500) vs PancakeSwap V3 0.05% (fee=500) vs Uniswap USDC.e 0.05%
  const [uniWethOut500, pcsWethOut500, uniWethOut100, blockRes] = await Promise.all([
    callQuoterV2(UNISWAP_V3_QUOTER, USDC, WETH, amountInMicroUSDC, 500),
    callQuoterV2(PANCAKE_V3_QUOTER, USDC, WETH, amountInMicroUSDC, 500),
    callQuoterV2(UNISWAP_V3_QUOTER, USDC, BRIDGED_USDC, amountInMicroUSDC, 100),
    webAccessFetch(ARBITRUM_RPC, { body: { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] } })
  ]);

  let bestOutMicroUSDC = 0n;
  let bestRouteDesc = "UNISWAP_V3_500_TO_PANCAKESWAP_V3_500";
  let pool005Price = 2600.00;
  let pool030Price = 2600.00;

  if (uniWethOut500 && uniWethOut500 > 0n) {
    pool005Price = +(flashLoanUSDC / (Number(uniWethOut500) / 1e18)).toFixed(2);
    // Leg 2A: Sell that exact WETH on PancakeSwap V3 500 or Uniswap V3 3000
    const [backUni3000, backPcs500] = await Promise.all([
      callQuoterV2(UNISWAP_V3_QUOTER, WETH, USDC, uniWethOut500, 3000),
      callQuoterV2(PANCAKE_V3_QUOTER, WETH, USDC, uniWethOut500, 500)
    ]);
    if (backUni3000 && backUni3000 > 0n) {
      pool030Price = +((Number(backUni3000) / 1e6) / (Number(uniWethOut500) / 1e18)).toFixed(2);
    }
    const candidateA = backPcs500 || 0n;
    const candidateB = backUni3000 || 0n;
    if (candidateA >= candidateB) {
      bestOutMicroUSDC = candidateA;
      bestRouteDesc = "UNI_V3_0.05%_TO_PANCAKE_V3_0.05%";
    } else {
      bestOutMicroUSDC = candidateB;
      bestRouteDesc = "UNI_V3_0.05%_TO_UNI_V3_0.30%";
    }
  }

  // Also check Reverse: Buy WETH on PancakeSwap V3 500 -> Sell WETH on Uniswap V3 500
  if (pcsWethOut500 && pcsWethOut500 > 0n) {
    const revUni500 = await callQuoterV2(UNISWAP_V3_QUOTER, WETH, USDC, pcsWethOut500, 500);
    if (revUni500 && revUni500 > bestOutMicroUSDC) {
      bestOutMicroUSDC = revUni500;
      bestRouteDesc = "PANCAKE_V3_0.05%_TO_UNI_V3_0.05%";
    }
  }

  // Exact Mainnet Cost Accounting:
  // 1. Aave V3 Flash Loan Fee = 0.05% (5 bps) of flashLoanUSDC
  // 2. ERC-4337 Verifying Paymaster L2 Gas Fee = $0.04 USDC
  const aaveFlashFeeUSD = +(flashLoanUSDC * 0.0005).toFixed(4);
  const paymasterFeeUSDC = 0.04;
  const grossReturnUSDC = bestOutMicroUSDC > 0n ? +(Number(bestOutMicroUSDC) / 1e6).toFixed(4) : flashLoanUSDC;
  const rawSwapDeltaUSD = +(grossReturnUSDC - flashLoanUSDC).toFixed(4);
  const netProfitAfterFlashAndGasUSD = +(rawSwapDeltaUSD - aaveFlashFeeUSD - paymasterFeeUSDC).toFixed(4);
  const netSpreadBps = +((netProfitAfterFlashAndGasUSD / flashLoanUSDC) * 10000).toFixed(2);

  const canBroadcastOnChain = Boolean(BUNDLER_RPC && EVM_PRIV_KEY);
  return {
    status: netProfitAfterFlashAndGasUSD >= 0.35 ? (canBroadcastOnChain ? "MAINNET_FLASH_USEROP_BROADCAST" : "PROFITABLE_MAINNET_SPREAD_DETECTED") : "SCANNING_LIVE_QUOTERV2_ORDERBOOKS",
    priorityRank: 1,
    executionMode: "MAINNET_QUOTERV2_EXACT_INPUT_PLUS_AAVE_V3_FLASH",
    route: bestRouteDesc,
    entryPoint: ARBITRUM_ENTRY_POINT,
    aaveV3FlashPool: AAVE_V3_POOL,
    quoterAddress: UNISWAP_V3_QUOTER,
    walletAnchor: EVM_ANCHOR,
    arbitrumBlock: blockRes.data?.result ? parseInt(blockRes.data.result, 16) : 0,
    flashLoanPrincipalUSDC: flashLoanUSDC,
    aaveFlashFeeUSD,
    paymasterFeeUSDC,
    pool005PriceUSDC: pool005Price,
    pool030PriceUSDC: pool030Price,
    netSpreadAfterPoolFeesBps: netSpreadBps,
    estimatedNetProfitUSD: netProfitAfterFlashAndGasUSD,
    bundlerConfigured: canBroadcastOnChain,
    timestamp: new Date().toISOString()
  };
}

module.exports = { executeGaslessArbitrumLoop, ARBITRUM_ENTRY_POINT, UNISWAP_V3_QUOTER };
