'use strict';
const sessionCache = require('./src/session-cache-checkpoint.js');

console.log('Testing session cache and checkpointing...');
const testSessionId = 'session-test-' + Date.now();
sessionCache.recordMessage(testSessionId, 'user', 'Hello Chronos OS');
sessionCache.recordMessage(testSessionId, 'assistant', 'Hello! All revenue streams active.');

const history = sessionCache.getSessionHistory(testSessionId);
console.log('Retrieved session history:', history);

if (history.length === 2) {
    console.log('✅ [TEST SUCCESS]: Session checkpoint and cache successfully recorded and retrieved messages.');
} else {
    console.error('❌ [TEST FAILED]: Unexpected history length.');
    process.exit(1);
}
