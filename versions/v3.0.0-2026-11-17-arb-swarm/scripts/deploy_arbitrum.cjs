const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Simple .env parser for robust credential auto-injection
function loadEnvFiles() {
  const envPaths = ['.env', '.env.production'];
  for (const envPath of envPaths) {
    const fullPath = path.join(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^([^=#]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
          if (!process.env[key] && value) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

async function main() {
  loadEnvFiles();

  console.log('=========================================================');
  console.log('CHRONOS OS: ARBITRUM MAINNET AUTO-INJECT ROUTER DEPLOYER');
  console.log('=========================================================');

  // Load verified artifact
  const artifactPath = path.join(process.cwd(), 'artifacts', 'ChronosFlashArb.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('❌ Artifact not found at artifacts/ChronosFlashArb.json. Run compilation first.');
    process.exit(1);
  }

  const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  // Connect to Arbitrum One RPC
  const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log(`🌐 Connected to provider: ${rpcUrl}`);
  const network = await provider.getNetwork();
  console.log(`🔗 Chain ID: ${network.chainId}`);

  // Auto-inject private key from environment variables or config
  let privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;
  
  if (!privateKey || privateKey.includes('YOUR_ACTUAL') || privateKey.length < 64) {
    console.error('❌ ERROR: Valid DEPLOYER_PRIVATE_KEY not found or still using placeholder.');
    console.error('💡 Please set your 64-character hex private key in .env or export DEPLOYER_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Ensure 0x prefix
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`👤 Deployer Address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error('❌ Deployer wallet has 0 ETH balance. Fund the address to execute deployment.');
    process.exit(1);
  }

  console.log('🚀 Deploying ChronosFlashArb to Arbitrum Mainnet...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  const contract = await factory.deploy({
    gasLimit: 3000000
  });

  console.log(`⏳ Waiting for deployment transaction: ${contract.deploymentTransaction().hash}`);
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log('=========================================================');
  console.log(`✅ SUCCESS! ChronosFlashArb deployed to: ${deployedAddress}`);
  console.log('=========================================================');

  // Log deployment audit metadata
  const deploymentRecord = {
    address: deployedAddress,
    deployer: wallet.address,
    chainId: Number(network.chainId),
    txHash: contract.deploymentTransaction().hash,
    timestamp: new Date().toISOString()
  };

  const auditPath = path.join(process.cwd(), 'artifacts', 'deployment_audit.json');
  fs.writeFileSync(auditPath, JSON.stringify(deploymentRecord, null, 2));
  console.log('💾 Deployment audit logged to artifacts/deployment_audit.json');
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exitCode = 1;
});
