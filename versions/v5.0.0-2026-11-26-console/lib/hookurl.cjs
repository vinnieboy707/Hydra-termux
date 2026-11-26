'use strict';
// Where alerts go when you have not set a webhook of your own: your Supabase project's `alerts` function (the same
// project as releases and ingest), signed by this device's key, so nothing needs creating or sharing. Set
// CHRONOS_ALERT_WEBHOOK_URL / CHRONOS_WEBHOOK_URL to your own https url to send them there instead, or to `off` to
// send them nowhere (phone notifications and the engine's log still have everything).
const DV = require('./device.cjs');

const OFF = /^(off|none|false|0)$/i;
/** your project's alerts function, next to the release function */
const ownUrl = () => DV.BASE.replace(/\/release\/?$/, '/alerts');
/** the url alerts for `key` go to: your value, else your project's alerts function; null when set to off */
function effective(get, key) {
  const v = String(get(key) || '').trim();
  if (OFF.test(v)) return null;
  return v || ownUrl();
}
/** is this your project's alerts function (then requests are device-signed instead of HMAC/unsigned) */
function isOwn(url) {
  try { const u = new URL(url), o = new URL(DV.BASE); return u.origin === o.origin && /\/functions\/v1\/alerts\/?$/.test(u.pathname); } catch (_) { return false; }
}
/** request headers for a JSON body posted to url */
function headersFor(url, body) {
  return isOwn(url) ? require('./sync.cjs').signedHeaders(body) : { 'content-type': 'application/json' };
}

module.exports = { effective, isOwn, headersFor, ownUrl, OFF };
