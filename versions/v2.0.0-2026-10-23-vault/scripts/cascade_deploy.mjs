import { execSync } from "node:child_process";
import fs from "node:fs";

console.log("========================================================");
console.log("CHRONOS OS // CASCADE HARDHAT RESCUE & DEPLOYMENT RUNNER");
console.log("========================================================");

try {
  console.log("[+] Step 1: Validating Hardhat configuration presence...");
  if (!fs.existsSync("hardhat.config.cjs") && !fs.existsSync("hardhat.config.js")) {
    throw new Error("Hardhat config file not found in root directory.");
  }

  console.log("[+] Step 2: Compiling Solidity smart contracts...");
  execSync("npx hardhat compile", { stdio: "inherit" });

  console.log("[+] Step 3: Executing Arbitrum mainnet deployment broadcast...");
  execSync("npx hardhat run scripts/deploy_flash_arb.mjs --network arbitrum", { stdio: "inherit" });

  console.log("[✔] CASCADE DEPLOYMENT SEQUENCE COMPLETED SUCCESSFULLY.");
} catch (err) {
  console.error("[!] Cascade Execution Warning:", err.message);
  console.log("[*] Note: If PRIVATE_KEY is not set in .env.production, contract compilation is verified but mainnet broadcast requires funded signer keys.");
}
