'use strict';
const { createRobustProvider, getAuditReport } = require('./src/robust-provider');

console.log('========================================================');
console.log('CHRONOS OS // ROBUST JSON RPC PROVIDER AUDIT TEST');
console.log('========================================================');

const report = getAuditReport();
console.log(`Audit Status : ${report.status}`);
console.log(`Audited At   : ${report.auditedAt}`);
console.log('Improvements :');
report.improvements.forEach((imp, i) => console.log(` ${i + 1}. ${imp}`));

try {
    const provider = createRobustProvider();
    console.log('✅ [Success] Robust provider / FallbackProvider successfully instantiated.');
} catch (err) {
    console.error(`❌ [Error]: ${err.message}`);
    process.exit(1);
}

console.log('========================================================');
console.log('ROBUST JSON RPC PROVIDER TEST PASSED.');
console.log('========================================================');
