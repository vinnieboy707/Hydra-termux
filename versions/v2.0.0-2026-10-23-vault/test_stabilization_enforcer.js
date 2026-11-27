/**
 * Test script for SystemStabilizationEnforcer
 */
const { SystemStabilizationEnforcer } = require('./src/system-stabilization-enforcer');

async function runTest() {
  console.log("Running System Stabilization Enforcer tests...");

  // Instantiate with custom threshold to test trigger behavior
  const enforcer = new SystemStabilizationEnforcer({ threshold: 10, intervalMs: 1000 });
  
  // Test evaluation under low/high threshold condition
  const result = await enforcer.enforce();
  console.log("Enforce result:", result);

  if (result.status === 'stabilized' || result.status === 'optimal') {
    console.log("SUCCESS: SystemStabilizationEnforcer executed evaluation correctly.");
  } else {
    console.error("FAILURE: Unexpected enforcer status.");
  }

  process.exit(0);
}

runTest();
