'use strict';
// Every key and setting the setup screen knows about: what it is for, whether it is secret, how it is checked.
// Names come from your own codebase. "verified" means a live test passed; "format" means only the shape was checked
// because no safe test call exists for that service.
const fs = require('fs');
const { ethers } = require('ethers');

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))]);

async function testRpc(url) {
  if (!/^https?:\/\//.test(url)) return { ok: false, msg: 'must start with https://' };
  // a fixed network: ethers never starts its "detect network, retry in 1s" loop on a url that does not answer (that
  // loop kept chronos keys waiting forever); eth_chainId below still checks it really is Arbitrum One
  const p = new ethers.JsonRpcProvider(url, 42161, { staticNetwork: ethers.Network.from(42161) });
  try {
    const t0 = Date.now();
    const [cid, blk] = await timeout(Promise.all([p.send('eth_chainId', []), p.send('eth_blockNumber', [])]), 8000);
    const chain = Number(BigInt(cid));
    if (chain !== 42161) return { ok: false, msg: `answers as chain ${chain}, not Arbitrum One (42161)` };
    return { ok: true, level: 'verified', msg: `Arbitrum One · block ${Number(BigInt(blk))} · ${Date.now() - t0} ms` };
  } catch (e) { return { ok: false, msg: 'node did not answer: ' + String(e.shortMessage || e.message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 60) }; }
  finally { p.destroy(); }
}
async function testAlchemyKey(key) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return { ok: false, msg: 'does not look like an Alchemy key' };
  const r = await testRpc(`https://arb-mainnet.g.alchemy.com/v2/${key}`);
  return r.ok ? { ...r, msg: 'Alchemy Arbitrum endpoint answers · ' + r.msg } : r;
}
async function testOpenRouter(key) {
  if (!/^sk-or-/.test(key)) return { ok: false, msg: 'OpenRouter keys start with sk-or-' };
  try {
    const r = await timeout(fetch('https://openrouter.ai/api/v1/auth/key', { headers: { Authorization: `Bearer ${key}` } }), 8000);
    if (r.status === 200) return { ok: true, level: 'verified', msg: 'OpenRouter accepted the key' };
    if (r.status === 401 || r.status === 403) return { ok: false, msg: 'OpenRouter rejected the key' };
    return { ok: true, level: 'format', msg: `OpenRouter answered ${r.status}; saved without verification` };
  } catch (e) { return { ok: true, level: 'format', msg: 'could not reach OpenRouter; saved without verification' }; }
}
// Anthropic: the models list answers 200 to a working key and bills nothing
async function testAnthropic(key) {
  if (!/^sk-ant-/.test(key)) return { ok: false, msg: 'Anthropic keys start with sk-ant-' };
  try {
    const r = await timeout(fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } }), 8000);
    if (r.status === 200) return { ok: true, level: 'verified', msg: 'Anthropic accepted the key' };
    if (r.status === 401 || r.status === 403) return { ok: false, msg: 'Anthropic rejected the key' };
    return { ok: true, level: 'format', msg: `Anthropic answered ${r.status}; saved without verification` };
  } catch (e) { return { ok: true, level: 'format', msg: 'could not reach Anthropic; saved without verification' }; }
}
// a websocket url is tested live: it must connect and answer as Arbitrum One within 8 s
const wssLive = async (v) => {
  if (!/^wss:\/\/\S+$/.test(v)) return { ok: false, msg: 'must start with wss://' };
  const { ethers } = require('ethers');
  let p;
  try {
    p = new ethers.WebSocketProvider(v, 42161, { staticNetwork: ethers.Network.from(42161) });
    const id = await Promise.race([p.send('eth_chainId', []), new Promise((_, rej) => setTimeout(() => rej(new Error('no answer in 8 s')), 8000))]);
    return BigInt(id) === 42161n ? { ok: true, level: 'live', msg: 'connected · Arbitrum One (42161)' } : { ok: false, msg: `answers as chain ${BigInt(id)}, not Arbitrum One` };
  } catch (e) { return { ok: false, msg: 'could not connect: ' + String(e.shortMessage || e.message).slice(0, 60) }; } finally { try { if (p) p.destroy(); } catch (_) { /* closing */ } }
};

// a live check of an HTTP API key: 2xx = verified; 401/403 = refused (wrong key, not saved); a network problem saves the
// key with "not verified" (it is checked again by chronos verify-real), so a flaky connection never loses your key
async function testHttpKey(url, headers = {}, okBody = () => true) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers, signal: ctl.signal }); const body = await r.text().catch(() => '');
    // 402: 1inch's gateway answers Payment Required to a call it does not take as keyed (x402 pay-per-call)
    if (r.status === 401 || r.status === 402 || r.status === 403) return { ok: false, msg: `the service refused this key (HTTP ${r.status}): check you copied all of it` };
    if (r.ok && okBody(body)) return { ok: true, level: 'verified', msg: `accepted by the service (HTTP ${r.status})` };
    if (r.status === 429) return { ok: true, level: 'format', msg: 'the service is rate-limiting right now (HTTP 429): key saved, not verified yet' };
    return { ok: false, msg: `the service answered HTTP ${r.status}: ${body.replace(/\s+/g, ' ').slice(0, 120)}` };
  } catch (e) { return { ok: true, level: 'format', msg: 'no connection to the service: key saved, not verified yet (' + String(e.message || e).slice(0, 60) + ')' }; } finally { clearTimeout(t); }
}
const fmtOnly = (re, why) => async (v) => (re.test(v) ? { ok: true, level: 'format', msg: 'format looks right (no safe live test for this service)' } : { ok: false, msg: why });
const address = async (v) => { try { const a = ethers.getAddress(v); return { ok: true, level: 'verified', msg: `valid checksummed address ${a.slice(0, 6)}…${a.slice(-4)}`, normalized: a }; } catch (_) { return { ok: false, msg: 'not a valid 0x address (checksum failed)' }; } };
const credsFile = async (v) => {
  try {
    const st = fs.statSync(v); const j = JSON.parse(fs.readFileSync(v, 'utf8'));
    if (j.type !== 'service_account') return { ok: false, msg: 'file is not a Google service-account key' };
    return { ok: true, level: 'verified', msg: `service-account file found${(st.mode & 0o077) ? ' · WARNING: readable by others, run chmod 600 on it' : ' · permissions 600'}` };
  } catch (e) { return { ok: false, msg: 'file not found or not valid JSON' }; }
};

const SECRETS = [
  { group: 'Connection', key: 'ARB_RPC_URL', secret: true, what: 'Arbitrum One RPC url the console scans with (contains your provider key)', test: testRpc },
  { group: 'Connection', key: 'RPC_URL', secret: true, what: 'generic RPC url some of your scripts read', test: testRpc },
  { group: 'Connection', key: 'ARBITRUM_RPC_URL', secret: true, what: 'backup Arbitrum RPC url', test: testRpc },
  { group: 'Connection', key: 'ALCHEMY_RPC_URL', secret: true, what: 'Alchemy Arbitrum url', test: testRpc },
  { group: 'Connection', key: 'ARB_PRIVATE_RPC', secret: true, what: 'private / protected RPC url', test: testRpc },
  { group: 'Connection', key: 'ALCHEMY_API_KEY', secret: true, what: 'Alchemy API key (tested against its Arbitrum endpoint)', test: testAlchemyKey },
  { group: 'Connection', key: 'ARBITRUM_WSS_URL', secret: true, what: 'websocket url: the engine reacts to every new block', test: wssLive },
  { group: 'Connection', key: 'ARB_WSS_URL', secret: true, what: 'second websocket url (another provider) for a redundant block feed', test: wssLive },
  { group: 'Connection', key: 'ALCHEMY_WSS_URL', secret: true, what: 'Alchemy websocket url for a redundant block feed', test: wssLive },
  { group: 'Connection', key: 'ARBITRUM_WSS_URL_2', secret: true, what: 'another websocket url for a redundant block feed', test: wssLive },
  { group: 'AI', key: 'OPENROUTER_API_KEY', secret: true, what: 'OpenRouter key for AI agents (the only setting the AI agent needs: the model is chosen for you)', test: testOpenRouter },
  { group: 'AI', key: 'OPENROUTER_API_KEY_2', secret: true, what: 'another OpenRouter key: used in turn with the others, each the fallback of the rest', test: testOpenRouter },
  { group: 'AI', key: 'OPENROUTER_API_KEY_3', secret: true, what: 'another OpenRouter key (fallback in the rotation)', test: testOpenRouter },
  { group: 'AI', key: 'OPENROUTER_API_KEY_4', secret: true, what: 'another OpenRouter key (fallback in the rotation)', test: testOpenRouter },
  { group: 'AI', key: 'OPENROUTER_API_KEY_5', secret: true, what: 'another OpenRouter key (fallback in the rotation)', test: testOpenRouter },
  { group: 'AI', key: 'ANTHROPIC_API_KEY', secret: true, what: 'Anthropic API key: Claude directly, in the same rotation as your OpenRouter keys', test: testAnthropic },
  { group: 'AI', key: 'CHRONOS_ANTHROPIC_MODEL', secret: false, what: 'Claude model for ANTHROPIC_API_KEY (default claude-sonnet-5-5)', test: fmtOnly(/^claude-[a-z0-9.\-]+$/, 'a Claude model id such as claude-sonnet-5-5') },
  { group: 'Safety', key: 'CHRONOS_OWNER_SIGNER', secret: false, what: 'how owner actions (deploy, setup, payouts) are signed: metamask (you approve each one in MetaMask on a local page; the key never leaves MetaMask) or keystore (default: your encrypted keystore passphrase). One run: add --metamask', test: fmtOnly(/^(metamask|keystore)$/, 'metamask or keystore') },
  { group: 'Safety', key: 'CHRONOS_DAILY_SPEND_CAP_USD', secret: false, what: 'most a day (UTC) may cost in things no profit pays back: reverted trades\' gas, AI calls (default 5). Anything that could go over it waits until the next day; trades that fit keep running', test: fmtOnly(/^\d{1,5}(\.\d{1,2})?$/, 'dollars, e.g. 5 or 12.50') },
  { group: 'Safety', key: 'CHRONOS_WATCHDOG_STALL_SEC', secret: false, what: 'seconds the engine\'s loop may go without a sign of life before the watchdog restarts it (default 300, at least 60; off to turn it off)', test: fmtOnly(/^(off|\d{2,5})$/, 'seconds (60 or more) or off') },
  { group: 'AI', key: 'CHRONOS_AI_CALL_USD', secret: false, what: 'what one AI call is counted as against the daily spending cap (default 0.02 dollars)', test: fmtOnly(/^\d{1,2}(\.\d{1,4})?$/, 'dollars, e.g. 0.02') },
  { group: 'AI', key: 'CHRONOS_VP_AI_MAX_PER_DAY', secret: false, what: 'most AI analyses the VP may run a day (default 12; 0 turns the analyst off)', test: fmtOnly(/^([0-9]|[1-9][0-9]|100)$/, 'a whole number 0 to 100') },
  { group: 'AI', key: 'CHRONOS_VP_AI_MIN_GAP_MIN', secret: false, what: 'minutes between two AI analyses (default 60)', test: fmtOnly(/^([5-9]|[1-9][0-9]|[1-9][0-9][0-9]|1440)$/, 'whole minutes, 5 to 1440') },
  { group: 'AI', key: 'CHRONOS_MIND_MAX_CELLS', secret: false, what: 'most cells the honeycomb mind may hold (default 120; it grows by 15 per open task up to this)', test: fmtOnly(/^([4-9][0-9]|[1-3][0-9][0-9]|400)$/, 'a whole number 40 to 400') },
  { group: 'Connection', key: 'CHRONOS_RELAY', secret: false, what: 'price-move relay through your Supabase: share the pools your node sees move and re-quote the ones other engines saw move (default on; off to stop)', test: fmtOnly(/^(on|off)$/, 'on or off') },
  { group: 'Connection', key: 'CHRONOS_MORPHO', secret: false, what: 'Morpho Blue address that research reads for fee-free flash loans (default: Arbitrum One\'s 0x6c247b1F…8F5e; off to skip)', test: fmtOnly(/^(off|0x[0-9a-fA-F]{40})$/, 'an address or off') },
  { group: 'Connection', key: 'CHRONOS_UNI_V4', secret: false, what: 'Uniswap V4 PoolManager the engine borrows from with no fee when your contract is v2.3+ (default: Arbitrum One\'s 0x360E68fa…FB32; off to skip)', test: fmtOnly(/^(off|0x[0-9a-fA-F]{40})$/, 'an address or off') },
  { group: 'Connection', key: 'CHRONOS_TEMPO_MAX', secret: false, what: 'how far the engine may speed up when scans find real gaps: 0 (never) to 3 (scans 3× as often, 2.5× routes quoted; default 3), always inside each node\'s plan', test: fmtOnly(/^[0-3]$/, '0, 1, 2 or 3') },
  { group: 'AI', key: 'CHRONOS_ARCHIVE_FROM', secret: false, what: 'extra folders (comma-separated) the VP\'s documentation archive indexes, secrets skipped', test: fmtOnly(/^[^\n]{1,1000}$/, 'one line of folder paths') },
  { group: 'Company', key: 'CHRONOS_VP_NUDGE_HOURS', what: 'hours between the VP\'s reminders about a road-to-cash step that is yours (default 3)', test: fmtOnly(/^([1-9]|1\d|2[0-4])$/, 'whole hours, 1 to 24') },
  { group: 'Company', key: 'CHRONOS_VP_AUDIT_MIN', what: 'minutes between the VP\'s audits after its tasks (your checks + Blockscout + next step; default 30)', test: fmtOnly(/^([5-9]|[1-9]\d|1[0-7]\d|180)$/, 'whole minutes, 5 to 180') },
  { group: 'Company', key: 'CHRONOS_VP_QUIET', what: 'quiet hours for those reminders, local time HH-HH (default 21-08; milestone results and money alerts still come)', test: fmtOnly(/^([01]?\d|2[0-3])-([01]?\d|2[0-3])$/, 'like 21-08') },
  { group: 'Company', key: 'CHRONOS_INDICATOR_RETIRE_DAYS', what: 'days an indicator may run without firing once before it is retired (default 7; it comes back the first time it would fire)', test: fmtOnly(/^([1-9]|[1-8]\d|90)$/, 'whole days, 1 to 90') },
  { group: 'Company', key: 'CHRONOS_REPORT_TIME', what: 'local time the VP writes your daily report (HH:MM, 24 h; default 07:30)', test: fmtOnly(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM, 24-hour') },
  { group: 'Company', key: 'CHRONOS_AUTO_UPDATE', what: 'install newer releases by itself (on, the default; off: only notify). Only releases your publishing device signed, sha256-verified; your .env and data are kept; contract changes still need chronos deploy', test: fmtOnly(/^(on|off)$/, 'on or off') },
  { group: 'Company', key: 'CHRONOS_TZ', what: 'your time zone for the daily report (IANA name; default America/Los_Angeles)', test: fmtOnly(/^[A-Za-z_]+\/[A-Za-z_]+(\/[A-Za-z_]+)?$/, 'an IANA zone such as America/Los_Angeles') },
  { group: 'Alerts', key: 'CHRONOS_ALERT_WEBHOOK_URL', secret: true, what: 'where incidents, resolution attempts and escalations go as signed JSON. Empty: your portal (your project\'s alerts function, device-signed). Your own https url, or off', test: fmtOnly(/^(https:\/\/\S+|off)$/, 'must start with https:// (or be off)') },
  { group: 'Alerts', key: 'CHRONOS_ALERT_WEBHOOK_SECRET', secret: true, what: 'shared secret for the webhook signature (x-chronos-signature: HMAC-SHA256 over timestamp.body)', test: fmtOnly(/^\S{16,}$/, 'at least 16 characters') },
  { group: 'AI', key: 'CHRONOS_AGENT_MODEL', secret: false, what: 'OpenRouter model id for the AI agent (provider/model). Empty: the newest Claude Sonnet OpenRouter lists', test: fmtOnly(/^[\w.\-]+\/[\w.\-:]+$/, 'must look like provider/model') },
  { group: 'Data services', key: 'SUPABASE_URL', secret: false, what: 'Supabase project url', test: fmtOnly(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/, 'expected https://<project>.supabase.co') },
  { group: 'Data services', key: 'SUPABASE_SERVICE_KEY', secret: true, what: 'Supabase service-role key (full database access: keep private)', test: fmtOnly(/^[A-Za-z0-9._-]{30,}$/, 'looks too short or has invalid characters') },
  { group: 'Data services', key: 'DATA_GOV_API_KEY', secret: true, what: 'api.data.gov key (GovInfo, federal data)', test: fmtOnly(/^[A-Za-z0-9]{20,64}$/, 'expected 20-64 letters/digits') },
  { group: 'Data services', key: 'RAPIDAPI_KEY', secret: true, what: 'RapidAPI key', test: fmtOnly(/^[A-Za-z0-9]{20,80}$/, 'expected 20-80 letters/digits') },
  { group: 'Data services', key: 'CARSXE_API_KEY', secret: true, what: 'CarsXE vehicle data key', test: fmtOnly(/^\S{10,}$/, 'too short') },
  { group: 'Data services', key: 'VERYFI_CLIENT_ID', secret: true, what: 'Veryfi client id', test: fmtOnly(/^\S{10,}$/, 'too short') },
  { group: 'Data services', key: 'VERYFI_USERNAME', secret: false, what: 'Veryfi username', test: fmtOnly(/^\S{2,}$/, 'too short') },
  { group: 'Data services', key: 'VERYFI_API_KEY', secret: true, what: 'Veryfi API key', test: fmtOnly(/^\S{10,}$/, 'too short') },
  { group: 'Data services', key: 'IDSCAN_API_KEY', secret: true, what: 'IDScan key', test: fmtOnly(/^\S{10,}$/, 'too short') },
  { group: 'Data services', key: 'IDSCAN_BEARER_TOKEN', secret: true, what: 'IDScan bearer token', test: fmtOnly(/^\S{10,}$/, 'too short') },
  { group: 'Data services', key: 'HERITAGEDEED_API_KEY', secret: true, what: 'HeritageDeed key', test: fmtOnly(/^\S{10,}$/, 'too short') },
  { group: 'Google', key: 'GOOGLE_DRIVE_FOLDER_ID', secret: false, what: 'Drive folder id used by sync scripts', test: fmtOnly(/^[A-Za-z0-9_-]{10,}$/, 'expected a Drive folder id') },
  { group: 'Google', key: 'GOOGLE_APPLICATION_CREDENTIALS', secret: false, what: 'path to your service-account JSON file (the path, not the contents)', test: credsFile },
  { group: 'Cloud', key: 'CHRONOS_SYNC_URL', secret: false, what: 'Supabase ingest URL (portal data)', test: fmtOnly(/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/ingest$/i, 'must be https://<ref>.supabase.co/functions/v1/ingest') },
  { group: 'Alerts', key: 'CHRONOS_WEBHOOK_URL', secret: true, what: 'where phone-style alerts also go. Empty: your portal (money made or lost, errors). Your own https url (Discord/Slack style), or off', test: fmtOnly(/^(https:\/\/\S+|off)$/, 'must start with https:// (or be off)') },
  { group: 'Alerts', key: 'ARB_WEBHOOK_URL', secret: true, what: 'webhook for Arbitrum events', test: fmtOnly(/^https:\/\/\S+$/, 'must start with https://') },
  { group: 'Connection', key: 'ARB_RPC_URL_2', secret: true, what: 'a second Arbitrum node from ANOTHER provider: verifies balances at the same block and broadcasts your trades twice', test: testRpc },
  { group: 'Connection', key: 'ARB_RPC_URL_4', secret: true, what: 'another Arbitrum node (any provider): scans in turn with the others, inside its plan', test: testRpc },
  { group: 'Connection', key: 'ARB_RPC_URL_5', secret: true, what: 'another Arbitrum node (any provider): scans in turn with the others, inside its plan', test: testRpc },
  { group: 'Connection', key: 'INFURA_API_KEY', secret: true, what: 'Infura API key alone (its Arbitrum url and websocket are built from it)', test: async (k) => (/^[A-Za-z0-9]{16,64}$/.test(k) ? testRpc(`https://arbitrum-mainnet.infura.io/v3/${k}`) : { ok: false, msg: 'does not look like an Infura key' }) },
  { group: 'Connection', key: 'SWIFTNODES_API_KEY', secret: true, what: 'SwiftNodes API key alone (its Arbitrum url and websocket are built from it)', test: async (k) => (/^[A-Za-z0-9_-]{8,128}$/.test(k) ? testRpc(`https://rpc.swiftnodes.io/rpc/arbitrum?key=${encodeURIComponent(k)}`) : { ok: false, msg: 'does not look like a SwiftNodes key' }) },
  { group: 'Connection', key: 'INFURA_PLAN', secret: false, what: 'your Infura plan: free, developer, team or custom (Chronos keeps inside its credits)', test: fmtOnly(/^(free|developer|team|custom)$/, 'one of free, developer, team, custom') },
  { group: 'Connection', key: 'SWIFTNODES_PLAN', secret: false, what: 'your SwiftNodes plan: free, starter, growth, scale, pro or custom', test: fmtOnly(/^(free|starter|growth|scale|pro|custom)$/, 'one of free, starter, growth, scale, pro, custom') },
  { group: 'Connection', key: 'DRPC_ARB_URL', secret: true, what: 'your dRPC Arbitrum endpoint, copied from your dRPC dashboard (paced inside DRPC_PLAN)', test: async (u) => (/^https:\/\/[a-z0-9.-]*drpc\.(org|live)\//.test(u) ? testRpc(u) : { ok: false, msg: 'expected an https dRPC url' }) },
  { group: 'Connection', key: 'DRPC_PLAN', secret: false, what: 'your dRPC plan: free (25 req/s, batches of 3), payg (100), pro (300) or scale (600)', test: fmtOnly(/^(free|payg|pro|scale)$/, 'one of free, payg, pro, scale') },
  { group: 'Connection', key: 'ANKR_ARB_URL', secret: true, what: 'your Ankr Arbitrum endpoint (https://rpc.ankr.com/arbitrum/… from your Ankr dashboard)', test: async (u) => (/^https:\/\/rpc\.ankr\.com\/arbitrum/.test(u) ? testRpc(u) : { ok: false, msg: 'expected https://rpc.ankr.com/arbitrum…' }) },
  { group: 'Connection', key: 'ANKR_PLAN', secret: false, what: 'your Ankr plan: public, freemium (1M calls a month) or premium (websocket, 1.5k req/s)', test: fmtOnly(/^(public|freemium|premium)$/, 'one of public, freemium, premium') },
  { group: 'Connection', key: 'CHAINSTACK_ARB_URL', secret: true, what: 'your Chainstack Arbitrum node url (https://….core.chainstack.com/…)', test: async (u) => (/^https:\/\/[a-z0-9-]+\.core\.chainstack\.com\//.test(u) ? testRpc(u) : { ok: false, msg: 'expected https://<node>.core.chainstack.com/<key>' }) },
  { group: 'Data services', key: 'ONEINCH_API_KEY', secret: true, what: 'your 1inch Business API key (business.1inch.com/portal; one key covers every 1inch API): routing, prices and liquidity sources on Arbitrum. Tested with a read-only call on Arbitrum One', test: async (k) => (/^[A-Za-z0-9_-]{16,128}$/.test(k) ? testHttpKey('https://api.1inch.com/gas-price/v1.6/42161', { Authorization: `Bearer ${k}`, accept: 'application/json' }) : { ok: false, msg: 'expected the key only (letters, digits, - and _)' }) },
  { group: 'Data services', key: 'ETHERSCAN_API_KEY', secret: true, what: 'your Etherscan API key (etherscan.io/myapikey; API V2 covers Arbitrum One with chainid=42161): competitor trades, contract and pool lookups, receipts. Tested with a read-only call on Arbitrum One', test: async (k) => (/^[A-Z0-9]{34}$/i.test(k) ? testHttpKey(`https://api.etherscan.io/v2/api?chainid=42161&module=proxy&action=eth_blockNumber&apikey=${encodeURIComponent(k)}`, {}, (b) => /"result":"0x[0-9a-f]+"/i.test(b)) : { ok: false, msg: 'expected the 34-character key from etherscan.io/myapikey' }) },
  { group: 'Connection', key: 'GETBLOCK_API_KEY', secret: true, what: 'your GetBlock API key: the access token of an Arbitrum One endpoint in your GetBlock dashboard (create the endpoint for Arbitrum mainnet; the key is the long string after the host). Tested against Arbitrum One at GETBLOCK_REGION', test: async (k) => (/^[A-Za-z0-9_-]{8,128}$/.test(k) ? testRpc(require('./providers.cjs').KEY_URLS.GETBLOCK_API_KEY(k, (x) => process.env[x])) : { ok: false, msg: 'expected the access token only (letters, digits, - and _), not a url' }) },
  { group: 'Connection', key: 'GETBLOCK_REGION', secret: false, what: 'where your GetBlock endpoint was created: us-east-1 (New York, default), eu-central-1 (Frankfurt) or ap-southeast-1 (Singapore)', test: fmtOnly(/^(us-east-1|eu-central-1|ap-southeast-1)$/, 'one of us-east-1, eu-central-1, ap-southeast-1') },
  { group: 'Connection', key: 'GETBLOCK_ARB_URL', secret: true, what: 'your GetBlock Arbitrum One endpoint (https://shared.<region>.getblock.io/<access token>/, from your GetBlock dashboard; paced inside GETBLOCK_PLAN)', test: async (u) => (/^https:\/\/[a-z0-9.-]*getblock\.io\/[A-Za-z0-9_-]{8,}\/?/.test(u) ? testRpc(u) : { ok: false, msg: 'expected an https getblock.io url with your access token' }) },
  { group: 'Connection', key: 'GETBLOCK_PLAN', secret: false, what: 'your GetBlock plan: free (50,000 CU a day, 20 req/s: about 2,500 Arbitrum calls a day), starter (90M CU a month, 250 req/s), growth, advanced, scale, pro, premium or dedicated', test: fmtOnly(/^(free|starter|growth|advanced|scale|pro|premium|dedicated)$/, 'one of free, starter, growth, advanced, scale, pro, premium, dedicated') },
  { group: 'Connection', key: 'CHAINSTACK_PLAN', secret: false, what: 'your Chainstack plan: developer (25 req/s, logs 100 blocks), growth (250) or business (600)', test: fmtOnly(/^(developer|growth|business)$/, 'one of developer, growth, business') },
  { group: 'Connection', key: 'CHRONOS_PUBLIC_NODES', secret: false, what: 'on: also use keyless public nodes (dRPC https://arbitrum.drpc.org) as paced failover', test: fmtOnly(/^(on|off)$/, 'on or off') },
  { group: 'Connection', key: 'CHRONOS_PRIMARY_NODE', secret: false, what: 'node key that scans (unset: chosen by plan)', test: fmtOnly(/^(ARB_RPC_URL|ARBITRUM_RPC_URL|RPC_URL|ALCHEMY_RPC_URL|ARB_RPC_URL_[2-5]|ALCHEMY_API_KEY|INFURA_API_KEY|SWIFTNODES_API_KEY)$/, 'a node key: ARB_RPC_URL, ARB_RPC_URL_2…_5, ARBITRUM_RPC_URL, RPC_URL, ALCHEMY_RPC_URL, or an API key name') },
  { group: 'Connection', key: 'ARB_RPC_URL_3', secret: true, what: 'a third Arbitrum node from yet another provider (e.g. SwiftNodes): another failover and balance check', test: testRpc },
  { group: 'Execution', key: 'CHRONOS_FLASH_ARB_ADDRESS', secret: false, what: 'your deployed ChronosFlashArb contract', test: address },
  { group: 'Execution', key: 'CONTRACT_ADDRESS', secret: false, what: 'an older contract name other tools also use: Chronos uses it only after checking on-chain that it is a Chronos contract, then saves it as CHRONOS_FLASH_ARB_ADDRESS', test: address },
  { group: 'Execution', key: 'CHRONOS_EXECUTOR_KMS_KEY', secret: false, what: 'Cloud KMS HSM key version that signs trades (printed by cloud/gcp-setup.sh); the key itself never leaves Google', test: fmtOnly(/^projects\/[a-z0-9-]+\/locations\/[a-z0-9-]+\/keyRings\/[A-Za-z0-9_-]+\/cryptoKeys\/[A-Za-z0-9_-]+\/cryptoKeyVersions\/\d+$/, 'expected projects/…/cryptoKeyVersions/N') },
  { group: 'Execution', key: 'CHRONOS_EXECUTOR_ADDRESS', secret: false, what: 'your executor (an operator on your contract): signs trades through the Cloud KMS key, or on this phone through the key agent (chronos executor import); without either, the shadow test runs from it', test: address },
  { group: 'Cloud', key: 'CHRONOS_DRIVE_ENV_FOLDER', secret: false, what: 'the Google Drive folder that holds your env files: the key pull on update reads only that folder (fast) instead of listing your whole Drive', test: fmtOnly(/^[^\n]{1,200}$/, 'a folder name or path in your Drive') },
  { group: 'Voice', key: 'CHRONOS_VOICE_ENGINE', secret: false, what: 'the Android voice engine chronos narrate speaks with (chronos narrate --voices lists them; empty = your phone default)', test: fmtOnly(/^[\w.@-]{1,80}$/, 'an engine name from chronos narrate --voices') },
  { group: 'Voice', key: 'CHRONOS_VOICE_LANG', secret: false, what: 'voice language for chronos narrate, e.g. en', test: fmtOnly(/^[a-z]{2,3}$/, 'a language code like en') },
  { group: 'Voice', key: 'CHRONOS_VOICE_REGION', secret: false, what: 'voice region for chronos narrate, e.g. US or GB', test: fmtOnly(/^[A-Za-z]{2,3}$/, 'a region code like US') },
  { group: 'Voice', key: 'CHRONOS_VOICE_VARIANT', secret: false, what: 'a specific voice of your Android engine (the variant name your engine lists)', test: fmtOnly(/^[\w.@-]{1,80}$/, 'a voice variant name') },
  { group: 'Voice', key: 'CHRONOS_VOICE', secret: false, what: 'Mac only: the voice name for chronos narrate (say -v ? lists them)', test: fmtOnly(/^[\w .()-]{1,60}$/, 'a voice name') },
  { group: 'Voice', key: 'CHRONOS_VOICE_RATE', secret: false, what: 'speaking speed for chronos narrate (1.0 normal, 1.2 a bit faster)', test: fmtOnly(/^(0?\.\d+|[1-4](\.\d+)?)$/, 'a number from 0.25 to 4') },
  { group: 'Voice', key: 'CHRONOS_VOICE_PITCH', secret: false, what: 'voice pitch for chronos narrate (1.0 normal)', test: fmtOnly(/^(0?\.\d+|[1-4](\.\d+)?)$/, 'a number from 0.25 to 4') },
  { group: 'Voice', key: 'CHRONOS_NARRATE_SCAN_SEC', secret: false, what: 'seconds between routine scan reports in the commentary (anything notable is said at once)', test: fmtOnly(/^\d{2,4}$/, 'seconds, e.g. 60') },
  { group: 'Alerts', key: 'CHRONOS_PORTAL_URL', secret: false, what: 'your portal page (https://…): the buttons in the daily report email open it', test: fmtOnly(/^https:\/\/\S+$/, 'must start with https://') },
  { group: 'Connection', key: 'CHRONOS_SCAN_MODE', secret: false, what: 'burst (default): every scan read spread over all your nodes at once, a rate limit fails over at once; paced: one node per scan inside each plan\'s pace', test: fmtOnly(/^(burst|paced)$/, 'burst or paced') },
  { group: 'Connection', key: 'CHRONOS_BURST_NODES', secret: false, what: 'free (default): burst only nodes whose plan refuses past its limit (no bill); all: every node, even ones that may bill per request', test: fmtOnly(/^(free|all)$/, 'free or all') },
  { group: 'Connection', key: 'CHRONOS_RPC_TIMEOUT_MS', secret: false, what: 'burst mode: a node slower than this (ms) is skipped for the request and cools down (default 2500)', test: fmtOnly(/^\d{3,5}$/, 'milliseconds, e.g. 2500') },
  { group: 'Connection', key: 'CHRONOS_BURST_GAP_MS', secret: false, what: 'burst mode: pause between scans in ms (default 0: the next scan starts when one ends)', test: fmtOnly(/^\d{1,6}$/, 'milliseconds, e.g. 0') },
  { group: 'Connection', key: 'CHRONOS_SEQUENCER_BROADCAST', secret: false, what: 'on (default): trades are also sent through Arbitrum\'s public endpoint, so they get out when your nodes are rate-limited; off to stop', test: fmtOnly(/^(on|off)$/, 'on or off') },
  { group: 'Execution', key: 'CHRONOS_AGENT_MAX_TX_ETH', secret: false, what: 'the most worst-case gas (gas limit × max fee) the phone key agent signs for one trade (default 0.05 ETH; read at chronos executor unlock)', test: fmtOnly(/^(0?\.\d+|\d+(\.\d+)?)$/, 'expected an ETH amount like 0.05') },
  { group: 'Wallet addresses (public)', key: 'PAYOUT_WALLET_ADDRESS', secret: false, what: 'where profit is paid', test: address },
  { group: 'Wallet addresses (public)', key: 'TAX_RESERVE_VAULT', secret: false, what: 'Policy T1 tax reserve address', test: address },
  { group: 'Wallet addresses (public)', key: 'GAS_WALLET_ADDRESS', secret: false, what: 'wallet that pays gas', test: address },
  { group: 'Wallet addresses (public)', key: 'OPERATING_TREASURY', secret: false, what: 'operating treasury address', test: address },
];
// Signing keys are shown only as present/absent. This console never needs them and the setup never asks for them.
const SIGNING_KEYS = ['PRIVATE_KEY', 'ARB_PRIVATE_KEY', 'WALLET_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'GAS_PRIVATE_KEY'];

const SETTINGS = [
  { group: 'Scanner', key: 'MIN_NET_PROFIT_USD', min: 0.01, max: 10000, suggest: '0.05', what: 'absolute minimum net profit per trade, USD (the floor is this or FLOOR_GAS_MULT × the route\'s gas, whichever is larger)' },
  { group: 'Scanner', key: 'FLOOR_GAS_MULT', min: 0, max: 20, suggest: '2', what: 'a trade must keep at least this many times its own gas cost (default 2; 0 = fixed floor only)' },
  { group: 'Scanner', key: 'MAX_SLIPPAGE_BPS', min: 1, max: 500, suggest: '35', what: 'max price impact per leg, basis points' },
  { group: 'Scanner', key: 'GAS_CEILING_GWEI', min: 0.001, max: 10, suggest: '0.05', what: 'gas gate: no trade above this gas price' },
  { group: 'Scanner', key: 'GAS_UNITS_ASSUMED', min: 100000, max: 5000000, suggest: '900000', what: 'gas units for flash loan + 2 swaps (calibrate it)' },
  { group: 'Scanner', key: 'SIZE_LADDER_USD', list: true, min: 1, max: 1000000, suggest: '200,500,1000,2500,5000,10000,25000', what: 'borrow sizes to try; smallest and largest are your limits' },
  { group: 'Scanner', key: 'SCREEN_SIZE_USD', min: 1, max: 1000000, suggest: '1000', what: 'size used to screen every route' },
  { group: 'Scanner', key: 'SCAN_TOPK', min: 1, max: 100, int: true, suggest: '12', what: 'routes that get the full size search' },
  { group: 'Scanner', key: 'OPT_REFINE_ITERS', min: 0, max: 64, int: true, suggest: '16', what: 'refinement steps after the ladder' },
  { group: 'Scanner', key: 'MIN_PROFIT_CAPTURE_BPS', min: 0, max: 10000, int: true, suggest: '5000', what: 'on-chain minProfit as share of quoted profit' },
  { group: 'Scanner', key: 'SLIPPAGE_PROBE_USD', min: 0.01, max: 10000, suggest: '10', what: 'small probe used to measure price impact' },
  { group: 'Scanner', key: 'DEADLINE_SECONDS', min: 10, max: 3600, int: true, suggest: '120', what: 'deadline in prepared contract calls' },
  { group: 'Scanner', key: 'SCAN_MAX_LEGS', min: 2, max: 5, int: true, suggest: '4', what: 'longest route tried (2 to 5; never more than your deployed contract accepts: v2.1+ takes 5, older 4; 5 costs many more quotes per scan)' },
  { group: 'Scanner', key: 'CHRONOS_DISCOVER_TOKENS', min: 0, max: 200, int: true, suggest: '40', what: 'tokens beyond Aave\'s reserves to look for pools between (nominated by the public token list, checked on-chain; 0 = off)' },
  { group: 'Scanner', key: 'HOT_SCAN_MS', min: 0, max: 60000, int: true, suggest: '3000', what: 'fast re-check of the closest routes between full scans, in ms (0 = off)' },
  { group: 'Scanner', key: 'DEPTH_MIN_FILL', min: 0.05, max: 0.99, suggest: '0.5', what: 'depth check: a pool whose small probe trade gets less than this share of its own quoted price is benched (it has a price but almost nothing behind it)' },
  { group: 'Scanner', key: 'DEPTH_MIN_USD', min: 0, max: 10000000, suggest: '1000', what: 'depth floor: a V2 pair holding less than this many USD on a priced side is left out of routing (unset: the larger of $1,000 and 5× your smallest trade size)' },
  { group: 'Scanner', key: 'DEAD_LOSS_PCT', min: 1, max: 50, suggest: '5', what: 'a route losing more than this % of its size at screening is a dead pool (benched, never shortlisted), not a missing price gap' },
  { group: 'Scanner', key: 'DEPTH_BENCH_HOURS', min: 0.25, max: 72, suggest: '6', what: 'hours a pool that failed the depth check stays out of routing before it is tried again' },
  { group: 'Scanner', key: 'RESEARCH_EVERY_MIN', min: 10, max: 1440, suggest: '60', what: 'minutes between competitor research runs on your primary device (flash loans and own-capital arbitrage from the chain, pooled in chain_trades)' },
  { group: 'Scanner', key: 'RESEARCH_SWAP_BLOCKS', min: 0, max: 20000, suggest: '600', what: 'how many of the newest blocks research reads every swap from to find own-capital arbitrage (600 ≈ 2.5 min; 0 = flash loans only). Larger reads more logs from your node' },
  { group: 'Scanner', key: 'SCAN_QUOTE_CYCLES', min: 10, max: 5000, int: true, suggest: '400', what: 'cycles that pass the price screen and get real quotes each scan' },
  { group: 'Measurement', key: 'MEASURE_MINUTES', min: 1, max: 10080, int: true, suggest: '60', what: 'length of a measurement run' },
  { group: 'Measurement', key: 'MEASURE_INTERVAL_SEC', min: 5, max: 3600, int: true, suggest: '20', what: 'seconds between scans' },
  { group: 'Measurement', key: 'GO_MIN_EPISODES', min: 1, max: 100000, int: true, suggest: '5', what: 'GO needs at least this many opportunity episodes' },
  { group: 'Measurement', key: 'GO_MIN_DISTINCT_BLOCKS', min: 1, max: 100000, int: true, suggest: '5', what: 'GO needs opportunities in this many blocks' },
  { group: 'Measurement', key: 'GO_MIN_USD_PER_DAY', min: 0, max: 1e9, suggest: '5', what: 'GO needs this projected $/day (upper bound)' },
  { group: 'Policies', key: 'POLICY_T1_TAX_BPS', min: 0, max: 10000, int: true, suggest: '3000', what: 'T1: share of verified gross profit reserved for tax (3000 = 30%)' },
  { group: 'Policies', key: 'MAX_DAILY_DRAWDOWN_USD', min: 0, max: 1e9, suggest: '25', what: 'a realized loss this large in a UTC day switches live trading back to shadow' },
];
function checkSetting(s, raw) {
  const v = String(raw).trim();
  const one = (x) => { const n = Number(x); if (x === '' || !Number.isFinite(n)) return 'not a number'; if (s.int && !Number.isInteger(n)) return 'must be a whole number'; if (n < s.min || n > s.max) return `must be between ${s.min} and ${s.max}`; return null; };
  if (s.list) { const parts = v.split(',').map((x) => x.trim()); for (const p of parts) { const e = one(p); if (e) return `"${p}": ${e}`; } return parts.length ? null : 'empty'; }
  return one(v);
}
module.exports = { SECRETS, SIGNING_KEYS, SETTINGS, checkSetting, testRpc };
