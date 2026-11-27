'use strict';
const fs = require('fs');
const path = require('path');

const TELEMETRY_LOG = path.resolve(__dirname, 'data/download_telemetry.jsonl');

if (!fs.existsSync(path.dirname(TELEMETRY_LOG))) {
    fs.mkdirSync(path.dirname(TELEMETRY_LOG), { recursive: true });
}

function logDownloadEvent(action, clientVersion, targetAccount) {
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        clientVersion: clientVersion || '1.0.0',
        targetAccount: targetAccount || '0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0',
        status: 'TRACKED_SECURE'
    };
    fs.appendFileSync(TELEMETRY_LOG, JSON.stringify(entry) + '\n');
    console.log(`[DOWNLOAD TELEMETRY]: Recorded ${action} for version ${clientVersion}`);
}

if (require.main === module) {
    const action = process.argv[2] || 'CHECKPOINT_DOWNLOAD';
    const version = process.argv[3] || '1.0.0';
    logDownloadEvent(action, version);
}

module.exports = { logDownloadEvent };
