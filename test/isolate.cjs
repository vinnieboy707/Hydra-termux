'use strict';
// Loaded before every test file: tests never reach your real portal or release service, and never touch this
// machine's own device key. A test that needs those points them at its own local stand-in.
const os = require('os'); const path = require('path'); const fs = require('fs');
if (!process.env.CHRONOS_RELEASE_BASE) process.env.CHRONOS_RELEASE_BASE = 'http://127.0.0.1:9/release'; // nothing listens on 9: refused at once
if (!process.env.CHRONOS_DEVICE_KEY) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-test-device-')); process.env.CHRONOS_DEVICE_KEY = path.join(d, 'device.key'); }
if (!process.env.CHRONOS_DISCOVER_TOKENS) process.env.CHRONOS_DISCOVER_TOKENS = '0'; // tests never reach the public token list
