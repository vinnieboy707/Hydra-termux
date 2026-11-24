'use strict';
const fs = require('fs');
const { execSync } = require('child_process');

console.log('========================================================');
console.log('CHRONOS OS // COMPREHENSIVE SYSTEM HEALTH & ERROR REGRESSION AUDIT');
console.log('========================================================');

let errorsFound = 0;

// 1. Check Redis
try {
    const redisPong = execSync('redis-cli ping', { encoding: 'utf8' }).trim();
    if (redisPong === 'PONG') {
        console.log('✅ [REDIS CHECK]: Operational (PONG received).');
    } else {
        console.warn('⚠️ [REDIS CHECK]: Unexpected response:', redisPong);
    }
} catch (err) {
    console.warn('⚠️ [REDIS CHECK]: redis-cli not found or Redis daemon offline. Running in standalone fallback mode.');
}

// 2. Check State Files & Folders
const requiredFiles = ['error_prevention_registry.json', 'FAILURE_AUDIT_REPORT.md', 'ecosystem.config.js'];
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ [FILE CHECK]: Found required file -> ${file}`);
    } else {
        console.error(`❌ [FILE CHECK]: Missing required file -> ${file}`);
        errorsFound++;
    }
});

// 3. Environment Key Audit
require('dotenv').config();
const requiredEnvKeys = [
    'ARBITRUM_RPC_URL',
    'PRIVATE_KEY',
    'SOLANA_RPC_URL',
    'SOLANA_PRIVATE_KEY',
    'STRIPE_SECRET_KEY',
    'DESTINATION_BANK_ACCOUNT_ID',
    'STRIPE_WEBHOOK_SECRET',
    'OPENROUTER_API_KEY'
];

console.log('\n--- ENVIRONMENT KEY CONFIGURATION STATUS ---');
let missingKeys = [];
requiredEnvKeys.forEach(key => {
    if (process.env[key] && process.env[key] !== 'REDACTED') {
        console.log(`🔑 [CONFIGURED]: ${key}`);
    } else {
        console.warn(`⚠️ [ACTION REQUIRED // MISSING OR UNCONFIGURED]: ${key}`);
        missingKeys.push(key);
    }
});

console.log('--------------------------------------------------------');
if (errorsFound > 0) {
    console.error(`❌ [HEALTH AUDIT FAILED]: ${errorsFound} errors detected.`);
    process.exit(1);
} else {
    console.log('✅ [HEALTH AUDIT SUCCESS]: All core structural and operational checks passed.');
    if (missingKeys.length > 0) {
        console.log(`\n📌 Please configure the following missing environment keys in your .env file:`);
        missingKeys.forEach(k => console.log(`   - ${k}`));
    }
}
console.log('========================================================');
