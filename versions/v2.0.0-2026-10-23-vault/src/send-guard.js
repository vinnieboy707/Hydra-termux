'use strict';
const fs = require('fs');
const path = require('path');
const KILL_FILE = process.env.KILL_SWITCH_FILE || path.resolve(__dirname, '..', 'KILL_SWITCH');

// Every money-moving call must pass through here. Blocked unless CHRONOS_LIVE=1 and no kill switch.
function assertLiveAllowed(label) {
  if (process.env.KILL_SWITCH === '1' || fs.existsSync(KILL_FILE)) {
    throw new Error('[send-guard] kill switch active: refusing ' + label);
  }
  if (process.env.CHRONOS_LIVE !== '1') {
    throw new Error('[send-guard] CHRONOS_LIVE is not 1: refusing ' + label + ' (dry-run default)');
  }
}
module.exports = { assertLiveAllowed };
