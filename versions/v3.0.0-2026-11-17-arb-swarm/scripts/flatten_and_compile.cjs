const fs = require('fs');
const path = require('path');
const solc = require('solc');

function main() {
  console.log('=========================================================');
  console.log('CHRONOS OS: BULLETPROOF FLATTENER & COMPILER');
  console.log('=========================================================');

  const contractPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArb.sol');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ ChronosFlashArb.sol not found.');
    process.exit(1);
  }
  let sourceCode = fs.readFileSync(contractPath, 'utf8');

  // Robust recursive replacer for all OpenZeppelin imports
  const resolvedFiles = new Set();

  function resolveImports(code) {
    // Matches: import "...", import '...', import {...} from "..."
    const importRegex = /import\s+(?:(?:"[^"]+"\s+from\s+)?["'](@openzeppelin\/[^"']+)["']|\{[^}]+\}\s+from\s+["'](@openzeppelin\/[^"']+)["']);?/g;
    
    return code.replace(importRegex, (match, p1, p2) => {
      const importPath = p1 || p2;
      if (!importPath) return match;

      const fullPath = path.join(process.cwd(), 'node_modules', importPath);
      if (fs.existsSync(fullPath)) {
        if (resolvedFiles.has(fullPath)) {
          return `// Duplicate import suppressed: ${importPath}`;
        }
        resolvedFiles.add(fullPath);
        console.log(`📌 Inlined: ${importPath}`);
        let importedContent = fs.readFileSync(fullPath, 'utf8');
        
        // Strip inner pragma and SPDX statements from dependencies to avoid compiler warnings
        importedContent = importedContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        importedContent = importedContent.replace(/pragma\s+solidity[^;]+;/g, '');
        importedContent = importedContent.replace(/SPDX-License-Identifier:[^\n]+/g, '');

        // Recursively resolve nested imports inside the dependency
        return resolveImports(importedContent);
      } else {
        console.error(`❌ Dependency file missing on disk: ${fullPath}`);
        return match;
      }
    });
  }

  console.log('📦 Resolving and flattening OpenZeppelin dependencies...');
  const flattenedSource = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\n` + resolveImports(sourceCode);

  const flattenedPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArbFlat.sol');
  fs.writeFileSync(flattenedPath, flattenedSource);
  console.log('✅ Standalone flattened contract successfully written to contracts/ChronosFlashArbFlat.sol');

  // Compile the flattened standalone contract directly via solc
  const input = {
    language: 'Solidity',
    sources: {
      'ChronosFlashArbFlat.sol': { content: flattenedSource }
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

  const contractData = output.contracts['ChronosFlashArbFlat.sol']['ChronosFlashArb'];
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
