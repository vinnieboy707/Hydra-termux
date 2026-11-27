'use strict';
// Autopilot end to end in a fake phone home (synthetic test data only): keys pulled from "Drive" (fake rclone),
// tested and imported, settings filled, .env locked down, backup scripts fixed, fake-profit script quarantined,
// registry audited, gas calibrated from a real receipt, first scan run, report written; second run changes nothing.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { ethers } = require('ethers');
const I = require('../lib/integrity.cjs');

const ROOT = path.join(__dirname, '..');
const NODE = process.execPath;

function sealedCopy() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chronos-copy-'));
  for (const f of I.codeFiles()) { const d = path.join(tmp, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), d); fs.chmodSync(d, 0o644); }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
  assert.strictEqual(spawnSync(NODE, [path.join(tmp, 'bin', 'chronos.cjs'), 'seal', '--yes']).status, 0);
  return tmp;
}
async function devchain() {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const p = spawn(NODE, [path.join(ROOT, 'test', 'devchain.cjs')], { cwd: ROOT, env: { ...process.env, DEVCHAIN_PORT: String(port) }, stdio: ['ignore', 'pipe', 'ignore'] });
  const line = await new Promise((res, rej) => { let b = ''; const t = setTimeout(() => rej(new Error('devchain timeout')), 90000); p.stdout.on('data', (d) => { b += d; const i = b.indexOf('\n'); if (i >= 0) { clearTimeout(t); res(b.slice(0, i)); } }); });
  const env = JSON.parse(line);
  const rpc = fs.readFileSync(env.ENV_FILE, 'utf8').match(/^ARB_RPC_URL=(.*)$/m)[1];
  return { proc: p, env, rpc };
}

test('autopilot does every step that does not need you, and is safe to run twice', async () => {
  const copy = sealedCopy();
  const dc = await devchain();
  let env;
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phone-'));
    const home = path.join(tmp, 'home'); const ws = path.join(home, 'workspaces', 'chronos-master-workspace');
    for (const d of ['scripts', 'src', 'data']) fs.mkdirSync(path.join(ws, d), { recursive: true });
    fs.writeFileSync(path.join(ws, '.env'), '# mine\nMIN_NET_PROFIT_USD=0.35   # my floor\n', { mode: 0o644 }); fs.chmodSync(path.join(ws, '.env'), 0o644);
    fs.writeFileSync(path.join(ws, 'scripts', 'upload-to-drive.mjs'), 'import fs from "fs";\nimport path from "path";\nexport function pack(archive) {\n    if (fs.existsSync("data")) archive.directory(path.join(process.cwd(), "data"), "data");\n    if (fs.existsSync(".env")) archive.file(path.join(process.cwd(), ".env"), { name: ".env" });\n    return archive;\n}\n// google drive.files.create upload below\n');
    fs.writeFileSync(path.join(ws, 'scripts', 'sync-contracts-to-drive.mjs'), 'import fs from "fs";\nexport function list(allFiles) {\n    if (fs.existsSync(".env")) allFiles.push(".env");\n    return allFiles;\n}\n// googleapis drive.files.create\n');
    fs.writeFileSync(path.join(ws, 'master-arbitrage-engine.js'), '// reports profit that never happened\n');
    fs.copyFileSync(path.join(dc.env.CHRONOS_WORKSPACE, 'src', 'registry.ts'), path.join(ws, 'src', 'registry.ts'));
    // one real confirmed transaction on the test chain, recorded the way your scripts record them
    const p = new ethers.JsonRpcProvider(dc.rpc, 42161, { staticNetwork: true });
    const signer = await p.getSigner(0);
    const tx = await signer.sendTransaction({ to: await signer.getAddress(), value: 1n }); await tx.wait();
    fs.writeFileSync(path.join(ws, 'data', 'verified_mainnet_actions.json'), JSON.stringify({ payoutWallet: '0x000000000000000000000000000000000000bEEF', actions: { swap: { txHash: tx.hash, blockNumber: 1, summary: 'test' } } }));
    p.destroy();
    // "Google Drive": a fake rclone that serves one env file, like your _.ENV SECRETS .txt
    const bin = path.join(tmp, 'bin'); fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'rclone'), `#!/bin/sh
if [ "$1" = "listremotes" ]; then echo "gdrive:"; exit 0; fi
if [ "$1" = "copy" ]; then mkdir -p "$3/Secrets"; printf 'ARB_RPC_URL=${dc.rpc}\\nOPENROUTER_API_KEY=sk-or-v1-TESTKEYabcdefghijklmnop\\nTAX_RESERVE_VAULT=0x000000000000000000000000000000000000dead\\nRAPIDAPI_KEY=your_key_here\\n' > "$3/Secrets/_.ENV SECRETS .txt"; exit 0; fi
exit 1
`, { mode: 0o755 });
    env = { ...process.env, HOME: home, PATH: bin + path.delimiter + process.env.PATH, CHRONOS_DATA_DIR: path.join(tmp, 'data'),
      CHRONOS_AAVE_POOL: dc.env.CHRONOS_AAVE_POOL, CHRONOS_WETH: dc.env.CHRONOS_WETH, CHRONOS_VENUES_FILE: dc.env.CHRONOS_VENUES_FILE, CHRONOS_MULTICALL: dc.env.CHRONOS_MULTICALL };
    delete env.ENV_FILE; delete env.CHRONOS_WORKSPACE;
    const run = () => spawnSync(NODE, [path.join(copy, 'bin', 'chronos.cjs'), 'autopilot', '--no-service'], { env, cwd: tmp, encoding: 'utf8', timeout: 400000 });

    const r = run();
    const outTxt = r.stdout + r.stderr;
    assert.strictEqual(r.status, 0, outTxt);
    const envTxt = fs.readFileSync(path.join(ws, '.env'), 'utf8');
    assert.strictEqual(fs.statSync(path.join(ws, '.env')).mode & 0o777, 0o600, 'S0: .env locked to you');
    assert.match(envTxt, /^# mine\nMIN_NET_PROFIT_USD=0\.35 {3}# my floor\n/, 'your own lines and comments are kept');
    assert.ok(envTxt.includes(`ARB_RPC_URL=${dc.rpc}`), 'RPC imported from the Drive file after a live chain check');
    assert.match(envTxt, /OPENROUTER_API_KEY=sk-or-v1-TESTKEY/);
    assert.match(envTxt, /TAX_RESERVE_VAULT=0x000000000000000000000000000000000000dEaD/, 'address imported checksummed');
    assert.doesNotMatch(envTxt, /RAPIDAPI_KEY/, 'placeholders are never imported');
    assert.match(envTxt, /GAS_UNITS_ASSUMED=900000/); assert.match(envTxt, /GO_MIN_EPISODES=5/);
    assert.ok(!fs.readdirSync(path.join(home, '.chronos')).some((d) => d.startsWith('drive_pull_')), 'Drive copies deleted after import');
    for (const f of ['upload-to-drive.mjs', 'sync-contracts-to-drive.mjs']) {
      const src = fs.readFileSync(path.join(ws, 'scripts', f), 'utf8');
      assert.match(src, /\/\/ \[chronos\] disabled: this line put your \.env/);
      assert.strictEqual(spawnSync(NODE, ['--check', path.join(ws, 'scripts', f)]).status, 0, `${f} still parses`);
      assert.ok(fs.readdirSync(path.join(ws, 'scripts')).some((x) => x.startsWith(f + '.chronos-bak-')), 'backup kept');
    }
    assert.ok(!fs.existsSync(path.join(ws, 'master-arbitrage-engine.js')));
    assert.ok(fs.readdirSync(path.join(ws, '_quarantine')).length === 1);
    const gas = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'gas_calibration.json'), 'utf8'));
    assert.strictEqual(gas.transactions.length, 1); assert.strictEqual(gas.transactions[0].gasUsed, 21000);
    assert.ok(fs.existsSync(path.join(tmp, 'data', 'registry_audit.json')));
    for (const s of ['Code integrity', 'Import keys', 'Backup scripts', 'Arbitrum node', 'First scan', 'came online', 'Live opportunity scanner and dashboard', 'Rotate these keys', 'ARB_RPC_URL', 'Restrict link sharing on 4 Drive items']) assert.ok(outTxt.includes(s), 'report mentions: ' + s);
    assert.doesNotMatch(outTxt, /sk-or-v1-TESTKEY|127\.0\.0\.1:\d+/, 'no key or node url is ever printed');
    const report = fs.readFileSync(path.join(tmp, 'data', 'autopilot_report.txt'), 'utf8');
    assert.doesNotMatch(report, /sk-or-v1-TESTKEY|127\.0\.0\.1:\d+/);
    assert.strictEqual(fs.statSync(path.join(tmp, 'data', 'autopilot_report.txt')).mode & 0o777, 0o600);

    // second run: nothing left to do, nothing broken
    const before = fs.readFileSync(path.join(ws, '.env'), 'utf8');
    const r2 = run();
    assert.strictEqual(r2.status, 0, r2.stdout + r2.stderr);
    assert.strictEqual(fs.readFileSync(path.join(ws, '.env'), 'utf8'), before, 'second run leaves .env unchanged');
    assert.match(r2.stdout, /no script uploads \.env to Drive/);
    assert.match(r2.stdout, /none in your workspace/);
  } finally {
    dc.proc.kill('SIGKILL');
    // reading the service status starts a PM2 daemon in the fake home; stop it so tests leave nothing running
    if (env) spawnSync('pm2', ['kill'], { env, timeout: 30000, stdio: 'ignore' });
  }
});
