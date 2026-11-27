'use strict';
// What each key unlocks. "built here" = the console uses it now. Otherwise the key makes your own services
// (listed in "where") able to run; the console does not run those services itself.
const RPC = ['ARB_RPC_URL', 'ARBITRUM_RPC_URL', 'RPC_URL', 'ALCHEMY_RPC_URL'];
const CAPS = [
  { name: 'Live opportunity scanner and dashboard', any: RPC, settings: true, built: true, unlocks: 'real quotes on every pool pair, route sizing, guardrails, the full dashboard', next: 'run: chronos' },
  { name: '24/7 background engine with alerts', any: RPC, settings: true, built: true, unlocks: 'scans around the clock under PM2, restarts on crash, starts at boot (Termux:Boot), alerts your phone/webhook and keeps the money status pinned in your notification shade', next: 'run: chronos service install' },
  { name: 'Registry audit and gas calibration', any: RPC, built: true, unlocks: 'checks src/registry.ts pools on-chain; measures gas from your 3 real swaps', next: 'checklist → "Run it now"' },
  { name: 'Measurement and GO / NO-GO', any: RPC, all: ['GO_MIN_EPISODES', 'GO_MIN_DISTINCT_BLOCKS', 'GO_MIN_USD_PER_DAY', 'MEASURE_MINUTES'], built: true, unlocks: 'timed runs that decide whether a shadow test is worth building', next: 'run: chronos measure' },
  { name: 'Node failover visibility', min2: RPC, built: true, unlocks: 'two or more nodes probed side by side on the System tab', next: 'System tab → Nodes' },
  { name: 'Alchemy key check', all: ['ALCHEMY_API_KEY'], built: true, unlocks: 'the key itself is tested against Alchemy\'s Arbitrum endpoint', next: '' },
  { name: 'Live block feed (websocket)', all: ['ARBITRUM_WSS_URL'], built: true, unlocks: 'the engine re-checks the closest routes and every route through a pool that just moved on every new block, not on a timer (add ARB_WSS_URL / ALCHEMY_WSS_URL / ARBITRUM_WSS_URL_2 for redundant feeds)', next: 'chronos setup → paste ARBITRUM_WSS_URL (hidden; tested live against Arbitrum One)' },
  { name: 'AI error diagnosis (OpenRouter)', all: ['OPENROUTER_API_KEY'], built: true, unlocks: 'a plain-text explanation of each new engine error in agent activity (never runs anything)', next: 'set CHRONOS_AGENT_MODEL to an OpenRouter model id you choose' },
  { name: 'Supabase database', all: ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'], built: false, where: 'your apps that read SUPABASE_URL', unlocks: 'database access for those apps (service key = full access: keep private)', next: '' },
  { name: 'Federal / GovInfo data', all: ['DATA_GOV_API_KEY'], built: false, where: 'your GIS and public-records pipeline', unlocks: 'api.data.gov requests', next: '' },
  { name: 'Vehicle data (CarsXE)', all: ['CARSXE_API_KEY'], built: false, where: 'scripts/sync_vehicle_id_integrations.cjs', unlocks: 'vehicle lookups', next: '' },
  { name: 'Receipt and document OCR (Veryfi)', all: ['VERYFI_CLIENT_ID', 'VERYFI_USERNAME', 'VERYFI_API_KEY'], built: false, where: 'your Veryfi integration', unlocks: 'document extraction', next: '' },
  { name: 'ID verification (IDScan)', all: ['IDSCAN_API_KEY'], built: false, where: 'your IDScan integration', unlocks: 'ID document checks', next: '' },
  { name: 'Deed records (HeritageDeed)', all: ['HERITAGEDEED_API_KEY'], built: false, where: 'your real-estate data tools', unlocks: 'deed lookups', next: '' },
  { name: 'RapidAPI services', all: ['RAPIDAPI_KEY'], built: false, where: 'scripts that call RapidAPI', unlocks: 'RapidAPI endpoints', next: '' },
  { name: 'Google Drive sync', all: ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_DRIVE_FOLDER_ID'], built: false, where: 'scripts/google_sources_sync.cjs and upload scripts', unlocks: 'Drive sync (fix the .env upload first: checklist)', next: '' },
  { name: 'Alerts by webhook', all: [], built: true, unlocks: 'alerts go to your portal (your project\'s alerts function, device-signed) or to your own https webhook (CHRONOS_WEBHOOK_URL); off with CHRONOS_WEBHOOK_URL=off', next: '' },
  { name: 'Policy T1 reserve routing', all: ['TAX_RESERVE_VAULT', 'POLICY_T1_TAX_BPS'], built: true, unlocks: 'Policies tab shows T1 READY with your vault', next: '' },
  { name: 'Payout destination on record', all: ['PAYOUT_WALLET_ADDRESS'], built: true, unlocks: 'payout address shown and checksum-verified', next: '' },
];
function evaluate(get, settingsComplete) {
  return CAPS.map((c) => {
    const has = (k) => { const v = get(k); return v !== undefined && v !== ''; };
    let awake = true;
    if (c.any && !c.any.some(has)) awake = false;
    if (c.min2 && c.min2.filter(has).length < 2) awake = false;
    if (c.all && !c.all.every(has)) awake = false;
    if (c.settings && !settingsComplete) awake = false;
    const missing = [...(c.min2 && c.min2.filter(has).length < 2 ? ['a second RPC url'] : []), ...(c.all || []).filter((k) => !has(k)), ...(c.any && !c.any.some(has) ? [`one of ${c.any.join(' / ')}`] : []), ...(c.settings && !settingsComplete ? ['scanner settings'] : [])];
    return { ...c, awake, missing };
  });
}
module.exports = { CAPS, evaluate };
