import ts from 'typescript';

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

console.log('🔨 Compiling TypeScript codebase programmatically...');
const host = ts.createCompilerHost(options);
const program = ts.createProgram(files, options, host);
const emitResult = program.emit();

const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
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
