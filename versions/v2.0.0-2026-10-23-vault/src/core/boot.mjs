import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILE = process.env.CHRONOS_ENV_FILE || path.join(root, ".env.production");
const errors = [];
const bad = (m) => errors.push(m);

if (!fs.existsSync(ENV_FILE)) bad("env file missing");
else {
  if (fs.statSync(ENV_FILE).mode & 0o077) bad("env file too open: chmod 600 .env.production");
  dotenv.config({ path: ENV_FILE });
}

const policyRaw = fs.readFileSync(path.join(root, "config", "policy.json"), "utf8");
const policy = JSON.parse(policyRaw);
for (const [k, v] of Object.entries(policy))
  if (typeof v === "number" && (!Number.isFinite(v) || v < 0)) bad(`policy.${k} invalid`);

const PLACEHOLDER = /REPLACE|CHANGE_?ME|YOUR_|xxxx|example|dummy|fake|mock/i;
const env = process.env;
const need = (k, re) => {
  const v = env[k];
  if (!v) return bad(`${k} missing`);
  if (PLACEHOLDER.test(v)) return bad(`${k} looks like a placeholder`);
  if (re && !re.test(v)) bad(`${k} bad format`);
};

if (env.NODE_ENV !== "production") bad("NODE_ENV must be production");
if (env.CHRONOS_LIVE !== "1") bad("CHRONOS_LIVE must be 1");

need("EXECUTOR_WALLET_ADDRESS", /^0x[0-9a-fA-F]{40}$/);
if (/0{10,}/.test(env.EXECUTOR_WALLET_ADDRESS || "")) bad("EXECUTOR_WALLET_ADDRESS looks like a placeholder");
need("ALCHEMY_RPC_URL", /^https:\/\/arb-mainnet\./);
need("ARB_RPC_URL", /^https:\/\//);
need("SOLANA_RPC_URL", /^https:\/\/.*mainnet/);
for (const k of ["ALCHEMY_RPC_URL", "ARB_RPC_URL", "SOLANA_RPC_URL"])
  if (/sepolia|goerli|testnet|devnet|localhost|127\.0\.0\.1/i.test(env[k] || "")) bad(`${k} points at a non-mainnet endpoint`);

const hasKey = /^0x[0-9a-fA-F]{64}$/.test(env.EXECUTOR_PRIVATE_KEY || "");
const hasKms = /^(arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]{36}|[0-9a-f-]{36})$/.test(env.AWS_KMS_KEY_ID || "");
if (!hasKey && !hasKms) bad("no valid signer: set EXECUTOR_PRIVATE_KEY or a full-ARN AWS_KMS_KEY_ID");

for (const [k, v] of Object.entries(env))
  if (/(MOCK|DRY_?RUN|PAPER|DUMMY|FAKE|TESTNET|SEPOLIA|FORK|SIMULATE_ONLY)/i.test(k) && !/^(|0|false)$/i.test(v || ""))
    bad(`forbidden flag set: ${k}`);

if (!/^sk_live_/.test(env.STRIPE_SECRET_KEY || ""))
  console.warn("[boot] Stripe not live: payments will be recorded as stripe_test and excluded from totals");

if (errors.length) {
  console.error("[boot] REFUSING TO START:\n - " + errors.join("\n - "));
  process.exit(78); // PM2 stop_exit_codes: don't crash-loop on config errors
}

export const config = Object.freeze({ root, policy: Object.freeze(policy) });
console.log(`[boot] mainnet gate passed | policy ${crypto.createHash("sha256").update(policyRaw).digest("hex").slice(0, 12)}`);
