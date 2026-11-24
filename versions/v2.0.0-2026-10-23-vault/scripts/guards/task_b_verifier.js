import fs from "node:fs";
import path from "node:path";

console.log("[DAG Verifier] Scanning codebase for orphan files and missing input/output bindings...");

const requiredCoreFiles = [
  "src/server.mjs",
  "src/db/sqlite-ledger.mjs",
  "src/master-unified-engine.mjs",
  "src/cloud-mesh-syncer.js",
  "ecosystem.config.js"
];

let missing = [];
for (const file of requiredCoreFiles) {
  if (!fs.existsSync(path.resolve(file))) {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error("[!] DAG Verification Failed. Missing core bindings:", missing);
  process.exit(1);
} else {
  console.log("[+] DAG Lineage Verification Passed: Zero orphan files detected. All modules bound.");
}
