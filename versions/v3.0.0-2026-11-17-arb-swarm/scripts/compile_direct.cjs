const fs = require('fs');
const path = require('path');
const solc = require('solc');

function main() {
  console.log('=========================================================');
  console.log('CHRONOS OS: DIRECT INLINE COMPILER (CLEAN LICENSE)');
  console.log('=========================================================');

  const contractPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArb.sol');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ contracts/ChronosFlashArb.sol not found.');
    process.exit(1);
  }

  let mainSource = fs.readFileSync(contractPath, 'utf8');

  // Locate exact OpenZeppelin dependencies on disk
  const ierc20Path = path.join(process.cwd(), 'node_modules', '@openzeppelin', 'contracts', 'token', 'ERC20', 'IERC20.sol');
  const contextPath = path.join(process.cwd(), 'node_modules', '@openzeppelin', 'contracts', 'utils', 'Context.sol');
  const ownablePath = path.join(process.cwd(), 'node_modules', '@openzeppelin', 'contracts', 'access', 'Ownable.sol');

  let ierc20Code = fs.existsSync(ierc20Path) ? fs.readFileSync(ierc20Path, 'utf8') : '';
  let contextCode = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, 'utf8') : '';
  let ownableCode = fs.existsSync(ownablePath) ? fs.readFileSync(ownablePath, 'utf8') : '';

  // Aggressively strip comments, pragmas, and SPDX licenses from dependencies
  const sanitize = (code) => {
    return code
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      .replace(/pragma\s+solidity[^;]+;/g, '')
      .replace(/SPDX-License-Identifier:[^\n]+/g, '');
  };

  // Strip imports and SPDX/pragmas from main source
  mainSource = mainSource
    .replace(/import\s+"[^"]+";/g, '')
    .replace(/import\s+'[^']+';/g, '')
    .replace(/pragma\s+solidity[^;]+;/g, '')
    .replace(/SPDX-License-Identifier:[^\n]+/g, '');

  const standaloneSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// --- INLINED IERC20 ---
${sanitize(ierc20Code)}

// --- INLINED Context ---
${sanitize(contextCode)}

// --- INLINED Ownable ---
${sanitize(ownableCode)}

// --- MAIN CONTRACT ---
${mainSource}
`;

  const outPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArbStandalone.sol');
  fs.writeFileSync(outPath, standaloneSource, 'utf8');
  console.log('✅ Standalone zero-import contract successfully assembled.');

  // Compile via solc
  const input = {
    language: 'Solidity',
    sources: {
      'ChronosFlashArbStandalone.sol': { content: standaloneSource }
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

  console.log('🚀 Compiling standalone bytecode...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    output.errors.forEach(err => {
      console.error(err.formattedMessage);
      if (err.severity === 'error') hasError = true;
    });
    if (hasError) process.exit(1);
  }

  const contractData = output.contracts['ChronosFlashArbStandalone.sol']['ChronosFlashArb'];
  const artifactDir = path.join(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  fs.writeFileSync(
    path.join(artifactDir, 'ChronosFlashArb.json'),
    JSON.stringify({
      abi: contractData.abi,
      bytecode: contractData.evm.bytecode.object,
      deployedBytecode: contractData.evm.deployedBytecode.object
    }, null, 2)
  );

  console.log('💾 Verified artifact successfully written to artifacts/ChronosFlashArb.json');
}

main();
