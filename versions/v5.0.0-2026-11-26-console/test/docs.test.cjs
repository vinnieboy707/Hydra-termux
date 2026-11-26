'use strict';
// Documentation matches the code: every generated section is current, every module says what it is for, the changelog
// covers this version, and every test file is run. A stale doc fails the suite (and packaging).
const test = require('node:test');
const assert = require('node:assert');
const D = require('../lib/docs.cjs');

test('documentation is current with the code', () => {
  const problems = D.check();
  assert.deepStrictEqual(problems, [], 'run  chronos docs  and update CHANGELOG.md / module headers:\n' + problems.join('\n'));
});

test('generated sections reflect the code they come from', () => {
  const C = require('../lib/catalog.cjs');
  const s = D.blocks.settings();
  for (const x of C.SETTINGS) assert.ok(s.includes('`' + x.key + '`'), `${x.key} documented`);
  const k = D.blocks.secrets();
  for (const x of C.SECRETS) assert.ok(k.includes('`' + x.key + '`'), `${x.key} documented`);
  const p = D.blocks.policy();
  for (const x of require('../lib/execpolicy.cjs').POLICY) assert.ok(p.includes('`' + x.key + '`'), `${x.key} documented`);
  const c = D.blocks.commands();
  for (const cmd of ['chronos deploy', 'chronos payout', 'chronos research [h]', 'chronos docs']) assert.ok(c.includes('`' + cmd + '`'), `${cmd} documented`);
  assert.ok(D.blocks.tests().includes(`${D.mutants()} planted bugs`));
  // a doc whose generated part no longer matches the code is stale; a current one is not
  const fake = '<!-- GENERATED:version -->\nVersion **0.0.0**.\n<!-- /GENERATED:version -->';
  assert.strictEqual(D.stale('docs/README.md', fake), true);
  assert.strictEqual(D.stale('docs/README.md', D.render(fake, 'docs/README.md')), false);
});

test('dead links, missing sections and insecure links are caught; every page leads home', () => {
  const bad = D.links('docs/README.md', '[a](NOPE.md) [b](OPERATIONS.md#no-such-section) [c](http://example.com) [d](OPERATIONS.md#rollback) [e](https://example.com)');
  assert.ok(bad.some((x) => /dead link NOPE\.md/.test(x)));
  assert.ok(bad.some((x) => /no section #no-such-section/.test(x)));
  assert.ok(bad.some((x) => /insecure link http:/.test(x)));
  assert.strictEqual(bad.length, 3, 'valid links pass: ' + bad.join('; '));
  for (const [f] of D.PAGES) { const n = D.nav(f); assert.ok(/\[(Project home|Docs home)\]/.test(n), `${f} links home`); }
  assert.ok(D.anchors('## First-time setup, in order').has('first-time-setup-in-order'));
});
