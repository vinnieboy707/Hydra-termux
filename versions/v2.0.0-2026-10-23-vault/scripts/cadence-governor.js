"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

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
const SUPABASE_URL = env.SUPABASE_PROJECT_URL || "";
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY || "";

// Multi-cloud fallback sync
function syncToSupabase(settlement) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const u = new URL(`${SUPABASE_URL}/rest/v1/settlements`);
      const payload = JSON.stringify(settlement);
      const req = https.request({
        hostname: u.hostname,
        port: 443,
        path: u.pathname,
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        timeout: 5000
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.write(payload);
      req.end();
    } catch (_) { resolve(false); }
  });
}

async function runGovernancePass() {
  const settlementsPath = path.join(process.cwd(), "reports", "vault_settlements.json");
  if (!fs.existsSync(settlementsPath)) return;

  let records = [];
  try {
    records = JSON.parse(fs.readFileSync(settlementsPath, "utf8"));
  } catch (_) { return; }

  let gross = 0;
  let tax = 0;
  let withdrawable = 0;

  for (const item of records) {
    gross += (item.netProfitUSD || 0);
    tax += (item.taxReserveUSD || 0);
    withdrawable += (item.netWithdrawableUSD || 0);
    if (!item.syncedToCloud) {
      const ok = await syncToSupabase(item);
      if (ok) item.syncedToCloud = true;
    }
  }

  fs.writeFileSync(settlementsPath, JSON.stringify(records, null, 2), "utf8");

  // Log governor pulse
  console.log(`[GOVERNOR] Verified: ${records.length} txs | Gross: $${gross.toFixed(2)} | Policy T1 Reserve: $${tax.toFixed(2)} | Withdrawable: $${withdrawable.toFixed(2)}`);
}

// Execute every 30 minutes
console.log("🛡️ Chronos Cadence & Resilience Governor active");
setInterval(runGovernancePass, 30 * 60 * 1000);
runGovernancePass();
