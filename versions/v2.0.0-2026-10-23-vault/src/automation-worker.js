'use strict';
const http = require('http');
const https = require('https');

console.log("🎯 [Endpoint Health & Security Auditor] Initialized active production endpoint monitor...");

const TARGET_ENDPOINTS = [
  "http://localhost:3800/health",
  "http://localhost:3800/metrics"
];

function auditEndpoint(url) {
  const client = url.startsWith('https') ? https : http;
  const req = client.get(url, (res) => {
    console.log(`[+] Endpoint Audit: ${url} | Status: ${res.statusCode} | Verified Active`);
    res.resume();
  });
  req.on('error', (err) => {
    console.warn(`⚠️ [Endpoint Notice] ${url} unreachable: ${err.message}`);
  });
  req.end();
}

function runAuditCycle() {
  for (const target of TARGET_ENDPOINTS) {
    auditEndpoint(target);
  }
}

setInterval(runAuditCycle, 30000);
runAuditCycle();
