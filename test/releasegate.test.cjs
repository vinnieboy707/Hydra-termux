'use strict';
// The release gate runs every check in a fixed order and never reports a skipped check as passed; the server record
// matches the functions and schema being shipped. Real counterpart: the deployed functions themselves (portal-backend
// in chronos verify-real) and package.sh, which refuses to build when the gate fails.
const test = require('node:test');
const assert = require('node:assert');
const G = require('../lib/releasegate.cjs');

test('release gate: all nine checks, in order; the shipped server is what was deployed', () => {
  assert.deepStrictEqual(G.STEPS.map((s) => s[0]), ['version', 'syntax', 'docs', 'settings', 'contract', 'server', 'counterparts', 'planted-bugs', 'tests']);
  const rec = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'DEPLOYED.json'), 'utf8'));
  assert.deepStrictEqual({ schema: rec.schema, functions: rec.functions }, G.serverFingerprint(), 'server/DEPLOYED.json is current');
  const r = G.check({ only: ['version', 'contract', 'server'] });
  assert.deepStrictEqual(r.results.map((x) => [x.id, x.ok]), [['version', true], ['contract', true], ['server', true]]);
  assert.strictEqual(G.check({ only: ['no-such-check'] }).results.length, 0);
});
