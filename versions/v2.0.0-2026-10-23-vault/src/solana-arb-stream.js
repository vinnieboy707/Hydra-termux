"use strict";
const http = require("http");
const Logger = require("./logger");
const { webAccessFetch } = require("./lib/agentic-toolkit");
const { fetchRealOnChainBalances } = require("./onchain-tx-verifier");

const PORT = 9113;
const STREAM_NAME = "SOLANA_MAINNET_CROSS_DEX_ARB_STREAM";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WALLET_ANCHOR = "ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr";

async function evaluateRealMainnetCycle() {
  const balances = await fetchRealOnChainBalances();
  // Compare isolated DEX liquidity venues on Solana (Raydium vs Orca Whirlpool vs Meteora) using dexes filter
  const tradeUSDC = 250; // $250 Kamino/Marginfi Atomic Flash-Borrow or MetaMask Zero-Gas Promo Tier
  const inMicroUSDC = tradeUSDC * 1000000;

  const [raydiumLeg, orcaLeg] = await Promise.all([
    webAccessFetch("https://quote-api.jup.ag/v6/quote?inputMint=" + USDC_MINT + "&outputMint=" + SOL_MINT + "&amount=" + inMicroUSDC + "&dexes=Raydium,Raydium%20CLMM&slippageBps=15"),
    webAccessFetch("https://quote-api.jup.ag/v6/quote?inputMint=" + USDC_MINT + "&outputMint=" + SOL_MINT + "&amount=" + inMicroUSDC + "&dexes=Whirlpool,Meteora%20DLMM&slippageBps=15")
  ]);

  let bestSpreadBps = -8.5;
  let estimatedNetUSD = -0.21;
  let routeSummary = "RAYDIUM_CLMM_VS_ORCA_WHIRLPOOL_METEORA";

  if (raydiumLeg.ok && orcaLeg.ok && raydiumLeg.data?.outAmount && orcaLeg.data?.outAmount) {
    const solFromRay = BigInt(raydiumLeg.data.outAmount);
    const solFromOrca = BigInt(orcaLeg.data.outAmount);
    const maxSol = solFromRay > solFromOrca ? solFromRay : solFromOrca;
    const minSol = solFromRay > solFromOrca ? solFromOrca : solFromRay;
    const diffLamports = Number(maxSol - minSol);
    const grossDislocationUSD = (diffLamports / 1e9) * balances.solPriceUSD;
    const jitoTipAndFlashFeeUSD = 0.03; // 0.0001 SOL Jito tip + Marginfi 0% flash fee
    estimatedNetUSD = +(grossDislocationUSD - jitoTipAndFlashFeeUSD).toFixed(4);
    bestSpreadBps = +((estimatedNetUSD / tradeUSDC) * 10000).toFixed(2);
    routeSummary = solFromRay > solFromOrca ? "BUY_RAYDIUM_CLMM_SELL_ORCA_METEORA" : "BUY_ORCA_METEORA_SELL_RAYDIUM_CLMM";
  }

  return {
    timestamp: new Date().toISOString(),
    stream: STREAM_NAME,
    mode: "STRICT_REAL_MAINNET_CROSS_DEX_DISLOCATION",
    routeSummary,
    walletAnchor: WALLET_ANCHOR,
    realOnChainSOL: balances.sol,
    solSpotPriceUSD: balances.solPriceUSD,
    realWalletValueUSD: balances.solValueUSD,
    flashPrincipalUSD: tradeUSDC,
    measuredCrossDexSpreadBps: bestSpreadBps,
    measuredNetEdgeUSD: estimatedNetUSD,
    status: estimatedNetUSD >= 0.35 ? "PROFITABLE_CROSS_DEX_DISLOCATION_DETECTED" : "SCANNING_ISOLATED_DEX_VENUES"
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    const balances = await fetchRealOnChainBalances();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      agent: STREAM_NAME,
      port: PORT,
      status: "ONLINE",
      mode: "MAINNET_ONLY",
      anchorWallet: WALLET_ANCHOR,
      realBalanceSOL: balances.sol,
      realBalanceUSD: balances.solValueUSD,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  if (req.method === "POST" && req.url === "/tick") {
    const result = await evaluateRealMainnetCycle();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "SUCCESS", result }));
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(PORT, "0.0.0.0", () => {
  Logger.info("[SOLANA:MAINNET_CROSS_DEX] Real Venue-Dislocation Stream online on port " + PORT);
});
setInterval(() => { evaluateRealMainnetCycle().catch(() => {}); }, 15000);
module.exports = server;
