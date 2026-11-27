const ts = require('typescript');
const fs = require('fs');
const path = require('path');

console.log('🔨 Compiling TypeScript codebase programmatically (ESM target)...');

const files = [
  'src/server.ts',
  'src/enterprise_swarm_mesh.ts',
  'src/payout_engine.ts',
  'src/config/wss_manager.ts',
  'scripts/cron-security-audit.ts',
  'scripts/audit_ledger.ts'
];

const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  outDir: './dist'
};

const host = ts.createCompilerHost(options);
const program = ts.createProgram(files, options, host);
const emitResult = program.emit();

const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

diagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  } else {
    console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  }
});

if (emitResult.emitSkipped) {
  console.error('❌ Build failed.');
  process.exit(1);
} else {
  console.log('✅ Build completed successfully.');
}
