import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const TARGETS = new Set(["0x158274a5", "0x78e3214f", "0xc6005893", "0x02083057", "0x2e1c224f"]);

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scanDir(full);
        else if (/\.(sol|json|mjs|js|ts)$/.test(entry.name)) {
            const txt = fs.readFileSync(full, "utf8");
            for (const m of txt.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g)) {
                const types = m[2].split(",").map(p => p.trim().split(/\s+/)[0]).filter(Boolean).join(",");
                const sig = `${m[1]}(${types})`;
                const sel = ethers.id(sig).slice(0, 10).toLowerCase();
                if (TARGETS.has(sel)) console.log(`🎯 [LOCAL] ${sel} -> ${sig} (${full})`);
            }
        }
    }
}

scanDir(process.cwd());

for (const sel of TARGETS) {
    try {
        const res = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${sel}`);
        const data = await res.json();
        if (data.results?.length) {
            console.log(`🌐 [4BYTE] ${sel} -> ${data.results.map(r => r.text_signature).join(" | ")}`);
        }
    } catch {}
}
