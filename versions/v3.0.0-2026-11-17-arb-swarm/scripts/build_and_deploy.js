import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { ethers } from 'ethers';

async function main() {
  console.log('=========================================================');
  console.log('CHRONOS OS: DIRECT PROGRAMMATIC SOLC COMPILER & DEPLOYER');
  console.log('=========================================================');

  // 1. Read contract source
  const contractPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArb.sol');
  const sourceCode = fs.readFileSync(contractPath, 'utf8');

  // Setup standard-json input for solc including OpenZeppelin remapping
  const input = {
    language: 'Solidity',
    sources: {
      'ChronosFlashArb.sol': { content: sourceCode }
    },
    settings: {
      optimizer: { enabled: true, runs: 1000000 },
      viaIR: true,
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  console.log('📦 Compiling ChronosFlashArb.sol via direct solc engine...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    output.errors.forEach(err => {
      console.error(err.formattedMessage);
      if (err.severity === 'error') hasError = true;
    });
    if (hasError) process.exit(1);
  }

  const contractData = output.contracts['ChronosFlashArb.sol']['ChronosFlashArb'];
  const abi = contractData.abi;
  const bytecode = contractData.evm.bytecode.object;

  console.log('✅ Compilation successful under Policy P0 (Zero Simulation).');
  console.log(`📋 Bytecode length: ${bytecode.length} hex chars`);

  // 2. Initialize local provider/signer for deployment
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const signer = await provider.getSigner().catch(() => null);

  if (!signer) {
    console.log('⚠️ Local Hardhat node provider not running. Saving compiled artifacts to disk...');
    const artifactDir = path.join(process.cwd(), 'artifacts');
    if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'ChronosFlashArb.json'), JSON.stringify({ abi, bytecode }, null, 2));
    console.log('💾 Artifacts saved to artifacts/ChronosFlashArb.json');
    return;
  }

  console.log('🚀 Deploying contract to network...');
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log(`✅ ChronosFlashArb deployed successfully to: ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error('❌ Execution failed:', error);
  process.exitCode = 1;
});
