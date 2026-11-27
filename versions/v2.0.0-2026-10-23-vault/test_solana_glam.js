/**
 * Test Suite for Solana GLAM Vault & Token ACL Integration
 * Validates vault creation, TVL management, Token ACL allowlists, blocklists,
 * jurisdiction restrictions, and deposit compliance enforcement.
 */

// Set up mock environment variables before requiring any Solana services
const { Keypair } = require('@solana/web3.js');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;

process.env.SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
if (!process.env.SOLANA_PRIVATE_KEY) {
  const kp = Keypair.generate();
  process.env.SOLANA_PRIVATE_KEY = bs58.encode(kp.secretKey);
}

const assert = require('assert');
const { SolanaGlamVaultManager } = require('./src/solana-glam-vault');

function runSolanaGlamTests() {
  console.log('[Solana GLAM Test] Starting test suite...');

  const manager = new SolanaGlamVaultManager();

  // 1. Register Vault
  const mintAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC mint mock
  const vault = manager.registerVault('vault-inst-01', {
    name: 'Institutional USDa Yield Vault',
    assetMint: mintAddress,
    totalValueLockedUsd: 1000000,
    yieldApy: 0.08,
    manager: 'GlamSysManager1111111111111111111111111111'
  });

  assert.strictEqual(vault.vaultId, 'vault-inst-01');
  assert.strictEqual(vault.totalValueLockedUsd, 1000000);
  assert.strictEqual(vault.assetMint, mintAddress);

  // 2. Configure Token ACL
  const allowedAccount = 'ValidInvestorPubkey1111111111111111111111111';
  const blockedAccount = 'BlockedSanctionedPubkey111111111111111111111';
  
  manager.configureTokenAcl(mintAddress, {
    allowedAccounts: [allowedAccount],
    blockedAccounts: [blockedAccount],
    restrictedJurisdictions: ['US-SANCTIONED'],
    enforceCompliance: true
  });

  // 3. Test Validation & Deposits
  // 3a. Blocked account deposit should fail
  let errorCaught = false;
  try {
    manager.depositToVault('vault-inst-01', blockedAccount, 50000);
  } catch (err) {
    errorCaught = true;
    assert.ok(err.message.includes('blocked'));
  }
  assert.strictEqual(errorCaught, true, 'Blocked account deposit must be rejected');

  // 3b. Restricted jurisdiction deposit should fail
  errorCaught = false;
  try {
    manager.depositToVault('vault-inst-01', 'SomeOtherPubkey1111111111111111111111111', 25000, {
      jurisdiction: 'US-SANCTIONED'
    });
  } catch (err) {
    errorCaught = true;
    assert.ok(err.message.includes('Jurisdiction'));
  }
  assert.strictEqual(errorCaught, true, 'Restricted jurisdiction deposit must be rejected');

  // 3c. Valid authorized investor deposit should succeed
  const depositResult = manager.depositToVault('vault-inst-01', allowedAccount, 100000, {
    jurisdiction: 'CH'
  });
  assert.strictEqual(depositResult.success, true);
  assert.strictEqual(depositResult.depositedAmount, 100000);
  assert.strictEqual(depositResult.newTvl, 1100000);

  console.log('[Solana GLAM Test] All GLAM Vault and Token ACL tests passed successfully.');
}

runSolanaGlamTests();
