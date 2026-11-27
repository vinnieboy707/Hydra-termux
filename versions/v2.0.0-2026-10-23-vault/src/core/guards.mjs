import fs from "node:fs";
import path from "node:path";
import { config } from "./boot.mjs";
import { recent } from "../db/json-ledger.mjs";

const { root, policy: P } = config;
const KILL = path.join(root, "KILL_SWITCH");

export function fatal(msg) {
  console.error(`[guard] FATAL: ${msg}`);
  process.exit(78);
}

// One executor per wallet: no stacked or duplicate workers, no nonce races
export function acquireLock(name = "executor") {
  const f = path.join(root, "data", `${name}.lock`);
  try {
    fs.writeFileSync(f, String(process.pid), { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const pid = Number(fs.readFileSync(f, "utf8"));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch {}
    if (alive && pid !== process.pid) fatal(`${name} already running (pid ${pid})`);
    fs.writeFileSync(f, String(process.pid));
  }
  process.on("exit", () => { try { fs.unlinkSync(f); } catch {} });
}

// Call at startup and every ~60s. provider = ethers v6 JsonRpcProvider
export async function verifyLiveChain(provider) {
  const net = await provider.getNetwork();
  if (!P.allowedEvmChainIds.includes(Number(net.chainId))) fatal(`wrong chain ${net.chainId}`);
  const client = String(await provider.send("web3_clientVersion", []).catch(() => ""));
  if (/hardhat|anvil|ganache|foundry|fork/i.test(client)) fatal("RPC is a local or forked node");
  const blk = await provider.getBlock("latest");
  if (!blk || Date.now() / 1000 - blk.timestamp > 30) throw new Error("RPC head is stale");
}

export function breakerStatus(now = Date.now() / 1000) {
  const rows = recent(500).filter((r) => r.source === "onchain");
  const net24 = rows.filter((r) => r.ts > now - 86400).reduce((a, r) => a + r.profit_usd, 0);
  if (net24 <= -P.maxDailyLossUsd) return { halt: true, reason: `24h net ${net24.toFixed(2)} USD hit loss cap` };
  let streak = 0;
  for (const r of rows) { if (r.kind === "arb_reverted") streak++; else break; }
  if (streak >= P.maxConsecutiveReverts && now - (rows[0]?.ts ?? 0) < P.cooldownMinutes * 60)
    return { halt: true, reason: `${streak} consecutive reverts, cooling down` };
  return { halt: false };
}

// o: chainId, principalUsd, premiumBps, slippageBps, quotedAtMs, gasUnits, gasPriceWei, ethUsd,
//    simulatedOk, simulatedGrossUsd (both from an eth_call on live state)
export function preTrade(o) {
  const why = [];
  if (fs.existsSync(KILL)) why.push("KILL_SWITCH present");
  const b = breakerStatus(); if (b.halt) why.push(b.reason);
  if (!P.allowedEvmChainIds.includes(o.chainId)) why.push("chain not allowed");
  if (!o.simulatedOk) why.push("no passing live-state simulation");
  if (o.principalUsd > P.maxLoanUsd) why.push("loan above cap");
  if (o.slippageBps > P.maxSlippageBps) why.push("slippage above cap");
  if (Date.now() - o.quotedAtMs > P.maxQuoteAgeMs) why.push("quote stale");
  if (Number(o.gasPriceWei) / 1e9 > P.maxGasPriceGwei) why.push("gas price above cap");
  const gasUsd = (Number(o.gasUnits) * Number(o.gasPriceWei) / 1e18) * o.ethUsd;
  if (gasUsd > P.maxGasCostUsd) why.push("gas cost above cap");
  const premium = (o.principalUsd * o.premiumBps) / 1e4;
  const gross = o.simulatedGrossUsd * (1 - P.profitHaircutBps / 1e4);
  const netUsd = gross - premium - gasUsd;
  if (netUsd < P.minNetProfitUsd) why.push(`net ${netUsd.toFixed(2)} below minimum`);
  if (netUsd < gasUsd * P.minNetToGasRatio) why.push("net/gas ratio too low");
  return { ok: why.length === 0, why, netUsd, gasUsd };
}
