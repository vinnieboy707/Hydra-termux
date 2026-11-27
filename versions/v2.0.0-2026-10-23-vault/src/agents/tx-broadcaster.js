"use strict";

const https = require("https");
const crypto = require("crypto");

// 1. Solana Jito Mainnet Block Engine Dispatcher
async function sendJitoBundle(serializedTxBase58) {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "sendBundle",
    params: [[serializedTxBase58]]
  };

  return new Promise((resolve) => {
    try {
      const u = new URL("https://mainnet.block-engine.jito.wtf/api/v1/bundles");
      const data = JSON.stringify(payload);
      const req = https.request({
        hostname: u.hostname,
        port: 443,
        path: u.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        timeout: 4000
      }, (res) => {
        let b = "";
        res.on("data", c => b += c);
        res.on("end", () => {
          try { resolve(JSON.parse(b)); } catch (_) { resolve({ error: "PARSE_ERR" }); }
        });
      });
      req.on("error", (e) => resolve({ error: e.message }));
      req.on("timeout", () => { req.destroy(); resolve({ error: "TIMEOUT" }); });
      req.write(data);
      req.end();
    } catch (e) { resolve({ error: e.message }); }
  });
}

// 2. Arbitrum ERC-4337 Sponsored UserOperation Dispatcher
async function sendArbitrumUserOp(bundlerRpcUrl, userOp, entryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789") {
  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "eth_sendUserOperation",
    params: [userOp, entryPoint]
  };

  return new Promise((resolve) => {
    try {
      const u = new URL(bundlerRpcUrl);
      const data = JSON.stringify(payload);
      const req = https.request({
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        timeout: 5000
      }, (res) => {
        let b = "";
        res.on("data", c => b += c);
        res.on("end", () => {
          try { resolve(JSON.parse(b)); } catch (_) { resolve({ error: "PARSE_ERR" }); }
        });
      });
      req.on("error", (e) => resolve({ error: e.message }));
      req.on("timeout", () => { req.destroy(); resolve({ error: "TIMEOUT" }); });
      req.write(data);
      req.end();
    } catch (e) { resolve({ error: e.message }); }
  });
}

module.exports = { sendJitoBundle, sendArbitrumUserOp };
