import * as dotenv from 'dotenv';
dotenv.config();

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
}

export function loadEnvironment(): void {
  const requiredVars = [
    'DATABASE_URL',
    'ETH_PROVIDER_URL',
    'ETHERSCAN_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missing: string[] = [];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      missing.push(v);
    }
  }

  if (missing.length > 0) {
    console.warn(`[!] Warning: Missing critical environment variables: ${missing.join(', ')}`);
  } else {
    console.log('[+] All critical environment variables successfully loaded.');
  }
}

export function getRpcUrl(): string {
  return process.env.ETH_PROVIDER_URL || 'https://eth-mainnet.g.alchemy.com/v2/';
}
