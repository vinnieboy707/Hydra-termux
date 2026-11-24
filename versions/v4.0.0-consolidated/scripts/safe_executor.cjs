const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetScript = process.argv[2];
if (!targetScript) {
    console.error("❌ Usage: node scripts/safe_executor.cjs <script_path>");
    process.exit(1);
}

const absolutePath = path.resolve(targetScript);
console.log(`🛡️ [SafeExecutor] Pre-flight inspection for: ${targetScript}`);

if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Target file not found: ${absolutePath}`);
    process.exit(1);
}

// 1. Syntax Check via Node check flag
try {
    execSync(`node --check ${absolutePath}`, { stdio: 'inherit' });
    console.log(`✅ [SafeExecutor] Syntax check PASSED.`);
} catch (err) {
    console.error(`❌ [SafeExecutor] Syntax check FAILED.`);
    process.exit(1);
}

// 2. Execution
console.log(`🚀 [SafeExecutor] Executing ${targetScript} securely...\n`);
try {
    execSync(`node ${absolutePath}`, { stdio: 'inherit' });
} catch (err) {
    console.error(`❌ [SafeExecutor] Execution exited with error code.`);
    process.exit(1);
}
