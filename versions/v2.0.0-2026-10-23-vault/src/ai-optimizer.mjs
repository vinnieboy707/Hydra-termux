import fs from "node:fs";
import path from "node:path";
import { Ledger } from "./ledger.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ledger = new Ledger(path.join(ROOT, "data"), 3000);
const envPath = path.resolve(ROOT, ".env");

async function queryOpenRouterOptimizer(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free",
        messages: [
          {
            role: "system",
            content: "You are an autonomous quantitative trading supervisor for Chronos OS. Analyze telemetry and output ONLY JSON with keys: 'gasMarginBps' (number), 'minNetProfitTokenUnits' (string), 'maxFeeGwei' (number), and 'reason' (string)."
          },
          { role: "user", content: prompt }
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    return JSON.parse(text.trim().replace(/^```json|```$/g, ""));
  } catch (e) {
    console.error("⚠️ AI Optimizer telemetry error:", e.message);
    return null;
  }
}

async function optimizationLoop() {
  console.log("🧠 Autonomous AI Profit Optimizer active. Monitoring logs and tuning parameters...");
  
  setInterval(async () => {
    try {
      const summary = ledger.summary();
      const logPath = path.join(ROOT, "data", "ledger.jsonl");
      let recentLogs = "";
      if (fs.existsSync(logPath)) {
        const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
        recentLogs = lines.slice(-10).join("\n");
      }

      const prompt = `Current ledger state: ${JSON.stringify(summary)}. Recent activity: ${recentLogs}. Propose parameter adjustments for GAS_COST_MARGIN_BPS, MIN_NET_PROFIT_TOKEN_UNITS, and MAX_FEE_GWEI to maximize profitable execution while maintaining fail-closed safety.`;
      
      const recommendation = await queryOpenRouterOptimizer(prompt);
      if (recommendation && recommendation.gasMarginBps) {
        console.log(`💡 AI Optimization Proposal: ${recommendation.reason}`);
        
        // Safely update .env parameters
        let envContent = fs.readFileSync(envPath, "utf8");
        envContent = envContent.replace(/^GAS_COST_MARGIN_BPS=.*/m, `GAS_COST_MARGIN_BPS=${recommendation.gasMarginBps}`);
        if (recommendation.maxFeeGwei) {
          envContent = envContent.replace(/^MAX_FEE_GWEI=.*/m, `MAX_FEE_GWEI=${recommendation.maxFeeGwei}`);
        }
        fs.writeFileSync(envPath, envContent, "utf8");
        console.log("✅ .env parameters dynamically tuned by AI supervisor.");
      }
    } catch (err) {
      console.error("❌ Optimizer loop error:", err.message);
    }
  }, 60000); // Check and adapt every 60 seconds
}

optimizationLoop();
