import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";

const TARGET = "http://127.0.0.1:9091";
let child = null;
let stopping = false;

function waitForServer(cb) {
  const retry = () => setTimeout(() => waitForServer(cb), 1000);
  const req = http.get(`${TARGET}/api/v1/health`, { timeout: 2000 }, (res) => {
    res.resume();
    res.statusCode === 200 ? cb() : retry();
  });
  req.on("timeout", () => req.destroy());
  req.on("error", retry);
}

function onOutput(data) {
  const text = data.toString();
  process.stderr.write(text);
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m) fs.writeFileSync("data/tunnel_url.txt", m[0] + "\n");
}

function startTunnel() {
  if (stopping) return;
  console.log("[tunnel] Waiting for API Gateway...");
  waitForServer(() => {
    console.log("[tunnel] Gateway up. Launching cloudflared (http2)...");
    child = spawn("cloudflared", ["tunnel", "--protocol", "http2", "--url", TARGET], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", onOutput);
    child.stderr.on("data", onOutput);
    child.on("error", (err) => console.error("[tunnel] spawn failed:", err));
    child.on("close", (code) => {
      console.warn(`[tunnel] exited (${code}).`);
      if (!stopping) setTimeout(startTunnel, 3000);
    });
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { stopping = true; child?.kill(); process.exit(0); });
}

startTunnel();
