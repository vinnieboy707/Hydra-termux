'use strict';
// Every environment variable the code reads that is NOT one of your settings (those are in lib/catalog.cjs, the
// execution policy in lib/execpolicy.cjs and the deploy policy in lib/deploy.cjs). These are advanced tuning knobs,
// platform values Termux or the installer set, and test hooks. test/envkeys.test.cjs fails if code reads a variable
// that is in none of these lists, or if a variable listed here is no longer read. Documented in CONFIGURATION.md.
const ENV_KEYS = [
  // advanced tuning (leave unset unless you have a reason)
  { key: 'SCAN_CONCURRENCY', kind: 'advanced', def: '6', what: 'parallel chain reads during market discovery' },
  { key: 'SCAN_PARALLEL', kind: 'advanced', def: '64', what: 'parallel quote calls during a scan (the resolver halves it under load)' },
  { key: 'QUOTE_BATCH', kind: 'advanced', def: '100', what: 'calls per Multicall3 batch to start with (it grows per node while the node accepts full batches)' },
  { key: 'SCAN_MAX_POOL_DEVIATION_BPS', kind: 'advanced', def: '2000', what: 'a pool priced more than this far from the Aave oracle (or its pair\'s other pools) is broken (drained or abandoned) and left out of routing' },
  { key: 'QUOTE_BATCH_MAX', kind: 'advanced', def: '500', what: 'most quote calls packed into one Multicall3 eth_call (fewer billed calls; a node that refuses gets smaller batches)' },
  { key: 'MARKET_CACHE_MIN', kind: 'advanced', def: '360', what: 'minutes a discovered market list is reused before rediscovery' },
  { key: 'SCAN_EXTRA_TOKENS', kind: 'advanced', def: '', what: 'extra token addresses to scan (comma separated), beyond Aave reserves and discovered tokens' },
  { key: 'CHRONOS_BALANCER_VAULT', kind: 'advanced', def: 'the Balancer V2 vault', what: '"off" ignores Balancer flash loans; an address overrides the vault' },
  { key: 'CHRONOS_PROBE_DUMP_WETH', kind: 'advanced', def: '300', what: 'WETH the contract v2 probe sells inside its eth_call to make its own price gap' },
  { key: 'CHRONOS_PROBE_GAS', kind: 'advanced', def: '300000000', what: 'gas limit of the contract v2 probe eth_call (lower it if your RPC caps eth_call gas)' },
  { key: 'CHRONOS_PORTAL_SUPABASE_URL', kind: 'advanced', def: 'your Supabase project', what: 'portal database the portal-backend real check asks' },
  { key: 'CHRONOS_PORTAL_PUBLISHABLE_KEY', kind: 'advanced', def: 'the portal\'s publishable key', what: 'public key the portal-backend real check uses (row-level security, not secrecy, protects data)' },
  { key: 'CHRONOS_BLOCKSCOUT_URL', kind: 'advanced', def: 'https://arbitrum.blockscout.com', what: 'second, independent source that confirms wallet balances before they are shown ("off": only a second RPC confirms)' },
  { key: 'CHRONOS_SET_LABEL', kind: 'advanced', def: '', what: 'internal: the prompt chronos keys shows for chronos set' },
  { key: 'CHRONOS_NO_RESTART', kind: 'advanced', def: '', what: 'any value: chronos set saves without restarting the engine (chronos keys sets it, then restarts once)' },
  { key: 'CHRONOS_IMPORT_FROM', kind: 'advanced', def: '', what: 'extra folders or files (comma-separated) chronos keys and chronos setup search for your keys, e.g. a workspace you copied from another machine' },
  { key: 'CHRONOS_NO_AUTO_IMPORT', kind: 'advanced', def: '', what: 'any value: chronos setup does not look for keys in other files' },
  // where things are
  { key: 'ENV_FILE', kind: 'location', def: 'found automatically', what: 'path of your .env (the service sets it for the engine)' },
  { key: 'CHRONOS_WORKSPACE', kind: 'location', def: 'the folder holding your .env', what: 'workspace folder' },
  { key: 'CHRONOS_DATA_DIR', kind: 'location', def: '<console>/data', what: 'runtime data folder (history, state, logs)' },
  { key: 'CHRONOS_VENUES_FILE', kind: 'location', def: '<console>/venues.json', what: 'venue list file' },
  { key: 'CHRONOS_DEVICE_KEY', kind: 'location', def: '~/.chronos/device.key', what: 'this device\'s Ed25519 key file' },
  { key: 'CHRONOS_RELEASE_BASE', kind: 'location', def: 'your Supabase release function', what: 'release service address' },
  { key: 'CHRONOS_WS', kind: 'location', def: '~/workspaces/chronos-master-workspace', what: 'workspace folder the installer (go.sh) installs into' },
  { key: 'CHRONOS_DEVICE_NAME', kind: 'location', def: 'the phone\'s host name', what: 'name this device enrolls under (installer)' },
  { key: 'CHRONOS_TGZ', kind: 'location', def: 'newest ~/chronos-console*.tgz', what: 'archive the cloud setup installs (Cloud Shell)' },
  { key: 'CHRONOS_SETTINGS', kind: 'location', def: '~/chronos-settings.env', what: 'settings pack the cloud setup reads (Cloud Shell)' },
  // set by the platform or by Chronos itself
  { key: 'TERMUX_VERSION', kind: 'platform', def: 'set by Termux', what: 'marks a phone (automatic updates, phone checks)' },
  { key: 'PREFIX', kind: 'platform', def: 'set by Termux', what: 'Termux install prefix (where the chronos command goes)' },
  { key: 'HOME', kind: 'platform', def: 'set by the system', what: 'home folder' },
  { key: 'PATH', kind: 'platform', def: 'set by the system', what: 'command search path' },
  { key: 'TMPDIR', kind: 'platform', def: 'set by the system', what: 'temporary folder (installer)' },
  // test hooks (the local test chain; never set on a real device)
  { key: 'CHRONOS_AAVE_POOL', kind: 'test', def: 'Aave V3 Pool on Arbitrum One', what: 'Aave pool address override (local test chain)' },
  { key: 'CHRONOS_ROLE_FILE', kind: 'test', def: '~/.chronos/role', what: 'where this device keeps its role (primary / standby); tests point it at a temporary file' },
  { key: 'CHRONOS_WETH', kind: 'test', def: 'WETH on Arbitrum One', what: 'WETH address override (local test chain)' },
  { key: 'CHRONOS_MULTICALL', kind: 'test', def: 'Multicall3', what: 'Multicall3 address override (local test chain)' },
  { key: 'CHRONOS_KMS_ENDPOINT', kind: 'test', def: 'Cloud KMS', what: 'KMS API address override (KMS stand-in)' },
  { key: 'CHRONOS_METADATA_TOKEN_URL', kind: 'test', def: 'the VM metadata server', what: 'token address override (KMS stand-in)' },
];
module.exports = { ENV_KEYS };
