import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { Ledger } from "./ledger.mjs";
import { syncTradeToFirebase } from "./firebase-sync.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ABI = [
  "function execute(uint8 provider, address token, uint256 amount, tuple(address router, bytes path, uint256 minOut)[] legs, uint256 minNetProfit)",
  "event ProfitSwept(address indexed token, uint256 amountBorrowed, uint256 fee, uint256 profit, address treasury)",
];
const PROVIDERS = { BALANCER: 0, AAVE: 1, MORPHO: 2 };

function env(k, dflt) {
  const v = process.env[k] ?? dflt;
  if (v === undefined || v === "") throw new Error(`Missing required env ${k}`);
  return v;
}

export function loadConfig() {
  return {
    rpcUrl: env("RPC_URL"),
    privateRpcUrl: env("PRIVATE_RPC_URL", "https://rpc.flashbots.net/fast"),
    chainId: BigInt(env("CHAIN_ID", "42161")),
    contract: ethers.getAddress(env("CONTRACT_ADDRESS")),
    privateKey: env("EXECUTOR_PRIVATE_KEY"),
    maxFeeGwei: env("MAX_FEE_GWEI", "30"),
    priorityFeeGwei: env("PRIORITY_FEE_GWEI", "1"),
    gasMarginBps: BigInt(env("GAS_COST_MARGIN_BPS", "2000")),
    minNetProfit: BigInt(env("MIN_NET_PROFIT_TOKEN_UNITS", "0")),
    reserveBps: Number(env("RESERVE_BPS", "3000")),
    dryRun: env("DRY_RUN", "true") !== "false",
    killFile: env("KILL_FILE", path.join(ROOT, "KILL")),
    maxConsecutiveFailures: Number(env("MAX_CONSECUTIVE_FAILURES", "5")),
    receiptTimeoutMs: Number(env("RECEIPT_TIMEOUT_MS", "90000")),
    ai: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.AI_MODEL || "claude-3-5-sonnet-20241022",
      required: env("AI_REQUIRED", "false") === "true",
    },
    dataDir: env("DATA_DIR", path.join(ROOT, "data")),
  };
}

function encodePath(tokens, fees) {
  if (tokens.length < 2 || fees.length !== tokens.length - 1) throw new Error("bad path spec");
  const types = [];
  const vals = [];
  tokens.forEach((t, i) => {
    types.push("address");
    vals.push(ethers.getAddress(t));
    if (i < fees.length) {
      types.push("uint24");
      vals.push(fees[i]);
    }
  });
  return ethers.solidityPacked(types, vals);
}

function validateOpportunity(o) {
  if (!(o.provider in PROVIDERS)) throw new Error("provider must be BALANCER, AAVE or MORPHO");
  const token = ethers.getAddress(o.token);
  const amount = BigInt(o.amount);
  if (amount <= 0n) throw new Error("amount must be > 0");
  if (!Array.isArray(o.legs) || o.legs.length < 1 || o.legs.length > 4) throw new Error("1-4 legs required");

  let cur = token.toLowerCase();
  const legs = o.legs.map((l, i) => {
    if (l.tokens[0].toLowerCase() !== cur) throw new Error(`leg ${i}: path does not start at ${cur}`);
    cur = l.tokens[l.tokens.length - 1].toLowerCase();
    return { router: ethers.getAddress(l.router), path: encodePath(l.tokens, l.fees), minOut: BigInt(l.minOut) };
  });
  if (cur !== token.toLowerCase()) throw new Error("legs do not form a closed cycle in the borrowed token");

  const expectedProfit = BigInt(o.expectedProfit);
  const nativeToToken = BigInt(o.nativeToToken);
  if (nativeToToken <= 0n) throw new Error("nativeToToken must be > 0");
  return { provider: o.provider, token, amount, legs, expectedProfit, nativeToToken };
}

async function aiVeto(cfg, summary) {
  if (!cfg.ai.apiKey || !cfg.ai.model) {
    if (cfg.ai.required) return { approve: false, reason: "AI required but not configured" };
    return { approve: true, reason: "AI disabled" };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.ai.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.ai.model,
        max_tokens: 200,
        system: "You are a risk gate for an on-chain arbitrage bot. Reply with ONLY JSON: {\"approve\":boolean,\"reason\":string}.",
        messages: [{ role: "user", content: JSON.stringify(summary) }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const text = body.content?.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text.trim().replace(/^```json|```$/g, ""));
    return { approve: parsed.approve === true, reason: String(parsed.reason ?? "") };
  } catch (e) {
    return cfg.ai.required
      ? { approve: false, reason: `AI error (fail-closed): ${e.message}` }
      : { approve: true, reason: `AI error ignored: ${e.message}` };
  }
}

export async function dispatch(rawOpportunity, cfg = loadConfig()) {
  const ledger = new Ledger(cfg.dataDir, cfg.reserveBps);

  if (fs.existsSync(cfg.killFile)) return { sent: false, reason: "kill switch file present" };
  if (ledger.summary().consecutiveFailures >= cfg.maxConsecutiveFailures)
    return { sent: false, reason: "circuit breaker open" };

  const opp = validateOpportunity(rawOpportunity);
  const readProvider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const wallet = new ethers.Wallet(cfg.privateKey, readProvider);
  const contractRead = new ethers.Contract(cfg.contract, ABI, wallet);

  const maxFee = ethers.parseUnits(cfg.maxFeeGwei, "gwei");
  const tip = ethers.parseUnits(cfg.priorityFeeGwei, "gwei");
  const block = await readProvider.getBlock("latest");
  const base = block.baseFeePerGas ?? 0n;
  if (base * 2n + tip > maxFee) return { sent: false, reason: `gas too high (base ${base})` };

  let gasEst;
  try {
    gasEst = await contractRead.execute.estimateGas(PROVIDERS[opp.provider], opp.token, opp.amount, opp.legs, 1n);
  } catch (e) {
    return { sent: false, reason: `simulation reverted: ${e.shortMessage ?? e.message}` };
  }

  const gasLimit = (gasEst * 120n) / 100n;
  const worstGasWei = gasLimit * (base * 2n + tip > maxFee ? maxFee : base * 2n + tip);
  const gasCostToken = (worstGasWei * opp.nativeToToken) / 10n ** 18n;

  let minNetProfit = (gasCostToken * (10000n + cfg.gasMarginBps)) / 10000n + cfg.minNetProfit;
  if (minNetProfit < 1n) minNetProfit = 1n;
  if (opp.expectedProfit < minNetProfit)
    return { sent: false, reason: `expected profit ${opp.expectedProfit} < required ${minNetProfit}` };

  try {
    await contractRead.execute.staticCall(PROVIDERS[opp.provider], opp.token, opp.amount, opp.legs, minNetProfit, { gasLimit });
  } catch (e) {
    return { sent: false, reason: `not profitable at threshold: ${e.shortMessage ?? e.message}` };
  }

  const ai = await aiVeto(cfg, { provider: opp.provider, token: opp.token, profit: opp.expectedProfit.toString() });
  if (!ai.approve) return { sent: false, reason: `AI veto: ${ai.reason}` };

  if (cfg.dryRun) return { sent: false, dryRun: true, minNetProfit: minNetProfit.toString(), gasLimit: gasLimit.toString(), ai };

  const relay = new ethers.JsonRpcProvider(cfg.privateRpcUrl);
  const relayWallet = new ethers.Wallet(cfg.privateKey, relay);
  const contractSend = new ethers.Contract(cfg.contract, ABI, relayWallet);

  const nonce = await readProvider.getTransactionCount(wallet.address, "pending");
  let tx;
  try {
    tx = await contractSend.execute(PROVIDERS[opp.provider], opp.token, opp.amount, opp.legs, minNetProfit, {
      gasLimit, maxFeePerGas: maxFee, maxPriorityFeePerGas: tip, nonce, type: 2,
    });
  } catch (e) {
    ledger.recordFailure("submit_error", { message: e.shortMessage ?? e.message });
    return { sent: false, reason: `submit failed: ${e.message}` };
  }

  let receipt;
  try {
    receipt = await readProvider.waitForTransaction(tx.hash, 1, cfg.receiptTimeoutMs);
  } catch {
    receipt = null;
  }
  if (!receipt || receipt.status !== 1) {
    ledger.recordFailure("reverted_onchain", { txHash: tx.hash });
    return { sent: true, txHash: tx.hash, status: "reverted" };
  }

  const iface = new ethers.Interface(ABI);
  let profit = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== cfg.contract.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "ProfitSwept") profit = parsed.args.profit;
    } catch {}
  }
  const gasCostWei = receipt.gasUsed * receipt.gasPrice;
  const gasCostTokenActual = (gasCostWei * opp.nativeToToken) / 10n ** 18n;
  ledger.recordProfit({ txHash: tx.hash, token: opp.token, profit, gasCostToken: gasCostTokenActual });
  await syncTradeToFirebase({ txHash: tx.hash, token: opp.token, profit: profit.toString(), status: "success" });

  return { sent: true, txHash: tx.hash, status: "success", profit: profit.toString() };
}
