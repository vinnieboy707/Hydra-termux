'use strict';
/**
 * test_notification_policy.js
 *
 * Verifies NotificationPolicyManager alerts for errors, build failures, service offline status, money movements, and optimization suggestions.
 */

const { NotificationPolicyManager } = require('./src/notification-policy-manager');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const testAlertLog = path.resolve(__dirname, './data/test_alert_history.log');
if (fs.existsSync(testAlertLog)) fs.unlinkSync(testAlertLog);

console.log('========================================================');
console.log('CHRONOS OS // NOTIFICATION POLICY MANAGER TEST SUITE');
console.log('========================================================');

const notifier = new NotificationPolicyManager({ alertLogPath: testAlertLog });

notifier.notifyError(new Error('insufficient available balance'));
notifier.notifyBuildFailure('npm test', 'syntax error in module');
notifier.notifyServiceOffline('live-revenue-dashboard', 3800);
notifier.notifyMoneyMovement('Stripe Payout', 250.00, 'Destination Bank Account ending in ****');
notifier.proposeOptimization('Increase compounding frequency to 3-second intervals during high volatility.');

assert.strictEqual(fs.existsSync(testAlertLog), true, 'Alert log should be created');
const logs = fs.readFileSync(testAlertLog, 'utf8').trim().split('\n');
assert.strictEqual(logs.length, 5, 'Should log exactly 5 notification events');

console.log('✅ PASS: All notification policy tests verified successfully.');
console.log('========================================================');

if (fs.existsSync(testAlertLog)) fs.unlinkSync(testAlertLog);
