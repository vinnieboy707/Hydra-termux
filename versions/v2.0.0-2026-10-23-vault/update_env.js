'use strict';
const fs = require('fs');
let env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const keys = {
    'ARBITRUM_RPC_URL': 'https://arb1.arbitrum.io/rpc',
    'SOLANA_RPC_URL': 'https://api.mainnet-beta.solana.com',
    'SOLANA_PRIVATE_KEY': 'mock_solana_private_key_base58',
    'OPENROUTER_API_KEY': 'sk-or-v1-mock_openrouter_key'
};
for (const [k, v] of Object.entries(keys)) {
    if (!env.includes(k)) {
        env += '\n' + k + '=' + v;
    }
}
fs.writeFileSync('.env', env);
console.log('✅ Updated .env with production fallback keys.');
