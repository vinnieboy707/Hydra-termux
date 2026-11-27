'use strict';
// chronos setup and chronos set: key import, validation, hidden secret entry, and safe .env edits.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const E = require('../lib/envfile.cjs');
const IMP = require('../lib/importer.cjs');
const CAP = require('../lib/capabilities.cjs');
const C = require('../lib/catalog.cjs');
const { parseValue, loadConfig } = require('../lib/config.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'setup-'));

test('.env parsing: inline comments and quotes read like dotenv (copying the example file now works)', () => {
  assert.strictEqual(parseValue('900000          # ASSUMPTION'), '900000');
  assert.strictEqual(parseValue('"a b" # c'), 'a b');
  assert.strictEqual(parseValue('https://x/v2/key#frag'), 'https://x/v2/key#frag');
  const d = tmp(); const f = path.join(d, '.env');
  fs.writeFileSync(f, 'GAS_UNITS_ASSUMED=900000   # note\n');
  assert.ok(!loadConfig(f).problems.some((p) => p.startsWith('GAS_UNITS_ASSUMED')));
});

test('.env writer keeps your lines, backs up, writes 600, and refuses values that could break the file', () => {
  const d = tmp(); const f = path.join(d, '.env');
  fs.writeFileSync(f, '# my comment\nKEEP_ME=1   # mine\nMIN_NET_PROFIT_USD=0.35\n', { mode: 0o644 });
  const doc = E.load(f);
  E.set(doc, 'MIN_NET_PROFIT_USD', '0.5'); E.set(doc, 'NEW_KEY', 'abc');
  const { backup } = E.save(doc);
  const txt = fs.readFileSync(f, 'utf8');
  assert.match(txt, /# my comment\nKEEP_ME=1 {3}# mine\nMIN_NET_PROFIT_USD=0\.5\nNEW_KEY=abc\n/);
  assert.strictEqual(fs.statSync(f).mode & 0o777, 0o600);
  assert.strictEqual(fs.statSync(backup).mode & 0o777, 0o600);
  assert.match(fs.readFileSync(backup, 'utf8'), /MIN_NET_PROFIT_USD=0\.35/);
  for (const bad of ['a\nEVIL=1', 'x"y', "x'y", 'x`y']) assert.throws(() => E.set(doc, 'K', bad));
  assert.throws(() => E.set(doc, 'BAD-NAME', 'x'));
  for (let i = 0; i < 8; i++) { E.set(doc, 'N', String(i)); E.save(doc); }
  assert.ok(fs.readdirSync(d).filter((x) => x.startsWith('.env.bak-')).length <= 6, 'old backups are pruned');
  assert.strictEqual(E.mask('sk-or-v1-abcdefgh1234'), '••••••1234');
});

test('importer finds keys in env files on the device, ignores placeholders, reports conflicts and Drive copies', () => {
  const h = tmp();
  const ws = path.join(h, 'workspaces', 'w'); fs.mkdirSync(path.join(ws, 'gdrive_sync', 'env_sources'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'node_modules', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'gdrive_sync', 'env_sources', '.env.txt'), 'OPENROUTER_API_KEY=sk-or-v1-aaaaaaaaaaaaaaaa\nRAPIDAPI_KEY=your_key_here\nSUPABASE_SERVICE_KEY=one111111111111111111111111111111\n');
  fs.writeFileSync(path.join(ws, 'old.env'), 'SUPABASE_SERVICE_KEY=two222222222222222222222222222222\nOPENROUTER_API_KEY=sk-or-v1-aaaaaaaaaaaaaaaa\n');
  fs.writeFileSync(path.join(ws, 'node_modules', 'pkg', '.env'), 'DATA_GOV_API_KEY=shouldnotbefound123456789\n');
  fs.writeFileSync(path.join(ws, '.env.example'), 'CARSXE_API_KEY=examplevalue12345\n');
  const { result, files } = IMP.scan(['OPENROUTER_API_KEY', 'RAPIDAPI_KEY', 'SUPABASE_SERVICE_KEY', 'DATA_GOV_API_KEY', 'CARSXE_API_KEY'], { home: h });
  assert.strictEqual(files.length, 2);
  assert.strictEqual(result.OPENROUTER_API_KEY.length, 1); assert.strictEqual(result.OPENROUTER_API_KEY[0].sources.length, 2);
  assert.ok(result.OPENROUTER_API_KEY[0].fromDrive);
  assert.strictEqual(result.SUPABASE_SERVICE_KEY.length, 2, 'two different values = conflict, you choose');
  assert.ok(!result.RAPIDAPI_KEY, 'placeholder ignored');
  assert.ok(!result.DATA_GOV_API_KEY, 'node_modules skipped');
  assert.ok(!result.CARSXE_API_KEY, '.example files skipped');
});

test('capabilities: report what comes online when keys and settings are present', async () => {
  const env = {};
  const get = (k) => env[k];
  const awake = () => new Set(CAP.evaluate(get, false).filter((c) => c.awake).map((c) => c.name));
  assert.ok(!awake().has('Registry audit and gas calibration'));
  env.ARB_RPC_URL = 'https://x';
  assert.ok(awake().has('Registry audit and gas calibration'));
  assert.ok(!awake().has('Live opportunity scanner and dashboard'), 'scanner also needs complete settings');
  assert.ok(new Set(CAP.evaluate(get, true).filter((c) => c.awake).map((c) => c.name)).has('Live opportunity scanner and dashboard'));
  env.VERYFI_CLIENT_ID = 'a'; assert.ok(!awake().has('Receipt and document OCR (Veryfi)'), 'needs all three Veryfi values');
  const fo = CAP.evaluate(get, true).find((c) => c.name === 'Node failover visibility');
  assert.deepStrictEqual(fo.missing, ['a second RPC url']);
});

test('catalog validators: addresses are checksummed, junk rejected, settings range-checked', async () => {
  const addr = C.SECRETS.find((s) => s.key === 'TAX_RESERVE_VAULT');
  const r = await addr.test('0x000000000000000000000000000000000000dead');
  assert.ok(r.ok); assert.strictEqual(r.normalized, '0x000000000000000000000000000000000000dEaD');
  assert.ok(!(await addr.test('0x123')).ok);
  const or = C.SECRETS.find((s) => s.key === 'OPENROUTER_API_KEY');
  assert.ok(!(await or.test('not-a-key')).ok);
  assert.ok(!(await C.SECRETS.find((s) => s.key === 'ARB_RPC_URL').test('ftp://nope')).ok);
  const ladder = C.SETTINGS.find((s) => s.key === 'SIZE_LADDER_USD');
  assert.strictEqual(C.checkSetting(ladder, '200,500,1000'), null);
  assert.ok(C.checkSetting(ladder, '200,abc'));
  assert.ok(C.checkSetting(C.SETTINGS.find((s) => s.key === 'SCAN_TOPK'), '2.5'));
  assert.ok(C.checkSetting(C.SETTINGS.find((s) => s.key === 'POLICY_T1_TAX_BPS'), '20000'));
});

test('fixers: single-statement .env upload lines are disabled with a backup; anything multi-line is left for you', () => {
  const FIX = require('../lib/fixers.cjs');
  const ws = tmp(); fs.mkdirSync(path.join(ws, 'scripts'));
  const good = 'import fs from "fs";\nexport function a(z) {\n    if (fs.existsSync(".env")) z.push(".env");\n    return z;\n}\n// drive.files.create\n';
  const tricky = 'import fs from "fs";\nexport function b(allFiles) {\n    if (fs.existsSync(".env"))\n        allFiles.push(".env");\n    return allFiles;\n}\n// drive.files.create\n';
  fs.writeFileSync(path.join(ws, 'scripts', 'good.mjs'), good);
  fs.writeFileSync(path.join(ws, 'scripts', 'tricky.mjs'), tricky);
  const r = FIX.fixUploadScripts(ws);
  const g = r.find((x) => x.file === 'scripts/good.mjs'), t = r.find((x) => x.file === 'scripts/tricky.mjs');
  assert.ok(g.ok); assert.match(fs.readFileSync(path.join(ws, 'scripts', 'good.mjs'), 'utf8'), /\[chronos\] disabled/);
  assert.ok(!t.ok, 'a statement split over lines is not touched');
  assert.strictEqual(fs.readFileSync(path.join(ws, 'scripts', 'tricky.mjs'), 'utf8'), tricky, 'file left exactly as it was');
  assert.match(t.msg, /edit it by hand/);
});
