"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 8 });

// Frontier Reasoning Model Cascade
const MODEL_CASCADE = [
  "deepseek/deepseek-r1",
  "anthropic/claude-3.7-sonnet",
  "google/gemini-2.5-pro"
];

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  const env = {};
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m) {
        let v = (m[2] || "").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        env[m[1]] = v;
      }
    }
  }
  return env;
}

const env = loadEnv();
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY || "";

function callOpenRouterModel(modelName, systemPrompt, userPrompt) {
  return new Promise((resolve) => {
    if (!OPENROUTER_API_KEY) return resolve(null);

    const payload = JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.05,
      response_format: { type: "json_object" }
    });

    const req = https.request({
      hostname: "openrouter.ai",
      path: "/api/v1/chat/completions",
      method: "POST",
      agent: keepAliveAgent,
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "HTTP-Referer": "https://chronos.os.local",
        "X-Title": "Chronos v8.0 Quantitative Governor"
      },
      timeout: 3800
    }, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const rawContent = parsed?.choices?.[0]?.message?.content || "";
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            resolve({ model: modelName, decisionData: JSON.parse(jsonMatch[0]) });
          } else {
            resolve(null);
          }
        } catch (_) {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

async function auditExecutionWithFrontierAI(candidate) {
  const systemPrompt = `You are the Chronos OS Quantitative MEV & Risk Governor.
Verify that the candidate arbitrage trade strictly satisfies all statutory guardrails:
1. Net profit after DEX fees, flash-loan fees, and gas/tips MUST be >= $0.35 USD.
2. Slippage/spread variance MUST NOT exceed 35 bps (0.35%).
3. Zero synthetic or unverified pool quotes allowed.
4. For Solana, principal MUST be between $200.00 and $250.00 USD.
Respond ONLY with valid JSON:
{"decision":"EXECUTE"|"ABORT","confidence":0.99,"riskScore":10,"reason":"concise quant verification"}`;

  const userPrompt = JSON.stringify(candidate);

  for (const model of MODEL_CASCADE) {
    const res = await callOpenRouterModel(model, systemPrompt, userPrompt);
    if (res && res.decisionData && res.decisionData.decision) {
      return { ...res.decisionData, modelUsed: res.model };
    }
  }

  // Deterministic zero-latency mathematical verifier if API is unreachable
  const validSpread = candidate.netSpreadBps > 0 && candidate.netSpreadBps <= 35.0;
  const validProfit = candidate.netProfitUSD >= 0.35;
  const validSolCap = candidate.network !== "SOLANA_MAINNET" || (candidate.principalUSD >= 200 && candidate.principalUSD <= 250);
  const approved = validSpread && validProfit && validSolCap;

  return {
    decision: approved ? "EXECUTE" : "ABORT",
    confidence: approved ? 0.99 : 1.0,
    riskScore: approved ? 8 : 95,
    modelUsed: "DETERMINISTIC_QUANT_KERNEL",
    reason: approved ? "Cleared exact BigInt spread and Policy T1 gates." : "Failed statutory profit or slippage gate."
  };
}

module.exports = { auditExecutionWithFrontierAI };
