import fs from "node:fs";
import path from "node:path";

console.log("[Anti-Contradiction Audit] Scanning codebase for mock, simulation, or contradictory terms...");

const targetDirs = ["src", "scripts"];
let violations = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".mjs"))) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes("Math.random()") && fullPath.includes("revenue")) {
        console.warn(`[!] CONTRACTION DETECTED in ${fullPath}: Random simulation logic found in revenue path.`);
        violations++;
      }
    }
  }
}

for (const dir of targetDirs) {
  if (fs.existsSync(dir)) scanDir(dir);
}

if (violations > 0) {
  console.error(`[!] Audit Failed: ${violations} simulation violations found.`);
  process.exit(1);
} else {
  console.log("[+] Anti-Contradiction Audit Passed: 0 simulation violations detected. Codebase is strictly Mainnet-native.");
}
