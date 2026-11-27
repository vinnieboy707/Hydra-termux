'use strict';
const fs = require('fs');
const path = require('path');

const prodEnvPath = path.resolve(__dirname, '../api-registry/production_config.env');
const targetEnvPath = path.resolve(__dirname, '.env');

let prodContent = fs.existsSync(prodEnvPath) ? fs.readFileSync(prodEnvPath, 'utf8') : '';
let targetContent = fs.existsSync(targetEnvPath) ? fs.readFileSync(targetEnvPath, 'utf8') : '';

// Parse prod env
const prodVars = {};
prodContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
            const k = line.substring(0, eqIdx).trim();
            const v = line.substring(eqIdx + 1).trim();
            prodVars[k] = v;
        }
    }
});

let updatedTarget = targetContent;

const mappings = {
    'ARBITRUM_RPC_URL': prodVars['ETHEREUM_WSS_URL'] || 'https://arb1.arbitrum.io/rpc',
    'PRIVATE_KEY': prodVars['PRIVATE_KEY'] || '',
    'STRIPE_SECRET_KEY': prodVars['STRIPE_API_KEY'] || 'sk_test_mock',
    'DESTINATION_BANK_ACCOUNT_ID': prodVars['SOLANA_WALLET_DESTINATION'] || 'ba_mock',
    'STRIPE_WEBHOOK_SECRET': prodVars['STRIPE_WEBHOOK_SECRET'] || 'whsec_mock',
    'OPENROUTER_API_KEY': prodVars['OPENAI_API_KEY'] || 'sk-or-v1-mock',
    'SOLANA_RPC_URL': prodVars['SOLANA_RPC_URL'] || 'https://api.mainnet-beta.solana.com',
    'SOLANA_PRIVATE_KEY': prodVars['SOLANA_WALLET_DESTINATION'] || 'mock_solana_key'
};

for (const [k, v] of Object.entries(mappings)) {
    if (v) {
        if (updatedTarget.includes(`${k}=`)) {
            updatedTarget = updatedTarget.replace(new RegExp(`${k}=.*`, 'g'), `${k}=${v}`);
        } else {
            updatedTarget += `\n${k}=${v}`;
        }
    }
}

fs.writeFileSync(targetEnvPath, updatedTarget);
console.log('✅ Successfully synchronized production environment variables from api-registry to chronos-infrastructure-core/.env');
