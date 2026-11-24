'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ledgerPath = path.resolve(__dirname, '../unified_financial_ledger.wal');
const archiveDir = path.resolve(__dirname, '../archives');

console.log('📦 [WAL Archiver] Initialized automated log rotation & cryptographic archival service...');

if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
}

function rotateAndArchiveWAL() {
    if (!fs.existsSync(ledgerPath)) return;
    try {
        const stats = fs.statSync(ledgerPath);
        // Rotate if file size exceeds 10MB
        if (stats.size > 10 * 1024 * 1024) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const archivePath = path.join(archiveDir, `ledger_${timestamp}.wal`);
            
            const content = fs.readFileSync(ledgerPath);
            const checksum = crypto.createHash('sha256').update(content).digest('hex');
            
            fs.writeFileSync(archivePath, content);
            fs.writeFileSync(archivePath + '.sha256', checksum);
            fs.writeFileSync(ledgerPath, '');
            console.log(`✅ [WAL Archived]: Rotated ledger to ${archivePath} | Checksum: ${checksum.substring(0, 16)}...`);
        }
    } catch (err) {
        console.error(`[-] WAL Archival Error: ${err.message}`);
    }
}

setInterval(rotateAndArchiveWAL, 3600000); // Check every hour
rotateAndArchiveWAL();

process.on('SIGINT', () => {
    console.log('⚙️ [WAL Archiver] Shutting down service...');
    process.exit(0);
});
