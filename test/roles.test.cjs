'use strict';
// Device roles: the primary works, standbys back it up, exactly one device sends, a silent primary is replaced by
// exactly one standby and gets its job back when it reports again. Real counterpart: the engines' own heartbeats in
// your database (the insights function returns them; verify-real portal-backend checks that route).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const R = require('../lib/roles.cjs');

test('roles: stored per device; primary by default', () => {
  process.env.CHRONOS_ROLE_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'role-')), 'role');
  try {
    assert.strictEqual(R.read(), 'primary', 'no file: primary (a single device works as before)');
    R.write('standby'); assert.strictEqual(R.read(), 'standby');
    assert.throws(() => R.write('boss'), /primary or standby/);
    assert.strictEqual((fs.statSync(process.env.CHRONOS_ROLE_FILE).mode & 0o777), 0o600);
  } finally { delete process.env.CHRONOS_ROLE_FILE; }
});

test('roles: one sender at all times; takeover after 10 silent minutes, by exactly one standby; hand back', () => {
  const now = Date.parse('2026-11-26T04:00:00Z'); const ago = (m) => new Date(now - m * 60000).toISOString();
  const laptop = { service: 'chronos-engine@vdizzle', role: 'primary', acting: 'primary' };
  const a = 'chronos-engine@localhost', b = 'chronos-engine@localhost-EJCZ';
  assert.strictEqual(R.decide({ role: 'primary', me: 'x', engines: null, now }).acting, 'primary');
  const live = [{ ...laptop, ts: ago(1) }, { service: a, role: 'standby', ts: ago(1) }, { service: b, role: 'standby', ts: ago(1) }];
  assert.strictEqual(R.decide({ role: 'standby', me: a, engines: live, now }).acting, 'standby');
  assert.strictEqual(R.decide({ role: 'standby', me: b, engines: live, now }).acting, 'standby');
  const silent = [{ ...laptop, ts: ago(11) }, { service: a, role: 'standby', ts: ago(1) }, { service: b, role: 'standby', ts: ago(1) }];
  const da = R.decide({ role: 'standby', me: a, engines: silent, now }), db = R.decide({ role: 'standby', me: b, engines: silent, now });
  assert.deepStrictEqual([da.acting, db.acting], ['primary', 'standby'], 'exactly one standby takes over');
  assert.match(db.why, /localhost takes over/);
  // the one that took over keeps it while the primary stays silent, even when it is no longer listed as standby-only
  const after = [{ ...laptop, ts: ago(15) }, { service: a, role: 'standby', acting: 'primary', ts: ago(0.5) }, { service: b, role: 'standby', ts: ago(1) }];
  assert.strictEqual(R.decide({ role: 'standby', me: b, engines: after, now }).acting, 'standby');
  // the laptop is back: everyone stands by again
  const back = [{ ...laptop, ts: ago(0.2) }, { service: a, role: 'standby', acting: 'primary', ts: ago(0.5) }];
  assert.strictEqual(R.decide({ role: 'standby', me: a, engines: back, now }).acting, 'standby');
  // no database: a standby never takes over blind (it could be the second sender)
  assert.strictEqual(R.decide({ role: 'standby', me: a, engines: null, now }).acting, 'standby');
  assert.deepStrictEqual(R.STANDBY_ENV, { CHRONOS_VP_AI_MAX_PER_DAY: '0', CHRONOS_TEMPO_MAX: '0' });
});

test('sending: only the acting primary, and only while it hears from your database, so two devices never send at once', () => {
  const R = require('../lib/roles.cjs'); const now = Date.parse('2026-11-26T12:00:00Z');
  assert.strictEqual(R.canSend({ acting: 'standby', dbEnabled: true, lastDbOkAt: now, now }).ok, false);
  assert.strictEqual(R.canSend({ acting: 'primary', dbEnabled: true, lastDbOkAt: now - 60000, now }).ok, true);
  const cut = R.canSend({ acting: 'primary', dbEnabled: true, lastDbOkAt: now - 8 * 60000, now });
  assert.strictEqual(cut.ok, false, 'a primary cut off from the database stops sending'); assert.match(cut.why, /8 min/);
  assert.strictEqual(R.canSend({ acting: 'primary', dbEnabled: true, lastDbOkAt: 0, now }).ok, false, 'not before the first word from the database');
  assert.ok(R.SEND_DB_MS < R.TAKEOVER_MS, 'it stops before any standby could take over');
  assert.strictEqual(R.canSend({ acting: 'primary', dbEnabled: false, lastDbOkAt: 0, now }).ok, true, 'a single device without a shared database is the only sender');
});
