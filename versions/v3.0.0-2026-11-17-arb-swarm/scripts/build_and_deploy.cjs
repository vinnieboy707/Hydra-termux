const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ethers } = require('ethers');

async function main() {
  console.log('=========================================================');
  console.log('CHRONOS OS: CJS SOLC COMPILER & DEPLOYER (ROBUST RESOLVER)');
  console.log('=========================================================');

  // 1. Read contract source
  const contractPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArb.sol');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ ChronosFlashArb.sol not found in contracts/');
    process.exit(1);
  }
  const sourceCode = fs.readFileSync(contractPath, 'utf8');

  // 2. Robust import resolver for OpenZeppelin and node_modules
  function findImports(importPath) {
    console.log(`🔍 Resolving import: ${importPath}`);
    
    let targetPath = '';
    if (importPath.startsWith('@openzeppelin/contracts/')) {
      const subPath = importPath.replace('@openzeppelin/contracts/', '');
      targetPath = path.join(process.cwd(), 'node_modules', '@openzeppelin', 'contracts', subPath);
    } else {
      targetPath = path.join(process.cwd(), 'node_modules', importPath);
    }

    if (fs.existsSync(targetPath)) {
      console.log(`  └─ Found at: ${targetPath}`);
      return { contents: fs.readFileSync(targetPath, 'utf8') };
    }

    // Fallback using require.resolve search paths
    try {
      const resolved = require.resolve(importPath, { paths: [process.cwd(), path.join(process.cwd(), 'node_modules')] });
      if (fs.existsSync(resolved)) {
        console.log(`  └─ Found via require.resolve at: ${resolved}`);
        return { contents: fs.readFileSync(resolved, 'utf8') };
      }
    } catch (e) {
      // Ignored
    }

    console.error(`❌ Import failed: ${importPath} not found in node_modules.`);
    return { error: 'File not found: ' + importPath };
  }

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

  console.log('📦 Compiling ChronosFlashArb.sol via solc CJS wrapper...');
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

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

  // 3. Save compiled artifacts
  const artifactDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, 'ChronosFlashArb.json'), JSON.stringify({ abi, bytecode }, null, 2));
  console.log('💾 Artifacts saved to artifacts/ChronosFlashArb.json');

  // 4. Initialize provider and deploy if local node is active
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const signer = await provider.getSigner().catch(() => null);

  if (!signer) {
    console.log('⚠️ Local JSON-RPC provider not active. Artifact compilation complete.');
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
