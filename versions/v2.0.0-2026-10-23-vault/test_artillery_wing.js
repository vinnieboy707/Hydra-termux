'use strict';
const assert = require('assert');
const artilleryWing = require('./src/artillery-wing-executor.js');

console.log('--------------------------------------------------------');
console.log('CHRONOS OS // TESTING ARTILLERY WING EXECUTION WORKER');
console.log('--------------------------------------------------------');

// Test 1: Successful Dispatch
try {
    const res = artilleryWing.dispatchPayload({
        amountUSD: 1000.50,
        targetStream: 'STRIKE_ALPHA',
        idempotencyKey: 'IDEM-TEST-001'
    });
    assert.strictEqual(res.status, 'SUCCESS');
    console.log('✅ [TEST 1 PASSED]: Artillery dispatch succeeded and recorded.');
} catch (err) {
    console.error('❌ [TEST 1 FAILED]:', err.message);
    process.exit(1);
}

// Test 2: Idempotency Duplication Prevention
try {
    const res = artilleryWing.dispatchPayload({
        amountUSD: 1000.50,
        targetStream: 'STRIKE_ALPHA',
        idempotencyKey: 'IDEM-TEST-001'
    });
    assert.strictEqual(res.status, 'DUPLICATE_SKIPPED');
    console.log('✅ [TEST 2 PASSED]: Duplicate dispatch correctly blocked.');
} catch (err) {
    console.error('❌ [TEST 2 FAILED]:', err.message);
    process.exit(1);
}

// Test 3: Circuit Breaker Tripping on Invalid Payloads
artilleryWing.resetCircuitBreaker();
let failed = false;
try {
    artilleryWing.dispatchPayload({ amountUSD: 0 }); // Invalid
} catch (e) {
    failed = true;
}
try {
    artilleryWing.dispatchPayload({ amountUSD: -10 }); // Invalid
} catch (e) {
    failed = true;
}
try {
    artilleryWing.dispatchPayload({ amountUSD: NaN }); // Invalid (hits threshold of 3)
} catch (e) {
    failed = true;
}

// Next dispatch should be blocked by circuit breaker
let circuitTrippedCaught = false;
try {
    artilleryWing.dispatchPayload({ amountUSD: 500 });
} catch (err) {
    if (err.message.includes('Circuit breaker is TRIPPED')) {
        circuitTrippedCaught = true;
    }
}

if (circuitTrippedCaught) {
    console.log('✅ [TEST 3 PASSED]: Circuit breaker successfully tripped after consecutive failures.');
} else {
    console.error('❌ [TEST 3 FAILED]: Circuit breaker did not trip as expected.');
    process.exit(1);
}

artilleryWing.resetCircuitBreaker();
console.log('--------------------------------------------------------');
console.log('✅ ALL ARTILLERY WING TESTS PASSED SUCCESSFULLY.');
console.log('--------------------------------------------------------');
