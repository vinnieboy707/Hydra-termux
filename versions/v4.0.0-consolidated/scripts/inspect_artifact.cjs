const fs = require('fs');
const path = require('path');
const solc = require('solc');

function main() {
  console.log('=========================================================');
  console.log('CHRONOS OS: CONTRACT ABI & BYTECODE INSPECTOR (FIXED)');
  console.log('=========================================================');

  const contractPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArb.sol');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ ChronosFlashArb.sol not found in contracts/');
    process.exit(1);
  }
  const sourceCode = fs.readFileSync(contractPath, 'utf8');

  // Correct import resolver mapping directly to node_modules
  function findImports(importPath) {
    console.log(`🔍 Resolving import: ${importPath}`);
    
    // Direct resolution inside workspace node_modules
    const resolvedPath = path.join(process.cwd(), 'node_modules', importPath);
    if (fs.existsSync(resolvedPath)) {
      console.log(`  └─ Found at: ${resolvedPath}`);
      return { contents: fs.readFileSync(resolvedPath, 'utf8') };
    }

    console.error(`❌ Import not found: ${importPath}`);
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
          '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode']
        }
      }
    }
  };

  console.log('📦 Compiling ChronosFlashArb.sol...');
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
  const deployedBytecode = contractData.evm.deployedBytecode.object;

  console.log('\n=========================================================');
  console.log('📊 ARTIFACT INSPECTION REPORT (Policy P0)');
  console.log('=========================================================');
  console.log(`📋 Total ABI Functions / Events: ${abi.length}`);
  console.log(`📏 Creation Bytecode Length:    ${bytecode.length} hex chars`);
  console.log(`📏 Deployed Runtime Bytecode:   ${deployedBytecode.length} hex chars\n`);

  // Save verified artifact JSON
  const artifactDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(
    path.join(artifactDir, 'ChronosFlashArb.json'),
    JSON.stringify({ abi, bytecode, deployedBytecode }, null, 2)
  );
  console.log('💾 Verified artifact successfully written to artifacts/ChronosFlashArb.json');
}

main();
