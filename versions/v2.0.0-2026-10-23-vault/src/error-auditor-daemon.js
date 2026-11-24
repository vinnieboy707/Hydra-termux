'use strict';
const fs = require('fs');
const path = require('path');
const pm2 = require('pm2');

const RESOLVED_DB_PATH = path.join(__dirname, '../resolved-errors.json');

function loadResolvedDatabase() {
  if (!fs.existsSync(RESOLVED_DB_PATH)) {
    return { known_resolutions: [] };
  }
  return JSON.parse(fs.readFileSync(RESOLVED_DB_PATH, 'utf8'));
}

console.log("🛡️ [Chronos Error Auditor] Active & Filtering Telemetry...");

pm2.connect((err) => {
  if (err) {
    console.error("[-] PM2 Connection Failed:", err);
    process.exit(2);
  }

  pm2.launchBus((err, bus) => {
    if (err) return;

    bus.on('log:err', (data) => {
      const errorMessage = data.data.trim();
      const processName = data.process.name;

      // Ignore normal startup info logs accidentally piped to stderr
      if (errorMessage.includes("injected env")) return;

      const timestamp = new Date().toISOString();
      console.log(`\n🚨 [TRUE EXCEPTION CAPTURED] [${timestamp}] App: ${processName}`);
      console.log(`Stack/Message: ${errorMessage}`);

      const db = loadResolvedDatabase();
      const matchedResolution = db.known_resolutions.find(item => errorMessage.includes(item.pattern));

      if (matchedResolution) {
        console.log(`✅ [MATCH FOUND IN RESOLVED REGISTRY] -> Root Cause: ${matchedResolution.root_cause}`);
      } else {
        console.log(`⚠️ [NOVEL ERROR] No matching record in resolved database. Logging to audit queue.`);
        fs.appendFileSync(path.join(__dirname, '../unresolved-audit.log'), `[${timestamp}] [${processName}] ${errorMessage}\n`);
      }
    });
  });
});
