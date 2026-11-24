import { execSync } from "node:child_process";

console.log("========================================================");
console.log("CHRONOS OS // STANDARDIZED HARDHAT COMPILER & DEPLOYER");
console.log("========================================================");

try {
  console.log("[+] Compiling Solidity smart contracts...");
  execSync("npx hardhat compile", { stdio: "inherit" });
  console.log("[✔] Smart contracts compiled successfully.");
} catch (err) {
  console.error("[!] Compilation Notice:", err.message);
  process.exitCode = 1;
}
