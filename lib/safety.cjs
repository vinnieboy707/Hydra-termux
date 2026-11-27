'use strict';
// Safety helpers used everywhere text from outside reaches the screen or a log.
// 1) redact(): error messages from RPC libraries can contain your node URL (with its API key). Strip it.
// 2) clean():  token symbols and file contents are untrusted. A symbol containing terminal escape codes could
//    rewrite your screen, so control characters are removed and length is capped.
const URL_RE = /\b(?:https?|wss?):\/\/[^\s"'<>)]+/gi;
const KEYISH_RE = /\b[A-Za-z0-9_-]{32,}\b/g;              // long API-key-like tokens
const HEX64_RE = /\b0x[0-9a-fA-F]{64}\b/g;               // 32-byte hex (could be a private key)

function redact(msg) {
  return String(msg == null ? '' : msg).replace(URL_RE, '[rpc-url]').replace(HEX64_RE, '0x[64-hex]').replace(KEYISH_RE, '[redacted]');
}
function clean(s, max = 40) {
  // eslint-disable-next-line no-control-regex
  const t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim();
  return [...t].slice(0, max).join('');
}
/**
 * A rejection or error left behind by a connection the engine already closed or replaced (ethers' websocket provider
 * when a feed reconnects; the socket library when a socket is closed while still connecting). They carry no work and
 * must never end the engine. Anything else is still fatal. More than 50 in 10 minutes is treated as fatal too, so a
 * real loop is never hidden.
 */
const BENIGN = [/provider destroyed; cancelled request/, /WebSocket was closed before the connection was established/, /operation="eth_(un)?subscribe".*UNSUPPORTED_OPERATION|UNSUPPORTED_OPERATION.*operation="eth_(un)?subscribe"/];
const benignSeen = [];
function benignNetworkError(e, now = Date.now()) {
  const m = String((e && (e.shortMessage ? e.shortMessage + ' ' + (e.message || '') : e.message)) || e);
  if (!BENIGN.some((r) => r.test(m))) return false;
  while (benignSeen.length && now - benignSeen[0] > 600000) benignSeen.shift();
  benignSeen.push(now);
  return benignSeen.length <= 50;
}
module.exports = { benignNetworkError, redact, clean };
