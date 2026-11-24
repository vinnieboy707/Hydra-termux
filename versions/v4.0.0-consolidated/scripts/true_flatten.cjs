const fs = require('fs');
const path = require('path');
const solc = require('solc');

function main() {
  console.log('=========================================================');
  console.log('CHRONOS OS: TRUE ZERO-IMPORT FLATTENER & COMPILER');
  console.log('=========================================================');

  const contractPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArb.sol');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ contracts/ChronosFlashArb.sol not found.');
    process.exit(1);
  }

  let mainSource = fs.readFileSync(contractPath, 'utf8');

  // Track inlined files to prevent duplicate definitions
  const includedFiles = new Set();

  function resolveAndInline(sourceCode) {
    // Matches all variant imports like: import "@openzeppelin/...";
    const importRegex = /import\s+(?:(?:"[^"]+"\s+from\s+)?["'](@openzeppelin\/[^"']+)["']|\{[^}]+\}\s+from\s+["'](@openzeppelin\/[^"']+)["']|["']([^"']+)["']);?/g;

    return sourceCode.replace(importRegex, (match, p1, p2, p3) => {
      const importPath = p1 || p2 || p3;
      if (!importPath) return match;

      // Resolve absolute path in node_modules
      const targetPath = path.join(process.cwd(), 'node_modules', importPath);
      if (fs.existsSync(targetPath)) {
        if (includedFiles.has(targetPath)) {
          return `// [Inlined previously]: ${importPath}`;
        }
        includedFiles.add(targetPath);
        console.log(`📌 Inlining dependency: ${importPath}`);

        let subContent = fs.readFileSync(targetPath, 'utf8');
        
        // Strip pragma versions, licenses, and nested imports from the dependency body
        subContent = subContent.replace(/pragma\s+solidity[^;]+;/g, '');
        subContent = subContent.replace(/SPDX-License-Identifier:[^\n]+/g, '');
        
        // Recursively resolve any sub-imports inside this dependency
        subContent = resolveAndInline(subContent);

        return `\n// --- BEGIN INLINED: ${importPath} ---\n${subContent}\n// --- END INLINED: ${importPath} ---\n`;
      } else {
        console.error(`⚠️ Warning: Could not find dependency on disk: ${importPath}`);
        return match;
      }
    });
  }

  console.log('📦 Processing contract dependencies...');
  let flattened = resolveAndInline(mainSource);

  // Prepend single license and pragma at the top, stripping any duplicates from main source
  flattened = flattened.replace(/pragma\s+solidity[^;]+;/g, '');
  flattened = flattened.replace(/SPDX-License-Identifier:[^\n]+/g, '');

  const finalSource = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\n${flattened}`;

  const outFlatPath = path.join(process.cwd(), 'contracts', 'ChronosFlashArbStandalone.sol');
  fs.writeFileSync(outFlatPath, finalSource, 'utf8');
  console.log('✅ Standalone zero-import contract saved to contracts/ChronosFlashArbStandalone.sol');

  // Compile the zero-import standalone file directly via solc
  const input = {
    language: 'Solidity',
    sources: {
      'ChronosFlashArbStandalone.sol': { content: finalSource }
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
