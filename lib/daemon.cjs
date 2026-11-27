'use strict';
// chronos daemon: the 24/7 engine. Scans on a fixed interval, keeps the measurement session, verifies realized
// profit from receipts, publishes a signed state for the dashboard, and alerts you (phone / webhook) on every new
// problem, every new opportunity episode and every change of the GO verdict. It sends a trade only in LIVE mode (mode.cjs rules), signed by your HSM key.
const fs = require('fs');
const path = require('path');
const live = require('./live.cjs');
const { loadConfig, parseEnvFile } = require('./config.cjs');
const { runScan } = require('./scan.cjs');
const { Session } = require('./session.cjs');
const history = require('./history.cjs');
const HEALTH = require('./health.cjs');
const PROFIT = require('./profit.cjs');
const pol = require('./policies.cjs');
const sys = require('./system.cjs');
const integrity = require('./integrity.cjs');
const { readRecord } = require('./record.cjs');
const LS = require('./livestate.cjs');
const { createNotifier } = require('./notify.cjs');
const SYNC = require('./sync.cjs');
const { Agents } = require('./agents.cjs');
const { createDiagnoser } = require('./agentllm.cjs');
const RZ = require('./realized.cjs');
const { readThresholds } = require('./thresholds.cjs');
const { redact } = require('./safety.cjs');
const MONEY = require('./money.cjs');
const SH = require('./shadow.cjs');
const MODE = require('./mode.cjs');
const { readExecPolicy } = require('./execpolicy.cjs');
const { Executor } = require('./executor.cjs');
const { KmsSigner } = require('./kms.cjs');
const BAL = require('./balances.cjs');
const { routeKey } = require('./session.cjs');
const { AAVE_POOL } = require('./chain.cjs');
const { NodePool } = require('./nodepool.cjs');
const { ethers } = require('ethers');
const DAY = 86400000;

const DATA = live.DATA;
const EXIT_SETUP = 78;
const EXIT_RESTART = 75; // an agent asked for a restart: PM2 and systemd restart on any code but 78 // the service manager is told not to restart on this code: setup or integrity must be fixed first
// what the start alert says about sending, from the setting the engine actually obeys
const EPstart = (get) => (readExecPolicy(get).policy.CHRONOS_MODE === 'shadow' ? 'shadow only: sends nothing' : 'shadow test; sends only when the live rules are met');
const redactMsg = (e) => require('./safety.cjs').redact(String((e && e.message) || e));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildState(S, notifier, extra = {}) {
  return {
    v: 1, pid: process.pid, phase: S.phase, blocked: S.blocked || null, startedAt: S.session.startedAt, heartbeat: Date.now(), sync: S.syncStatus || null,
    interval: S.interval || null, scanning: S.scanning, paused: S.paused, lastScanAt: S.lastScanAt, error: S.error, consecutiveErrors: S.consecutiveErrors,
    lastQuotes: S.lastQuotes, res: S.res || null, trend: (S.history || []).slice(-240), // the dashboard's charts
    session: { startedAt: S.session.startedAt, episodes: S.session.episodes.slice(-50), summary: S.session.summary(S.thresholds || {}), edge: S.session.edge() },
    tempo: S.tempo || null, team: S.team || null, gas: S.gas || null, audit: S.audit ? { at: S.audit.at, line: S.audit.line, pass: S.audit.pass, fail: S.audit.fail, checks: S.audit.checks } : null, nodes: S.nodes, nodePool: S.pool ? S.pool.status() : null, burst: S.fan ? { nodes: S.fan.status(), meter: S.fan.meter } : null, scanNode: S.scanNode || null, venueReport: S.st ? S.st.venueReport : null,
    assets: S.st ? S.st.assets.map((a) => ({ address: a.address, symbol: a.symbol, flashEnabled: a.flashEnabled })) : null,
    aave: S.st ? { premiumBps: S.st.aave.premiumBps } : null, multicall: S.st ? !!S.st.multicall : null, markets: S.st ? S.st.markets.length : null,
    realized: S.realized, notify: notifier.channels, historyRejected: S.historyRejected,
    problems: S.problems || [], profit: S.profit || null, progress: S.progress || null,
    mode: S.mode || null, fastLane: S.hotRes ? { ...S.hotRes, watching: S.hot.size } : null, blockFeed: S.feedStatus || null, resolver: S.resolver || null, safe: S.safe || null, company: S.company || null, insights: S.insights || null, chainSignals: S.chainSignals || null, relay: S.relay || null, road: S.road || null, indicators: S.indicators || null, indicatorRows: S.indicatorRows || null, direction: S.direction || null, shadow: S.shadowStats || null, shadowRuns: (S.shadowRuns || []).slice(-20), exec: S.execInfo || null, balances: S.balances || null, execPolicyProblems: S.execPolicyProblems || [], update: S.update || null, version: require('../package.json').version, ...extra,
  };
}

// what the portal shows about the scanner: counts and best figures from the last scan, the fast lane, the block feed and
// your latest research run. No route keys, urls or secrets; every figure is the engine's own, from the chain.
function portalDetail(S, dataDir) {
  const r = S.res || null; const I = r && r.indicators;
  const out = { lastScan: r ? { block: r.blockNumber, ms: r.tookMs, markets: r.marketsFound, approved: r.approved } : null };
  // the VP's verified road to cash (your portal's Road to mainnet panel reads it)
  if (S.indicators) out.indicators = { momentum: S.indicators.momentum, forecastUsd: S.indicators.forecastUsd, measured: S.indicators.measured, proven: S.indicators.provenCount, firingSuccess: S.indicators.firingSuccess.length, firingFailure: S.indicators.firingFailure.length, retired: S.indicators.retired.map((r) => r.id) };
  if (Array.isArray(S.road)) out.road = S.road.map(({ step, id, version, title, owner, done, evidence, todo }) => ({ step, id, version, title, owner, done, evidence: evidence ? String(evidence).slice(0, 300) : null, todo: todo ? String(todo).slice(0, 300) : null }));
  if (I) out.indicators = {
    cycles: I.cycles, raw: I.raw || null, blockedBy: (I.blockedBy || []).slice(0, 5), best: I.best,
    flashFeeBps: I.breakEven.flashFeeBps, gasUsdByLegs: I.breakEven.gasUsdByLegs, gasGwei: I.breakEven.gasGwei,
    closest: I.bestEdges.slice(0, 3), spreads: I.spreads.slice(0, 3),
  };
  out.fastLane = S.hotRes ? { ...S.hotRes, watching: S.hot ? S.hot.size : 0 } : null;
  out.blockFeed = S.feedStatus ? { feeds: S.feedStatus.feeds, up: S.feedStatus.up, lastBlock: S.feedStatus.lastBlock, watchingPools: S.feedStatus.watchingPools || 0, swaps: S.feedStatus.swaps || 0 } : null;
  out.incidents = S.resolver ? { open: S.resolver.open.slice(0, 5), resolved: S.resolver.resolved.slice(-5) } : null;
  out.safeMode = S.safe ? { until: S.safe.until, crashes: S.safe.crashes } : null;
  out.company = S.company || null;
  try {
    const R = JSON.parse(require('fs').readFileSync(require('path').join(dataDir, 'research.json'), 'utf8'));
    out.research = { at: R.at, from: R.from, to: R.to, flashLoans: R.flashLoans, transactions: R.transactions, succeeded: R.succeeded, profitableAfterGas: R.profitableAfterGas, medianProfitUsd: R.medianProfitUsd, legs: R.legs, venues: (R.venues || []).slice(0, 6), venuesYouLack: (R.venuesYouLack || []).slice(0, 5), topContracts: (R.topContracts || []).slice(0, 5).map((c) => ({ contract: c.contract, txs: c.txs, success: c.success, medianLegs: c.medianLegs, medianGasUsd: c.medianGasUsd, sources: c.sources, keptUsd: c.keptUsd })) };
  } catch (_) { /* no research run yet */ }
  try {
    const RC = JSON.parse(require('fs').readFileSync(require('path').join(dataDir, 'live', 'realcheck.json'), 'utf8'));
    out.realcheck = { at: RC.at, results: (RC.results || []).map((r) => ({ id: r.id, title: r.title, status: r.status, detail: String(r.detail || '').slice(0, 200) })), v2: RC.v2 ? RC.v2.map((c) => ({ name: c.name, ok: c.ok })) : null };
  } catch (_) { /* no real check yet */ }
  if (S.contractInfo) out.contract = S.contractInfo;
  return out;
}

const RM = require('./remedy.cjs');
const PR = require('./providers.cjs');

const { nodeEntries } = PR;
/** the node that should scan: CHRONOS_PRIMARY_NODE, else the one with most room when it beats the default → { key, url, profile, why } | null */
function choosePrimary(get, cfg) {
  const forced = String(get('CHRONOS_PRIMARY_NODE') || '').trim();
  if (forced) { const url = get(forced); if (/^https:\/\//.test(url || '') && url !== cfg.rpcUrl) return { key: forced, url, profile: PR.profile(url, get), why: 'CHRONOS_PRIMARY_NODE' }; return null; }
  const ranked = PR.rankForScanning(nodeEntries(get), get); if (!ranked.length) return null;
  const cur = ranked.find((x) => x.url === cfg.rpcUrl); const best = ranked[0];
  if (!cur || best.url === cur.url || best.rank <= cur.rank) return null;
  return { ...best, why: `${cur.key} is ${cur.profile.name}${cur.profile.plan ? ' ' + cur.profile.plan : ''}, whose plan has less room; it stays as a backup (chronos nodes)` };
}
/** a longer scan interval when this scan's requests would run the scanning node past its plan → { interval, why } | null */
function governInterval(url, get, requests, current) {
  const min = PR.minScanInterval(url, get, requests);
  if (!min || current >= min) return null;
  const f = PR.profile(url, get);
  return { interval: min, why: `plan pacing: ${f.name} ${f.plan} allows one scan of ${requests} requests every ${min} s at most (${f.id === 'infura' ? `${(PR.P.infura.plans[f.plan].perDay / 1e6).toFixed(0)}M credits a day, 80 per eth_call` : `${f.limits.perSec} req/s${Number.isFinite(f.limits.perMonth) ? `, ${f.limits.perMonth.toLocaleString('en-US')} a month` : ''}`}); fast lane paused 1 h. Add an unmetered node or set ${PR.P[f.id].planKey} to your plan` };
}

async function runDaemon({ maxScans = Infinity, log = (m) => process.stdout.write(`${new Date().toISOString()} ${m}\n`) } = {}) {
  const S = { phase: 'boot', session: new Session(), history: [], nodes: null, error: null, consecutiveErrors: 0, lastQuotes: null, lastScanAt: 0, scanning: false, paused: false, historyRejected: 0, policyFails: [], realized: null, healthSeen: new Set() };
  let resolver = null;
  const ring = []; const baseLog = log; log = (m) => { ring.push(`${new Date().toISOString()} ${m}`); if (ring.length > 200) ring.shift(); baseLog(m); if (resolver) { try { resolver.trip(String(m)); } catch (_) { /* never in the way */ } } };
  let stop = false;
  const onStop = () => { stop = true; };
  process.on('SIGTERM', onStop); process.on('SIGINT', onStop);
  const envFile = live.findEnvFile(); S.envFile = envFile;
  // device role (lib/roles.cjs): a standby reads a few settings differently (no AI calls, no tempo); .env unchanged
  const ROLES = require('./roles.cjs'); S.role = ROLES.read(); S.acting = S.role === 'standby' ? 'standby' : 'primary'; S.roleWhy = null;
  const envGetRaw = (k) => (process.env[k] !== undefined ? process.env[k] : envFile ? parseEnvFile(envFile)[k] : undefined);
  const envGet = (k) => (S.acting === 'standby' && ROLES.STANDBY_ENV[k] !== undefined ? ROLES.STANDBY_ENV[k] : envGetRaw(k));
  const notifier = createNotifier({ webhook: require('./hookurl.cjs').effective(envGet, 'CHRONOS_WEBHOOK_URL'), dataDir: DATA });
  // portal access = this device's approval. Enrolling is idempotent: an approved phone stays approved; a new engine
  // (the cloud VM) appears in your portal → Devices with a pairing code for you to approve.
  try { fs.unlinkSync(path.join(DATA, 'live', 'ingest.key')); log('removed the old shared sync secret (no longer used)'); } catch (_) { /* none */ }
  const DV = require('./device.cjs');
  S.device = null;
  // in the background: the engine never waits on the network to start
  DV.enroll(require('os').hostname()).then(async (d) => {
    S.device = d;
    if (d.status !== 'approved') { log(`portal: this engine waits for approval · pairing code ${d.code}`); await notifier.send({ id: 'device', title: 'Approve this Chronos engine', text: `In your portal → Devices, approve pairing code ${d.code}`, minIntervalMs: 0 }); }
  }).catch((e) => log('portal: release service not reachable (' + redactMsg(e) + '); the engine runs anyway'));
  const sync = SYNC.createSync({ url: envGet('CHRONOS_SYNC_URL'), dataDir: DATA, log });
  // AI agent: on with OPENROUTER_API_KEY alone (the model is yours, or the newest Claude Sonnet OpenRouter lists)
  const LLM = require('./llm.cjs'); const anyOR = LLM.OR_KEYS.some((k) => envGet(k));
  const agentModel = anyOR ? await require('./agentmodel.cjs').resolve(envGet, DATA).catch(() => null) : null;
  // the VP's brain: every OpenRouter key and ANTHROPIC_API_KEY, in turn, each the fallback of the others (lib/llm.cjs)
  // the daily spending cap you approved (lib/spend.cjs) and the hang watchdog (lib/watchdog.cjs)
  const spend = new (require('./spend.cjs').Spend)({ dataDir: DATA, cap: envGet('CHRONOS_DAILY_SPEND_CAP_USD') ?? 5, tell: (title, text) => notifier.send({ id: 'spend-cap', title: 'Chronos: ' + title, text, level: 'warn', minIntervalMs: 0 }).catch(() => {}) });
  S.spend = spend.today();
  const WD = require('./watchdog.cjs');
  const stalled = WD.Watchdog.lastStall(DATA);
  if (stalled && !stalled.told) {
    log(`watchdog: the last run stalled (${stalled.what}, ${stalled.stalledForSec} s) and was restarted`);
    notifier.send({ id: 'watchdog', title: 'Chronos restarted after a stall', text: `${stalled.what} for ${stalled.stalledForSec} s at ${stalled.at}; the watchdog ended it and it is running again.`, level: 'warn', minIntervalMs: 0 }).catch(() => {});
    try { fs.writeFileSync(path.join(DATA, 'live', 'watchdog.json'), JSON.stringify({ ...stalled, told: true }, null, 2)); } catch (_) { /* told once is best effort */ }
  }
  const watchdog = envGet('CHRONOS_WATCHDOG_STALL_SEC') === 'off' ? null : new WD.Watchdog({ dataDir: DATA, stall: envGet('CHRONOS_WATCHDOG_STALL_SEC') ?? WD.DEFAULT_STALL_SEC }); // started just before the main loop (start-up discovery can be slow)
  const INIT_GRACE_SEC = 1800; // a rediscovery may take up to 30 min before the stall limit counts; a hung one is still caught
  const brain = new LLM.Brain({ get: envGet, orModel: agentModel && agentModel.model, spend, callUsd: Number(envGet('CHRONOS_AI_CALL_USD') ?? 0.02) || 0.02 }); S.brain = brain;
  if (brain.ready) log(`AI brain: ${brain.slots.length} key(s) in rotation (${brain.slots.map((x) => x.name).join(', ')})`);
  if (anyOR) log(agentModel ? `AI agent: ${agentModel.model}${agentModel.chosen ? ' (newest Claude Sonnet on OpenRouter)' : ''}` : 'AI agent: OpenRouter model list not reachable; off until the next start');
  const agents = new Agents({ dataDir: DATA, envFile, sync, log, notify: (x) => notifier.send(x).catch(() => {}),
    diagnose: brain.ready ? createDiagnoser({ chat: (q) => brain.chat(q), logTail: () => ring }) : null });
  // live commentary (lib/narrate.cjs): what the engine does, in words, for chronos narrate (written even when nobody listens)
  const commentary = new (require('./narrate.cjs').Commentary)(DATA, { scanEverySec: Number(envGet('CHRONOS_NARRATE_SCAN_SEC') || 60) });
  const publish = () => { try { LS.write(DATA, buildState(S, notifier)); } catch (e) { log('state write failed ' + redact(e.message)); } try { commentary.observe(S, { version: require('../package.json').version, floorUsd: S.cfg ? S.cfg.MIN_NET_PROFIT_USD : null }); } catch (_) { /* commentary never stops the engine */ } };
  const heartbeat = setInterval(publish, 5000);
  const finish = (code) => { RM.onCleanExit(DATA); clearInterval(heartbeat); if (watchdog) watchdog.stop(); process.removeListener('SIGTERM', onStop); process.removeListener('SIGINT', onStop); return code; };
  // pinned phone status: buttons write the same control files the dashboard keys use
  const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
  const ctl = (f) => path.join(DATA, 'live', f);
  const buttons = () => [{ label: 'Scan now', action: `touch ${q(ctl('scan-now'))}` }, S.paused ? { label: 'Resume', action: `rm -f ${q(ctl('paused'))}` } : { label: 'Pause', action: `touch ${q(ctl('paused'))}` }];
  const pinStatus = async (now = false) => { try { await notifier.status({ ...MONEY.phoneStatus(S), buttons: buttons(), ...(now ? { minIntervalMs: 0 } : {}) }); } catch (e) { log('status notification failed ' + redact(e.message)); } };
  const unpinStatus = (why) => notifier.status({ title: 'Chronos engine stopped', text: why, ongoing: false, minIntervalMs: 0 }).catch(() => {});

  S.integrity = integrity.verify();
  if (!S.integrity.ok) {
    S.phase = 'blocked'; S.blocked = S.integrity.sealed ? 'code differs from its seal' : 'not sealed';
    publish(); await notifier.send({ id: 'blocked', title: 'Chronos engine stopped', text: `Integrity: ${S.blocked}. Reinstall, or re-seal a deliberate change.`, level: 'error', minIntervalMs: 0 });
    await unpinStatus(`integrity: ${S.blocked} · reinstall, or re-seal a deliberate change`);
    log('BLOCKED integrity: ' + S.blocked); return finish(EXIT_SETUP);
  }
  S.cfg = loadConfig(envFile);
  // crash-loop breaker: several unclean starts in a row → safe mode (shadow only, fewer moving parts) until stable
  const crash = RM.onStart(DATA);
  if (crash.safeMode) {
    S.safe = { since: Date.now(), until: crash.until, crashes: crash.crashes, cause: crash.cause ? crash.cause.msg : null };
    S.cfg = RM.safeConfig(S.cfg);
    log(`SAFE MODE: ${crash.crashes} crashes in 10 min${crash.cause ? ' · last: ' + crash.cause.msg : ''} · shadow only until ${new Date(crash.until).toISOString()}`);
    await notifier.send({ id: 'safe-mode', title: 'Chronos is in safe mode', text: `It crashed ${crash.crashes} times in 10 minutes${crash.cause ? ': ' + crash.cause.msg.slice(0, 120) : ''}. It keeps scanning in shadow (sends nothing). Run: chronos assist`, level: 'error', minIntervalMs: 0 });
  }
  if (S.cfg.problems.length) {
    S.phase = 'blocked'; S.blocked = `${S.cfg.problems.length} setting(s) missing or invalid: run chronos setup`;
    publish(); await notifier.send({ id: 'blocked', title: 'Chronos engine needs setup', text: S.blocked, level: 'error', minIntervalMs: 0 });
    await unpinStatus(S.blocked);
    log('BLOCKED config: ' + S.cfg.problems.join('; ')); return finish(EXIT_SETUP);
  }
  S.thresholds = readThresholds(envFile); S.interval = S.thresholds.interval;
  if (S.safe) S.interval = Math.max(60, S.interval * 4);
  if (S.acting === 'standby') S.interval = S.interval * ROLES.STANDBY_INTERVAL_FACTOR; // a warm backup, not a second scanner
  S.baseInterval = S.interval;
  S.record = readRecord(live.workspaceDir(envFile));
  const h = history.load(DATA); S.history = h.records; S.historyRejected = h.rejected;

  // the scanning node is the one whose plan has the most room (CHRONOS_PRIMARY_NODE overrides): a free metered plan
  // (Infura credits, SwiftNodes 250k a month) is kept for backup roles while an unmetered node is set
  { const pick = choosePrimary(envGet, S.cfg); if (pick) { S.cfg = { ...S.cfg, rpcUrl: pick.url, rpcEnvKey: pick.key, rpcBatchMax: PR.batchMax(pick.url, envGet) }; log(`scanning with ${pick.key} (${pick.profile.name}${pick.profile.plan ? ' ' + pick.profile.plan : ''}): ${pick.why}`); } }
  // start-up with retry: a dead node or no network is retried every 60 s, never fatal
  while (!S.st && !stop) {
    try { S.st = await live.init(S.cfg, (k, st, d) => { if (st === 'fail') log(`init ${k} failed ${d || ''}`); }); }
    catch (e) {
      S.phase = 'error'; S.error = redact(e.shortMessage || e.message); publish();
      await notifier.send({ id: 'init', title: 'Chronos engine cannot start', text: `${S.error} · it retries every 60 s on your next node`, level: 'error', minIntervalMs: 3600000 });
      await notifier.status({ title: 'Chronos · cannot reach the chain yet', text: `${S.error}\nretrying every 60 s · fix: a working ARB_RPC_URL (chronos setup)` }).catch(() => {});
      log('init error ' + S.error);
      // a node that is rate-limited or out of quota ("exceeded maximum retry limit", 429) fails every retry: try your
      // next node instead of the same one, round-robin over every https node you set
      try {
        const nodes = PR.nodeEntries(envGet).filter((n) => /^https:\/\//.test(n.url));
        if (nodes.length > 1) {
          const i = nodes.findIndex((n) => n.url === S.cfg.rpcUrl); const next = nodes[(i + 1) % nodes.length];
          S.cfg = { ...S.cfg, rpcUrl: next.url, rpcEnvKey: next.key, rpcBatchMax: PR.batchMax(next.url, envGet) };
          log(`start-up: switching to ${next.key} for the next try`);
        }
      } catch (_) { /* keep the same node */ }
      for (let i = 0; i < 60 && !stop; i++) await sleep(1000);
    }
  }
  if (stop) { S.phase = 'stopped'; publish(); return finish(0); }
  S.phase = 'running'; S.error = null;
  log(`running: ${S.st.markets.length} pools · Multicall3 ${S.st.multicall ? 'on' : 'off'} · every ${S.interval}s`);
  await notifier.send({ id: 'start', title: 'Chronos engine running', text: `${S.st.markets.length} pools · scanning every ${S.interval}s · ${EPstart(envGet)}`, minIntervalMs: 0 });
  sys.probeNodes(envFile).then((x) => { S.nodes = x; }).catch(() => {});
  // CONTRACT_ADDRESS is used only if it really is a Chronos contract (then saved as CHRONOS_FLASH_ARB_ADDRESS)
  if (!RZ.contractFrom(envGet) && envGet('CONTRACT_ADDRESS') && S.st && S.st.provider && envFile) {
    const adopted = await RZ.adoptLegacy(S.st.provider, envGet, live.AAVE).catch(() => null);
    if (adopted) { const E = require('./envfile.cjs'); const d = E.load(envFile); E.set(d, 'CHRONOS_FLASH_ARB_ADDRESS', adopted); E.save(d); log(`CONTRACT_ADDRESS ${adopted} is your Chronos contract: saved as CHRONOS_FLASH_ARB_ADDRESS`); }
    else log(`CONTRACT_ADDRESS ${envGet('CONTRACT_ADDRESS')} is not a Chronos contract (another tool's?): not used. Deploy yours: chronos mainnet`);
  }
  const contract = RZ.contractFrom(envGet);
  // shadow + live execution
  const EP = readExecPolicy(envGet); S.execPolicy = EP.policy; S.execPolicyProblems = EP.problems;
  // a trade is broadcast through every other node you set (one eth_sendRawTransaction each, 80 Infura credits): the
  // first to reach the sequencer wins, the rest are harmless duplicates of the same signed transaction
  const others = PR.nodeEntries(envGet).filter((e) => e.url !== S.cfg.rpcUrl);
  const broadcastProviders = others.map((e) => new ethers.JsonRpcProvider(e.url, 42161, { staticNetwork: ethers.Network.from(42161) }));
  // and Arbitrum's own public endpoint (free, no key, forwards to the sequencer): a trade still gets out when every
  // node of yours is rate-limited (2.9.19)
  if (!PR.nodeEntries(envGet).some((e) => /arb1\.arbitrum\.io/.test(e.url)) && envGet('CHRONOS_SEQUENCER_BROADCAST') !== 'off') broadcastProviders.push(new ethers.JsonRpcProvider(require('./fan.cjs').SEQUENCER_RPC, 42161, { staticNetwork: ethers.Network.from(42161) }));
  const secondProvider = broadcastProviders[0] || null;
  let executor = null, executorAddress = null;
  const kmsKey = envGet('CHRONOS_EXECUTOR_KMS_KEY');
  if (kmsKey && contract) {
    try {
      const signer = new KmsSigner(kmsKey, S.st.provider);
      executor = new Executor({ provider: S.st.provider, broadcast: broadcastProviders, signer, contract: contract.address, policy: EP.policy, cfg: S.cfg, dataDir: DATA, log, spend });
    } catch (e) { S.execInfo = { ready: false, why: redact(e.message) }; }
  } else if (contract && require('./keystore.cjs').executorAddress(DATA)) {
    // no cloud key: your executor key on this phone signs through the key agent (lib/keyagent.cjs). The engine never
    // holds the key; when the agent is locked (phone restarted), readiness says so and nothing is sent.
    const ksAddr = require('./keystore.cjs').executorAddress(DATA); const want = envGet('CHRONOS_EXECUTOR_ADDRESS');
    if (/^0x[0-9a-fA-F]{40}$/.test(want || '') && want.toLowerCase() !== ksAddr.toLowerCase()) S.execInfo = { ready: false, why: `the executor keystore here is ${ksAddr} but CHRONOS_EXECUTOR_ADDRESS is ${want}: run chronos executor import with the right key, or chronos set CHRONOS_EXECUTOR_ADDRESS ${ksAddr}`, address: want };
    else {
      const { AgentSigner } = require('./keyagent.cjs');
      executor = new Executor({ provider: S.st.provider, broadcast: broadcastProviders, signer: new AgentSigner(DATA, S.st.provider), contract: contract.address, policy: EP.policy, cfg: S.cfg, dataDir: DATA, log, spend });
      log(`executor ${ksAddr}: signs on this phone through the key agent${(await require('./keyagent.cjs').status(DATA)) ? ' (unlocked)' : ' (locked: run chronos executor unlock)'}`);
    }
  }
  // the executor hand-off, so nothing is copied by hand: the engine that holds the KMS key (your cloud VM) tells your
  // other approved devices its address, derived from the key's own public key; your phone picks it up (chronos
  // mainnet, and a notification here). Both sides are approved devices of yours; nothing secret is sent.
  if (kmsKey) {
    let offered = false, failedOnce = false;
    const offer = async () => {
      if (offered || stop) return;
      try {
        if (!S.device || S.device.status !== 'approved') S.device = { ...(S.device || {}), ...(await DV.status()) };
        if (S.device.status !== 'approved') return;
        const a = await new KmsSigner(kmsKey, S.st.provider).getAddress();
        await DV.offerExecutor(a, kmsKey); offered = true;
        log(`executor ${a} offered to your other devices (your phone picks it up: chronos mainnet)`);
      } catch (e) { if (!failedOnce) log('executor hand-off not sent yet: ' + redactMsg(e)); failedOnce = true; }
    };
    offer(); setInterval(offer, 300000).unref();
  } else if (!/^0x[0-9a-fA-F]{40}$/.test(envGet('CHRONOS_EXECUTOR_ADDRESS') || '')) {
    let told = false;
    const pickup = async () => {
      if (told || stop) return;
      try {
        const [x] = await DV.executors(); if (!x) return; told = true;
        await notifier.send({ id: 'executor-ready', title: 'Your cloud executor is ready', text: `${x.device} signs with ${x.address}. Tap Save it, then run chronos mainnet to make it an operator (costs shown, sent only on YES).`, minIntervalMs: 0, buttons: [{ label: 'Save it', action: 'chronos executor' }] });
        log(`your cloud engine ${x.device} offers executor ${x.address}: run chronos mainnet to use it`);
      } catch (_) { /* not approved or offline: next time */ }
    };
    pickup(); setInterval(pickup, 600000).unref();
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(envGet('CHRONOS_EXECUTOR_ADDRESS') || '')) executorAddress = ethers.getAddress(envGet('CHRONOS_EXECUTOR_ADDRESS').toLowerCase());
  S.shadowRuns = [];
  try { S.shadowRuns = fs.readFileSync(path.join(DATA, 'shadow.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((x) => Date.now() - x.at < DAY); } catch (_) { /* first run */ }
  S.mode = MODE.starting();
  let nextUpdate = Date.now() + 60000, nextBeat = 0, freshAfter = 0, nextExecCheck = 0, nextBalances = Date.now() + 15000;
  const killFile = path.join(DATA, 'live', 'kill');
  const pxFor = (assetAddr, gasPriceWei) => {
    const a = S.st.assets.find((x) => x.address === String(assetAddr).toLowerCase()); const w = S.st.assets.find((x) => x.address === live.WETH);
    return a && w && a.price8 && w.price8 ? { assetPrice8: a.price8, decimals: a.decimals, ethPrice8: w.price8, gasPriceWei } : null;
  };
  const aaveFor = (assetAddr) => { const a = S.st.assets.find((x) => x.address === String(assetAddr).toLowerCase()); return { pool: process.env.CHRONOS_AAVE_POOL || AAVE_POOL, flashEnabled: !!(a && a.flashEnabled), availableLiquidity: a && a.available !== undefined ? a.available : null }; };
  // shadow test + live execution of one scan's result (full scan or fast re-check): same rules either way
  const act = async (res, deps) => {
      // shadow test: the best approved routes, your contract's exact call, at this scan's block
    const who = executor ? (S.execInfo && S.execInfo.address) || executorAddress : executorAddress; // a locked key still rehearses as its address
    if (contract && who && res.approved) {
      const top = res.candidates.filter((c) => c.approved && c.runParams).slice(0, EP.policy.EXEC_SHADOW_TOPK);
      for (const c of top) {
        const px = pxFor(c.runParams.asset, deps.gasPriceWei); if (!px) continue;
        const sh = await SH.run({ provider: S.st.provider, contract: contract.address, executor: who, cand: { ...c, routeKey: routeKey(c) }, aave: aaveFor(c.runParams.asset), px, floorUsd: S.cfg.MIN_NET_PROFIT_USD, blockTag: res.blockNumber });
        if (sh.ok && sh.gas) gasDesk.learn((c.legs || []).map((l) => l.kind), (c.flash && c.flash.provider) || 'aave_v3', sh.gas); // measured gas of this route type
        S.shadowRuns.push(sh); sync.enqueue('shadow_runs', SYNC.MAP.shadow(sh)); agents.requirements(sh); c.shadow = { win: sh.win, stage: sh.stage, netUsd: sh.netUsd ?? null, error: sh.error || null };
        try { fs.appendFileSync(path.join(DATA, 'shadow.jsonl'), JSON.stringify(sh) + '\n', { mode: 0o600 }); } catch (_) { /* in memory still */ }
      }
      S.shadowRuns = S.shadowRuns.filter((x) => Date.now() - x.at < DAY).slice(-5000);
      // live: the best fresh shadow win of this scan, if the mode controller says LIVE
      const win = top.filter((c) => c.shadow && c.shadow.win).sort((a, b) => b.shadow.netUsd - a.shadow.netUsd)[0];
      const sendOk = ROLES.canSend({ acting: S.acting, dbEnabled: !!sync.enabled, lastDbOkAt: S.lastDbOkAt || 0 }); S.sendWhy = sendOk.why;
      if (executor && win && S.mode.mode === 'LIVE' && sendOk.ok) { // only the acting primary, in touch with your database, ever sends
        const px = pxFor(win.runParams.asset, deps.gasPriceWei);
        const r = await executor.execute({ cand: { ...win, routeKey: routeKey(win) }, aave: aaveFor(win.runParams.asset), px });
        S.lastExec = { at: Date.now(), ...r };
        // a LIVE engine that cannot send must never look healthy: 3 send failures in a row that are not the market
        // (the executor erred, or no node took the transaction) alert you at once
        if (r.sent) S.execInfraFails = 0;
        else if (/executor error|no node accepted/.test(r.reason || '')) {
          S.execInfraFails = (S.execInfraFails || 0) + 1;
          if (S.execInfraFails === 3) await notifier.send({ id: 'exec-failing', title: 'Chronos: LIVE but trades cannot be sent', text: `3 attempts in a row failed before reaching the chain: ${redact(r.reason)}. It keeps trying; check your nodes (chronos nodes) and the executor (chronos verify-real).`, level: 'error', minIntervalMs: 0 });
        }
        if (r.sent) await notifier.send({ id: 'exec:' + r.txHash, title: r.status === 'success' ? `Executed: +$${(r.netUsd || 0).toFixed(2)} net` : r.status === 'reverted' ? 'Execution reverted (gas only)' : 'Execution sent', text: `${routeKey(win).split('|')[0].replace('>', ' → ')} · ${r.txHash}`, level: r.status === 'reverted' ? 'error' : 'info', minIntervalMs: 0 });
        if (r.sent && r.txHash && r.status !== 'success') sync.enqueue('executions', SYNC.MAP.execution({ txHash: r.txHash, status: r.status === 'reverted' ? 'reverted' : 'pending', block: r.block ?? null, gasUsd: r.gasUsd ?? null }, Date.now(), { at: new Date().toISOString(), route: routeKey(win) }));
        if (r.sent) nextRealized = 0; // verify it from its receipt right away
      }
    }
  };
  const HOT_MS = Math.max(0, Number(S.cfg.HOT_SCAN_MS ?? 3000));
  let nextHot = 0; S.hot = new Set();
  // websocket block feed: with one or more wss:// urls set, the fast lane runs on every new block instead of a timer
  const { BlockFeed, wssUrls } = require('./blockfeed.cjs');
  let blockKick = false; const movedPools = new Set();
  // every websocket you set plus the one each node's provider has (the feed policy decides which its plan can carry)
  const wss = [...new Set([...wssUrls(envGet), ...PR.nodeEntries(envGet).map((e) => PR.wssFromRpc(e.url)).filter(Boolean)])];
  // every https node you set scans in turn, each inside its plan (lib/nodepool.cjs); the init node is reused as is
  const pool = new NodePool({ entries: PR.nodeEntries(envGet), get: envGet, log, connect: (url) => require('./chain.cjs').connect({ ...S.cfg, rpcUrl: url, rpcBatchMax: PR.batchMax(url, envGet) }) });
  { const own = pool.nodes.find((n) => n.url === S.cfg.rpcUrl); if (own) own.provider = S.st.provider; }
  S.pool = pool;
  // burst mode (lib/fan.cjs, default on; CHRONOS_SCAN_MODE=paced for the old one-node-per-scan pacing): every scan
  // read is spread over all your nodes at once; a rate limit or slow node fails over at once instead of retrying;
  // your first node stays the send lane. Only the primary bursts: a standby keeps its slow pace.
  const FAN = require('./fan.cjs'); let fan = null;
  if (String(envGet('CHRONOS_SCAN_MODE') || 'burst').toLowerCase() !== 'paced') {
    try {
      const m = FAN.members(PR.nodeEntries(envGet), envGet, S.cfg.rpcUrl, String(envGet('CHRONOS_BURST_NODES') || 'free').toLowerCase());
      if (m.members.length) {
        fan = new FAN.FanProvider(m.members, { get: envGet, timeoutMs: Math.max(500, Number(envGet('CHRONOS_RPC_TIMEOUT_MS') || FAN.DEFAULT_TIMEOUT_MS)), log });
        log(`burst mode: ${m.members.map((x) => x.key).join(', ')} share every scan${m.out.length ? ` · not in it: ${m.out.map((o) => `${o.key} (${o.why})`).join('; ')}` : ''}`);
      } else log('burst mode: no node can join it (every node may bill per request or is your send lane): scans stay paced');
    } catch (e) { fan = null; log('burst mode off: ' + redact(e.message)); }
  }
  S.fan = fan; const bursting = () => !!fan && S.acting !== 'standby';
  const gasDesk = new (require('./gas.cjs').GasDesk)(); // the gas specialist (lib/gas.cjs)
  // tempo: more scanning and more routes quoted while scans find real gaps, back to base when quiet (lib/tempo.cjs)
  const tempo = new (require('./tempo.cjs').Tempo)({ max: envGet('CHRONOS_TEMPO_MAX') === undefined || envGet('CHRONOS_TEMPO_MAX') === '' ? 3 : Number(envGet('CHRONOS_TEMPO_MAX')) }); S.tempo = tempo.status();
  // price-move relay (lib/relay.cjs): pools your node saw move are shared with every engine; moves shared by the others
  // come back here, so a node without log streams re-quotes only what moved
  // chain signals: the engine's own research, or every engine's (your database's chain_trades) when that has more
  const CS = require('./chainsignals.cjs');
  try { S.chainLocal = CS.compute(JSON.parse(fs.readFileSync(path.join(DATA, 'research.json'), 'utf8')).rows || []); } catch (_) { S.chainLocal = null; }
  const refreshSignals = () => { S.chainSignals = CS.pick(S.chainLocal, S.insights && S.insights.chain && S.insights.chain.signals); S.routePrior = CS.prior(S.chainSignals); };
  refreshSignals();
  // one workspace on every device: a .env changed on another device (Syncthing) is checked and applied here by a
  // restart; a broken file is never applied (lib/settingswatch.cjs)
  const SW = new (require('./settingswatch.cjs').SettingsWatch)({ file: live.findEnvFile(), log,
    tell: (title, text) => log(`${title}: ${text}`),
    onChange: () => { log('settings changed on another device: restarting with them'); const r = require('./service.cjs').restartSoon(); if (r !== 'requested') setTimeout(() => process.exit(0), 1000).unref?.(); } }).start();
  S.settingsWatch = () => SW.status();
  const RL = require('./relay.cjs');
  const relayOn = sync.enabled && envGet('CHRONOS_RELAY') !== 'off';
  const relayPub = relayOn ? new RL.Publisher({ enqueue: sync.enqueue }) : null;
  const relayIn = relayOn && !S.safe ? new RL.Listener({ url: RL.realtimeUrl(envGet('CHRONOS_SYNC_URL') || SYNC.defaultUrl(), envGet('CHRONOS_PORTAL_PUBLISHABLE_KEY') || require('./realcheck.cjs').PORTAL_KEY), onPools: (ps) => { for (const p of ps) movedPools.add(p); blockKick = true; }, log }).start() : null;
  const feed = wss.length && !S.safe ? new BlockFeed({ urls: wss, onBlock: () => { blockKick = true; }, onSwap: (a, b) => { movedPools.add(a); blockKick = true; if (relayPub) relayPub.moved(a, b); }, pools: S.st.markets.map((m) => m.address), log, policy: (u) => PR.feedPolicy(u, envGet) }).start() : null;
  if (!feed) log('no wss:// url set (ARBITRUM_WSS_URL): fast lane runs every ' + HOT_MS + ' ms instead of on every block');
  let nextNearMiss = 0, nextScan = 0, nextNodes = Date.now() + 120000, nextRealized = 0, lastVerdict = null, scans = 0;
  // incident resolver: researched resolutions in order, each verified, never repeated; then the AI agent (allowlisted
  // actions only); then you. Every step goes to the log, the portal (agent activity), your phone and your webhook.
  const { Resolver, ACTIONS } = require('./resolver.cjs');
  const webhook = require('./webhook.cjs').createWebhook({ url: require('./hookurl.cjs').effective(envGet, 'CHRONOS_ALERT_WEBHOOK_URL'), secret: envGet('CHRONOS_ALERT_WEBHOOK_SECRET'), version: require('../package.json').version, log });
  // which contract you deployed (v1/v2), its Balancer vault and the factories it allows: read hourly, used to build
  // only calls that contract accepts (lib/contractinfo.cjs). Unknown → v1 calls.
  let cInfo = null, cInfoAt = 0;
  const contractInfo = async () => {
    if (!contract || !S.st || !S.st.provider) return null;
    if (cInfo && Date.now() - cInfoAt < 3600000) return cInfo;
    try {
      const factories = [...new Set(S.st.markets.map((m) => m.factory).filter(Boolean))];
      const curvePools = S.st.markets.filter((m) => m.kind === 'curve').map((m) => m.address);
      cInfo = await require('./contractinfo.cjs').read(S.st.provider, contract.address, factories, 'latest', curvePools); cInfoAt = Date.now();
      S.contractInfo = { kind: cInfo.kind, vault: cInfo.vault, v4: cInfo.v4 || null, factoriesAllowed: Object.values(cInfo.factories).filter((f) => f.allowed).length, curvePoolsAllowed: Object.values(cInfo.curvePools || {}).filter(Boolean).length };
    } catch (e) { log('contract info: ' + redact(e.shortMessage || e.message)); }
    return cInfo;
  };
  const reinit = async () => { if (watchdog) watchdog.grace(INIT_GRACE_SEC); S.st = await live.init(S.cfg, () => {}); if (executor) executor.rebind(S.st.provider); if (feed) feed.setPools(S.st.markets.map((m) => m.address)); return `${S.st.markets.length} pools on ${S.cfg.rpcEnvKey || 'your node'}`; };
  const doAction = async (a) => {
    switch (a) {
      case 'web-reference-check': {
        const pub = await fetch('https://arb1.arbitrum.io/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }), signal: AbortSignal.timeout(8000) }).then((r) => r.json()).then((j) => Number(BigInt(j.result))).catch(() => null);
        const mine = S.st && S.st.provider ? await S.st.provider.getBlockNumber().catch(() => null) : null;
        return `public Arbitrum endpoint block ${pub ?? 'unreachable'} · your node block ${mine ?? 'unreachable'}${pub && mine ? ` · behind by ${pub - mine}` : ''}`;
      }
      case 'reinit': return 're-initialised: ' + (await reinit());
      case 'failover-node': {
        const ranked = PR.rankForScanning(nodeEntries(envGet), envGet); // most room first
        const urls = [...new Set(ranked.map((x) => x.url))];
        if (urls.length < 2) throw new Error('only one RPC node is configured (add ARB_RPC_URL_2)');
        const i = urls.indexOf(S.cfg.rpcUrl); const next = urls[(i + 1) % urls.length]; const key = ranked.find((x) => x.url === next).key;
        S.cfg = { ...S.cfg, rpcUrl: next, rpcEnvKey: key, rpcBatchMax: PR.batchMax(next, envGet) };
        return `now using ${key}: ` + (await reinit());
      }
      case 'backoff': S.baseInterval = Math.min(300, S.baseInterval * 2); S.interval = S.baseInterval; return `scans every ${S.interval} s`;
      case 'reduce-load': { const par = Math.max(4, Math.floor((S.cfg.SCAN_PARALLEL || 64) / 2)); S.cfg = { ...S.cfg, SCAN_PARALLEL: par, CONCURRENCY: Math.max(2, Math.floor((S.cfg.CONCURRENCY || 6) / 2)) }; S.fastPausedUntil = Date.now() + 3600000; return `parallel quotes ${par}; fast lane paused 1 h`; }
      case 'fast-lane-off': S.fastPausedUntil = Date.now() + 3600000; return 'fast lane paused for 1 h';
      case 'clear-market-cache': { try { fs.unlinkSync(path.join(DATA, 'markets_cache.json')); } catch (_) { /* none */ } return 'pool list rediscovered: ' + (await reinit()); }
      case 'restart-feed': if (!feed) throw new Error('no websocket feed is configured'); return feed.restart();
      case 'scan-now': nextScan = 0; return 'scan started';
      case 'shadow-only': S.shadowUntil = Date.now() + 3600000; return 'sending paused for 1 h (shadow continues)';
      case 'flush-sync': { await sync.flush(Date.now() + 15000); return `${sync.pending()} row(s) still queued`; }
      case 'prune-logs': { let n = 0; const dir = path.join(DATA, 'logs'); for (const f of (fs.existsSync(dir) ? fs.readdirSync(dir) : [])) { const fp = path.join(dir, f); const st = fs.statSync(fp); if (st.isFile() && st.size > 5e6) { const keep = Buffer.alloc(1e6); const fd = fs.openSync(fp, 'r'); fs.readSync(fd, keep, 0, 1e6, st.size - 1e6); fs.closeSync(fd); fs.writeFileSync(fp, keep); n++; } } return `${n} log file(s) rotated`; }
      case 'restart-engine': { const t = Date.now(); const rs = (agents.st.restarts || []).filter((x) => t - x < 3600000); if (rs.length >= 3) throw new Error('restart cap reached (3 per hour)'); agents.st.restarts = [...rs, t]; agents.save(); agents.wantRestart = 'incident resolver'; stop = true; return 'engine restarting'; }
      default: throw new Error('not an allowlisted action: ' + a);
    }
  };
  const llm = brain.ready ? require('./agentllm.cjs').createActionAgent({ chat: (q) => brain.chat(q) }) : null;
  resolver = new Resolver({ dataDir: DATA, act: doAction, agent: llm, report: (kind, p) => {
    const line = `resolver ${kind}: ${p.problem}${p.action ? ' · ' + p.action : ''}${p.outcome ? ' · ' + p.outcome : ''}${p.evidence ? ' · ' + p.evidence : ''}${p.why ? ' · ' + p.why : ''}`;
    baseLog(line);
    agents.event('resolver', kind === 'escalated' ? 'critical' : kind === 'resolved' ? 'info' : 'warn', p.problem, line.slice(9, 300), { action: p.action || null, outcome: p.outcome || kind });
    if (kind === 'escalated') notifier.send({ id: 'esc:' + p.problem, title: `Chronos needs you: ${p.symptom.replace(/`/g, '')}`, text: `${p.why}. ${p.you}. Run: chronos assist`, level: 'error' }).catch(() => {});
    if (kind === 'resolved') notifier.send({ id: 'fix:' + p.problem, title: `Chronos fixed: ${p.symptom.replace(/`/g, '')}`, text: `by ${p.how}`, minIntervalMs: 60000 }).catch(() => {});
    if (webhook) webhook(kind, p).catch(() => {});
  } });
  let feedDownSince = 0;
  // the company: departments report to the VP, the VP decides, delegates and verifies; you get the daily report and
  // the three kinds of immediate alerts (database down, money lost, money made)
  // the honeycomb mind-state (task-driven, collapses on acceptance) and the documentation archive for the analyst
  const mind = new (require('./mind.cjs').Mind)({ dataDir: DATA, max: Math.min(400, Math.max(40, Number(envGet('CHRONOS_MIND_MAX_CELLS')) || 120)) });
  let archiveCache = null; const kb = () => (archiveCache = archiveCache || require('./knowledge.cjs').archive(envGet, { workspace: live.workspaceDir(envFile) }));
  const { Company } = require('./company.cjs');
  const ENVF = require('./envfile.cjs');
  // competitor research (lib/research.cjs): flash loans and own-capital cycles from the chain, pooled in your
  // chain_trades table. Runs by itself every RESEARCH_EVERY_MIN (default 60) on your primary device, and when the VP
  // asks; one at a time.
  let researching = false, nextResearch = Date.now() + 5 * 60000;
  const researchNow = async () => {
    if (S.acting !== 'primary') return 'skipped: research runs on your primary device';
    if (!S.st || !S.st.provider) return 'skipped: chain not connected';
    if (researching) return 'skipped: research already running';
    researching = true;
    try {
      const R = require('./research.cjs'); const weth = S.st.assets.find((a) => a.address === live.WETH);
      const venues = JSON.parse(fs.readFileSync(live.VENUES_FILE, 'utf8')).venues;
      const r = await R.run({ logsChunk: PR.logsMaxBlocks(S.cfg.rpcUrl, envGet) || 2000, provider: S.st.provider, aavePool: live.AAVE, balancerVault: S.st.balancer ? S.st.balancer.vault : null, morpho: live.MORPHO, venues, assets: S.st.assets, ethPrice8: weth ? weth.price8 : 0n, hours: 6, maxTx: 60, swapBlocks: Math.max(0, Number(envGet('RESEARCH_SWAP_BLOCKS') || 600)), log });
      fs.writeFileSync(path.join(DATA, 'research.json'), JSON.stringify(r, (_, v) => (typeof v === 'bigint' ? v.toString() : v)), { mode: 0o600 });
      let sent = 0; if (sync.enabled) for (const row of r.rows || []) { const x = SYNC.MAP.chainTrade(row); if (x) { sync.enqueue('chain_trades', x); sent++; } } // every engine's research, pooled in your database
      S.chainLocal = CS.compute(r.rows || []); refreshSignals();
      S.research = { at: Date.now(), txs: r.transactions, profitable: r.profitableAfterGas, synced: sent };
      return `${r.transactions} arbitrage tx read (flash loans and own capital), ${r.profitableAfterGas} profitable after gas, ${r.venuesYouLack.length} venue(s) we lack, ${sent} sent to chain_trades`;
    } catch (e) { S.research = { at: Date.now(), error: redact(e.message) }; return 'research failed: ' + redact(e.message); } finally { researching = false; }
  };

  const company = new Company({
    dataDir: DATA, mind, reportAt: envGet('CHRONOS_REPORT_TIME') || '07:30', tz: envGet('CHRONOS_TZ') || 'America/Los_Angeles',
    applyEnv: (key, value) => {
      try { const doc = ENVF.load(envFile); ENVF.set(doc, key, String(value)); ENVF.save(doc); } catch (e) { return 'not applied: ' + redact(e.message); }
      agents.wantRestart = 'VP changed ' + key; stop = true; // the engine restarts cleanly to load it
      return `applied: ${key}=${value} (engine restarts to load it)`;
    },
    delegate: async (task, { reports, ...extra }) => {
      if (task === 'research') return researchNow();
      if (task === 'verify-real') {
        const RC = require('./realcheck.cjs');
        // every check except the two test pings (they would ping you daily); results land in data/live/realcheck.json
        const r = await RC.verifyReal({ envFile, dataDir: DATA, only: Object.keys(RC.CHECKS).filter((k) => k !== 'phone-notify' && k !== 'notify-webhook') }); // no daily test pings
        const n = (st) => r.results.filter((x) => x.status === st).length;
        return `${n('pass')} pass, ${n('fail')} fail${n('fail') ? ' (' + r.results.filter((x) => x.status === 'fail').map((x) => x.id).join(', ') + ')' : ''}, ${n('not run')} not run`;
      }
      if (task === 'scan-now') { nextScan = 0; return 'scan started'; } // the VP's success push
      if (task.startsWith('act:')) return doAction(task.slice(4)); // a team agent's skill: allowlisted actions only (doAction refuses the rest)
      if (task === 'analyse') { // the AI analyst (lib/vpagent.cjs), allowlisted tools only
        const RC = require('./realcheck.cjs'); const BS = require('./blockscout.cjs'); const base = BS.baseUrl(envGet);
        const analyst = require('./vpagent.cjs').createAnalyst({ brain: S.brain, archive: kb(), mind, logTail: () => ring, lastAudit: () => S.audit || null, bs: base ? new BS.Blockscout(base) : null,
          checks: Object.keys(RC.CHECKS).filter((k) => k !== 'phone-notify' && k !== 'notify-webhook'), runCheck: async (id) => (await RC.verifyReal({ envFile, dataDir: null, only: [id] })).results[0],
          actions: ['web-reference-check', 'reinit', 'failover-node', 'backoff', 'reduce-load', 'fast-lane-off', 'clear-market-cache', 'restart-feed', 'scan-now', 'shadow-only', 'flush-sync'], act: doAction,
          propose: (k, v, why) => company.propose(k, v, why) });
        if (!analyst) return { answer: null, why: 'no AI key works (OPENROUTER_API_KEY… / ANTHROPIC_API_KEY)' };
        return analyst(extra.question || 'What is the next step to real profit?');
      }
      if (task === 'audit') { // after every VP task: your checks + Blockscout + the road reassessed (lib/vpaudit.cjs)
        const BS = require('./blockscout.cjs'); const base = BS.baseUrl(envGet); const RC = require('./realcheck.cjs');
        const lastRc = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'live', 'realcheck.json'), 'utf8')); } catch (_) { return null; } })();
        const rcFresh = lastRc && lastRc.at && Date.now() - Date.parse(lastRc.at) < 2 * 3600000; // a full run at most every 2 h; between, the last one counts
        const a = await require('./vpaudit.cjs').audit({
          get: envGet, provider: S.st && S.st.provider, bs: base ? new BS.Blockscout(base) : null, owner: require('./keystore.cjs').ownerAddress(DATA), realized: S.realized,
          verifyReal: async () => (rcFresh ? lastRc : RC.verifyReal({ envFile, dataDir: DATA, only: Object.keys(RC.CHECKS).filter((k) => k !== 'phone-notify' && k !== 'notify-webhook') })),
          road: extra.road || [], trading: { ...reports.trading.kpis, brokenPools: S.res && S.res.indicators && S.res.indicators.brokenPools ? S.res.indicators.brokenPools.length : 0 }, after: extra.after || [], now: Date.now(),
        });
        S.audit = a; try { fs.writeFileSync(path.join(DATA, 'audit.json'), JSON.stringify(a, null, 2), { mode: 0o600 }); } catch (_) { /* shown in the dashboard anyway */ }
        if (sync.enabled) sync.enqueue('reports', { day: company.localDay(Date.now()), kind: 'audit', title: a.fail ? `Audit: ${a.fail} problem(s)` : 'Audit: clean', body: a, critical: a.fail > 0 });
        log(a.line);
        return a;
      }
      if (task === 'flush-sync') { await sync.flush(Date.now() + 15000); return `${sync.pending()} row(s) still queued`; }
      if (task === 'build-request') {
        const T = reports.trading.kpis;
        const ask = { blocker: T.topBlocker, bestBlockedUsd: T.topBlockerBestUsd, rawGaps: T.rawGaps, approved: T.approved, research: reports.research.kpis };
        if (sync.enabled) sync.enqueue('reports', { day: company.localDay(Date.now()), kind: 'build-request', title: 'VP build request', body: ask, critical: false });
        return 'build request posted for the builder: ' + JSON.stringify(ask).slice(0, 200);
      }
      return 'unknown task';
    },
    alert: (level, title, text) => {
      // milestone notices replace each other on the phone (one 'road to cash' notification, always current)
      notifier.send({ id: level === 'milestone' ? 'co:road' : level === 'audit' || /^Audit:/.test(title) ? 'co:audit' : level === 'success' ? 'co:success:' + title : 'co:' + title, title, text, level: level === 'critical' ? 'error' : 'info', minIntervalMs: 0 }).catch(() => {});
      if (webhook) webhook(level === 'report' ? 'daily-report' : 'alert', { level, title, text }).catch(() => {});
    },
    report: (kind, e) => {
      agents.event(e.by || (kind === 'daily-report' ? 'vp' : 'company'), kind === 'alert' && e.level === 'critical' ? 'critical' : 'info', kind, String(e.what || e.title || e.task || e.change || kind).slice(0, 300), { outcome: e.outcome || 'none' });
      if (sync.enabled && (kind === 'daily-report' || kind === 'alert')) sync.enqueue('reports', { day: e.day || company.localDay(Date.now()), kind, title: e.title || 'Daily report', body: e, critical: kind === 'alert' && e.level === 'critical' });
    },
  });
  let nextCompany = 0;

  if (executor) { S.execInfo = await executor.readiness(); nextExecCheck = Date.now() + 60000; }
  let pausedBefore = null;
  if (watchdog) watchdog.start();
  while (!stop) {
    if (watchdog) watchdog.beat(false); S.spend = spend.today(); S.watchdog = watchdog ? watchdog.status() : { on: false };
    S.feedStatus = feed ? feed.status() : null;
    S.relay = relayOn ? { publisher: relayPub.status(), listener: relayIn ? relayIn.status() : null } : null;
    S.paused = LS.control.isPaused(DATA);
    const pauseChanged = pausedBefore !== null && S.paused !== pausedBefore; pausedBefore = S.paused;
    let refresh = pauseChanged;
    const poke = LS.control.takePoke(DATA);
    if (!S.paused && (poke || Date.now() >= nextScan)) {
      S.scanning = true; publish();
      let waitMs = null, pn = null, before = null;
      try {
        S.progress = { phase: 'start', done: 0, total: 0 };
        let scanProvider;
        if (bursting()) { scanProvider = fan; S.scanNode = 'burst (' + fan.members.length + ' nodes)'; }
        else {
          const pk = pool.nodes.length ? pool.pick() : null;
          if (pk && pk.wait) { waitMs = pk.wait; throw Object.assign(new Error('every node is at its plan pace'), { poolWait: true }); }
          pn = pk ? pk.node : null;
          scanProvider = pn ? await pool.provider(pn) : S.st.provider;
          before = pn ? pool.snap(pn) : null; S.scanNode = pn ? pn.key : S.cfg.rpcEnvKey;
        }
        const deps = await live.snapshot(S.cfg, S.st, scanProvider);
        deps.routePrior = S.routePrior; // chain signals: winners' route shapes quoted first
        deps.contract = await contractInfo();
        let lastProg = 0;
        deps.onProgress = (p) => { S.progress = p; if (watchdog) watchdog.beat(true); if (Date.now() - lastProg > 400) { lastProg = Date.now(); publish(); } };
        deps.gasUnits = gasDesk.unitsMap();
        const res = await runScan({ ...S.cfg, SCAN_QUOTE_CYCLES: tempo.quotes(S.cfg.SCAN_QUOTE_CYCLES || process.env.SCAN_QUOTE_CYCLES || 400) }, deps);
        { const tp = tempo.observe(res); S.tempo = tempo.status(); if (tp.changed) log(`tempo ${tp.level}/3: ${tp.why} · scans every ${tempo.interval(S.baseInterval)} s, ${tempo.quotes(S.cfg.SCAN_QUOTE_CYCLES || 400)} routes quoted`); }
        gasDesk.observePrice(res.gasGwei); S.gas = gasDesk.status({ executorEth: S.execInfo && Number.isFinite(S.execInfo.gasEth) ? S.execInfo.gasEth : null, gasGwei: res.gasGwei, ethUsd: deps.ethUsd, assumedUnits: S.cfg.GAS_UNITS_ASSUMED });
        S.res = res; S.error = null; S.consecutiveErrors = 0; S.interval = S.baseInterval; S.lastScanAt = Date.now(); S.lastQuotes = { n: deps.counter.n, fail: deps.counter.fail };
        // what this node billed for the scan decides when it may scan again (its plan); the fast lane runs on the init
        // node every block, so it pauses while that node is on a metered plan's pace
        if (pn) { pool.done(pn, before); if (pn.url === S.cfg.rpcUrl && pn.paceS) S.fastPausedUntil = Math.max(S.fastPausedUntil || 0, pn.nextAt); }
        const fresh = S.session.add(res);
        const best = res.candidates[0];
        const rec = { t: Date.now(), block: res.blockNumber, gas: res.gasGwei, best: best ? best.netUsd : null, approved: res.approved, ms: res.tookMs, quotes: deps.counter.n, fails: deps.counter.fail, sp: ((res.indicators && res.indicators.spreads) || []).slice(0, 8).map((x) => [x.pair.join('/'), x.bps]), near: res.indicators && res.indicators.cycles ? res.indicators.cycles.nearMiss10bps : null };
        for (const c of res.candidates) if (c.approved && c.netUsd > 0) sync.enqueue('opportunities', SYNC.MAP.opportunity({ ...c, routeKey: routeKey(c) }, res.blockNumber, Date.now()));
        // every failed route mirrored: its opposite direction (quoted in the same scan) is checked and, when it pays,
        // you are told and the success webhook fires (lib/mirror.cjs)
        try { S.mirror = S.mirror || {}; const mr = require('./mirror.cjs').capitalize(S.mirror, res, S.cfg.MIN_NET_PROFIT_USD, { now: Date.now(), webhook,
          notify: (level, title, text) => notifier.send({ id: 'mirror:' + title, title, text, level: 'info', minIntervalMs: 0 }).catch(() => {}) });
          S.mirrorFired = (S.mirrorFired || []).concat(mr.fired); } catch (e) { log('mirror pass failed ' + redact(e.message)); }
        // path to profit: the 10 closest routes with their cost breakdown, every 5 minutes (portal, insights function)
        if (Date.now() >= nextNearMiss) {
          nextNearMiss = Date.now() + 300000; const INS = require('./insights.cjs');
          for (const r of INS.nearMisses(res, S.cfg.MIN_NET_PROFIT_USD)) sync.enqueue('route_stats', r);
          INS.fetchInsights(sync).then((j) => {
            if (j) { S.insights = j; S.lastDbOkAt = Date.now(); refreshSignals(); }
            // role: a standby takes over when the primary is silent for 10 min, and hands back when it reports again
            const d = ROLES.decide({ role: S.role, me: 'chronos-engine@' + DV.engineName(), engines: j && Array.isArray(j.engines) ? j.engines : null });
            if (d.acting !== S.acting) { log(`role: ${d.why}`); S.acting = d.acting; S.baseInterval = S.thresholds.interval * (S.acting === 'standby' ? ROLES.STANDBY_INTERVAL_FACTOR : 1); S.interval = S.baseInterval; }
            S.roleWhy = d.why;
          }).catch(() => {}); // all engines, from your portal database
        }
        try { history.append(DATA, rec); } catch (_) { /* history is optional */ }
        S.history.push(rec); if (S.history.length > 240) S.history.shift();
        for (const e of fresh) await notifier.send({ id: 'ep:' + e.route, title: 'Opportunity passed every guardrail', text: `${e.route.split('|')[0].replace('>', ' → ')} · net $${e.netUsd.toFixed(2)} at block ${e.block} (a quote; nothing was sent)`, minIntervalMs: 30 * 60000 });
        await act(res, deps);
        S.hot = new Set(res.hot || []); nextHot = Date.now() + HOT_MS;
        scans++; refresh = true;
      } catch (e) {
        if (e.poolWait) { S.scanning = false; S.progress = null; nextScan = Date.now() + waitMs; S.poolWaitMs = waitMs; continue; }
        if (e.allCooling || (e.error && e.error.allCooling)) { S.scanning = false; S.progress = null; const w = e.waitMs || (e.error && e.error.waitMs) || 1000; nextScan = Date.now() + w; S.poolWaitMs = w; log(`burst: every node is cooling down; next scan in ${Math.ceil(w / 1000)} s`); continue; }
        // a node failed: it cools down and the scan is retried on the next node now (a limit is not a failure)
        if (pn && pool.nodes.length > 1) {
          const ms = pool.failed(pn, e); const next = pool.pick();
          log(`${pn.key} ${PR.isLimitError(e.shortMessage || e.message) ? 'is at its plan limit' : 'failed: ' + redact(e.shortMessage || e.message).slice(0, 60)}: resting ${Math.round(ms / 1000)} s; ${next.node ? 'retrying the scan on ' + next.node.key : 'next node in ' + Math.round(next.wait / 1000) + ' s'}`);
          if (next.node) { next.node.usedAt = 0; S.scanning = false; S.progress = null; nextScan = Date.now(); continue; }
        }
        if (pn && pool.nodes.length === 1) pool.failed(pn, e);
        S.consecutiveErrors++; S.session.error(); S.error = redact(e.shortMessage || e.message); log('scan error ' + S.error);
        // pre-coded resolution: re-initialise, then back off, then alert (never spin on a dead node)
        const a = RM.scanFailure(S.consecutiveErrors, S.baseInterval);
        if (a.reinit) { try { if (watchdog) watchdog.grace(INIT_GRACE_SEC); S.st = await live.init(S.cfg, () => {}); if (executor) executor.rebind(S.st.provider); log('auto-fix: chain connection re-initialised after ' + S.consecutiveErrors + ' failed scans'); agents.event('remedy', 'warn', 'scan-error', 're-initialised the chain connection', { action: 'reinit', outcome: 'done' }); } catch (e2) { log('auto-fix: re-initialise failed ' + redact(e2.shortMessage || e2.message)); } }
        if (a.interval !== S.interval) { S.interval = a.interval; log(`auto-fix: backing off, next scan in ${S.interval} s`); }
        if (a.alert) await notifier.send({ id: 'scan-errors', title: 'Chronos: scans keep failing', text: `${S.consecutiveErrors} in a row: ${S.error}. Run: chronos assist`, level: 'error' });
      }
      // burst: the next scan starts as soon as this one ends (CHRONOS_BURST_GAP_MS, default 0); errors still back off
      S.scanning = false; S.progress = null; nextScan = Date.now() + (S.consecutiveErrors ? S.interval * 1000 : bursting() ? Math.max(0, Number(envGet('CHRONOS_BURST_GAP_MS') || 0)) : tempo.interval(S.interval) * 1000); // tempo only while scans succeed
    } else if (!S.paused && (bursting() || !((S.fastPausedUntil || 0) > Date.now())) && (S.hot.size || movedPools.size || (feed && S.st)) && (feed && feed.status().up ? blockKick : HOT_MS > 0 && Date.now() >= nextHot) && Date.now() < nextScan - 500) {
      // fast lane: the closest cycles plus every cycle through a pool that just moved, at the newest block
      // (on every new block when a websocket feed is up; otherwise every HOT_SCAN_MS)
      blockKick = false; nextHot = Date.now() + HOT_MS;
      try {
        const deps = await live.snapshot(S.cfg, S.st, bursting() ? fan : undefined);
        deps.routePrior = S.routePrior; // chain signals: winners' route shapes quoted first
        deps.contract = await contractInfo();
        deps.onlyKeys = S.hot;
        // pools that just traded (streamed over websocket): every cycle through them is re-checked now
        if (movedPools.size) { deps.movedMarkets = new Set(S.st.markets.filter((m) => movedPools.has(m.address.toLowerCase())).map((m) => m.id)); movedPools.clear(); }
        const res = await runScan({ ...S.cfg, SCAN_FLIP_TOP: Math.min(S.hot.size, 20) }, deps);
        S.hotRes = { at: Date.now(), block: res.blockNumber, approved: res.approved, best: res.candidates[0] ? res.candidates[0].netUsd : null, ms: res.tookMs };
        if (res.approved) { for (const c of res.candidates) if (c.approved && c.netUsd > 0) sync.enqueue('opportunities', SYNC.MAP.opportunity({ ...c, routeKey: routeKey(c) }, res.blockNumber, Date.now())); await act(res, deps); }
      } catch (e) { log('fast re-check error ' + redact(e.shortMessage || e.message)); }
      try { fs.writeFileSync(path.join(DATA, 'measure_summary.json'), JSON.stringify({ source: 'chronos engine', at: new Date().toISOString(), ...S.session.summary(S.thresholds), edge: S.session.edge() }, null, 2)); } catch (_) { /* optional */ }
    }
    if (Date.now() >= nextResearch) { nextResearch = Date.now() + Math.max(10, Number(envGet('RESEARCH_EVERY_MIN') || 60)) * 60000; researchNow().then((m) => log('research: ' + m), () => {}); }
    // executor readiness, shadow statistics and the automatic shadow ↔ live switch
    if (executor && Date.now() >= nextExecCheck) {
      nextExecCheck = Date.now() + 60000; S.execInfo = await executor.readiness();
      // the phone's key agent is locked (a restart): trading is held; you are told at once and every 3 h until unlocked
      if (S.execInfo && /key agent is not running/.test(S.execInfo.why || '')) notifier.send({ id: 'executor-locked', title: 'Chronos: executor key is locked', text: 'Trading is held (nothing is sent) until you unlock it: open Termux and run chronos executor unlock.', level: 'error', minIntervalMs: 3 * 3600000 }).catch(() => {});
    }
    if (!executor && !S.execInfo) S.execInfo = { ready: false, why: kmsKey ? 'set CHRONOS_FLASH_ARB_ADDRESS (your contract) too' : contract ? 'no executor key yet: chronos executor import (your key, on this phone) or cloud/gcp-setup.sh (Cloud KMS)' : 'no contract address set', address: executorAddress };
    S.shadowStats = MODE.shadowStats(S.shadowRuns.filter((x) => x.at > freshAfter));
    {
      const before = S.mode.mode;
      S.mode = MODE.evaluate({ policy: EP.policy, goMinUsdPerDay: S.thresholds.GO_MIN_USD_PER_DAY, maxDailyDrawdownUsd: S.cfg.MAX_DAILY_DRAWDOWN_USD, exec: S.execInfo, shadow: S.shadowStats, live: executor ? executor.today() : null, prev: S.mode, killed: fs.existsSync(killFile) || !!S.safe || (S.shadowUntil || 0) > Date.now(), gasEth: S.execInfo && S.execInfo.gasEth !== undefined ? S.execInfo.gasEth : null });
      if (before !== S.mode.mode) {
        if (S.mode.mode === 'SHADOW' && executor) { if (/reverts/.test(S.mode.heldWhy || '')) freshAfter = Date.now(); executor.resetReverts(); }
        await notifier.send({ id: 'mode', title: S.mode.mode === 'LIVE' ? 'Chronos is LIVE: sending profitable trades' : 'Chronos back to SHADOW', text: S.mode.mode === 'LIVE' ? 'Shadow wins, win rate and simulated $/day met your rules. Every send is re-simulated first.' : `Stopped sending: ${S.mode.heldWhy || 'a rule failed'}. Shadow keeps running.`, level: S.mode.mode === 'LIVE' ? 'info' : 'error', minIntervalMs: 0 });
        agents.modeChanged(S.mode);
        sync.enqueue('mode_events', { ts: new Date().toISOString(), mode: S.mode.mode, reason: S.mode.mode === 'LIVE' ? 'promotion rules met' : (S.mode.heldWhy || 'a rule failed') });
        await pinStatus(true);
      }
    }
    // balances, shown only when a second independent source agrees
    if (Date.now() >= nextBalances) {
      nextBalances = Date.now() + 300000;
      const acc = [];
      const add = (label, a) => { if (/^0x[0-9a-fA-F]{40}$/.test(a || '') && !acc.some((x) => x.address.toLowerCase() === a.toLowerCase())) acc.push({ label, address: a }); };
      add('executor', S.execInfo && S.execInfo.address); add('contract', contract && contract.address);
      add('payout wallet', envGet('PAYOUT_WALLET_ADDRESS') || (S.record && S.record.payoutWallet)); add('tax reserve (T1)', envGet('TAX_RESERVE_VAULT'));
      const bs = envGet('CHRONOS_BLOCKSCOUT_URL'); const bsUrl = bs === 'off' ? null : bs && /^https:\/\//.test(bs) ? bs : 'https://arbitrum.blockscout.com';
      if (acc.length) {
        try { S.balances = await BAL.verifiedBalances({ primary: S.st.provider, secondary: secondProvider, blockscoutUrl: secondProvider ? null : bsUrl, accounts: acc, tokens: S.st.assets.filter((a) => a.flashEnabled && a.decimals !== null).map((a) => ({ address: a.address, symbol: a.symbol, decimals: a.decimals })) });
          if (S.balances && S.balances.block) for (const row of SYNC.MAP.balances(S.balances, S.balances.block, Date.now())) sync.enqueue('balances_verified', row); }
        catch (e) { S.balances = { at: new Date().toISOString(), why: 'balances unavailable: ' + redact(e.shortMessage || e.message), rows: [] }; }
      }
    }
    if (Date.now() >= nextNodes) { nextNodes = Date.now() + 120000; sys.probeNodes(envFile).then((x) => { S.nodes = x; }).catch(() => {}); }
    if (Date.now() >= nextRealized) {
      nextRealized = Date.now() + 600000;
      try {
        S.record = readRecord(live.workspaceDir(envFile));
        S.realized = await RZ.verifyRealized({ provider: S.st.provider, contract: contract && contract.address, hashes: RZ.candidateHashes(S.record, DATA), assets: S.st.assets, wethAddress: live.WETH, taxBps: S.thresholds.taxBps, tradeHashes: RZ.tradeHashes(DATA) });
        // trades that had no receipt in time are settled now: a late revert still counts against every cap
        if (executor) for (const [h, rc] of Object.entries(S.realized.receipts || {})) if (executor.settle(h, rc)) log(`settled ${h.slice(0, 10)}…: ${rc.status}${rc.status === 'reverted' ? ` (gas $${(rc.gasUsd || 0).toFixed(4)} counted as a loss)` : ''}`);
        if (sync.enabled) {
          const meta = new Map();
          try { for (const l of fs.readFileSync(path.join(DATA, 'executions.jsonl'), 'utf8').split('\n').filter(Boolean)) { const j = JSON.parse(l); meta.set(String(j.txHash).toLowerCase(), { at: j.at, route: j.route }); } } catch (_) { /* none yet */ }
          for (const x of S.realized.executions) sync.enqueue('executions', SYNC.MAP.execution({ ...x, taxUsd: Number.isFinite(x.netUsd) && Number.isFinite(S.thresholds.taxBps) ? Math.max(0, x.netUsd) * S.thresholds.taxBps / 10000 : null }, Date.now(), meta.get(String(x.txHash).toLowerCase())));
        }
      } catch (e) { log('realized check failed ' + redact(e.message)); }
    }
    // every policy, not only the failing ones: the VP's success pass reports the profit policies that hold
    try { S.policies = pol.evaluatePolicies({ envFile, cfg: S.cfg, record: S.record, lastRes: S.res, integrity: S.integrity, realized: S.realized }); S.policyFails = S.policies.filter((p) => ['FAIL', 'BLOCKING'].includes(p.status)); } catch (_) { /* reported via other checks */ }
    S.problems = HEALTH.problems(S);
    // problems only the engine can see: all websocket feeds down for a minute; portal rows piling up
    const fs0 = feed ? feed.status() : null;
    if (fs0 && fs0.feeds && !fs0.up) { feedDownSince = feedDownSince || Date.now(); } else feedDownSince = 0;
    const extra = [...(feedDownSince && Date.now() - feedDownSince > 60000 ? [{ id: 'feed-down', msg: `all ${fs0.feeds} websocket feed(s) down for ${Math.round((Date.now() - feedDownSince) / 1000)} s` }] : []), ...(sync.pending() > 200 ? [{ id: 'sync-backlog', msg: `${sync.pending()} portal rows queued` }] : [])];
    if (Date.now() >= nextCompany) {
      nextCompany = Date.now() + 30000;
      try {
        const co = await company.tick({ res: S.res, lastScanAt: S.lastScanAt, interval: S.interval, scanError: S.error, mode: S.mode && S.mode.mode, heldWhy: S.mode && S.mode.heldWhy, policyFails: S.policyFails, safe: S.safe, killed: fs.existsSync(killFile), today: executor ? executor.today() : null, execInfo: S.execInfo, minGasEth: EP.policy.EXEC_MIN_GAS_ETH, policy: EP.policy, realized: S.realized, incidents: S.resolver, feed: S.feedStatus, sync: sync.status ? sync.status() : {}, research: (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'research.json'), 'utf8')); } catch (_) { return null; } })(), realcheck: (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'live', 'realcheck.json'), 'utf8')); } catch (_) { return null; } })(), integrity: S.integrity, stateTampered: S.stateTampered, shadowWins: S.shadowStats ? S.shadowStats.wins : 0, insights: S.insights || null, contractInfo: S.contractInfo || null, policies: S.policies || [], cfg: S.cfg || null, mirror: S.mirror || null, mirrorFired: S.mirrorFired || [], audit: S.audit || null, lastQuotes: S.lastQuotes || null, gas: S.gas || null, chainSignals: S.chainSignals || null, env: envGet });
        S.mirrorFired = []; // counted by the VP's ledger once
        S.road = co.road ? co.road.list : S.road;
        if (co.indicators) { const { rows, ...summary } = co.indicators; S.indicators = summary; S.indicatorRows = rows; } // every row for the dashboard; the summary for the portal
        if (co.direction) S.direction = co.direction;
        if (co.team) S.team = co.team.reports;
        S.company = { ...company.status(), departments: Object.fromEntries(Object.entries(co.reports).map(([k, v]) => [k, v.status])) };
      } catch (e) { baseLog('company error ' + redact(e.message)); }
    }
    try { S.incidents = (await resolver.tick([...S.problems, ...extra])) || S.incidents; S.resolver = resolver.summary(); } catch (e) { baseLog('resolver error ' + redact(e.message)); }
    const r = HEALTH.logNew(DATA, S.problems, S.healthSeen); S.healthSeen = r.seen;
    await agents.observe({ fresh: r.fresh, resolved: r.resolved, problems: S.problems });
    if (executor && S.mode.mode === 'LIVE') agents.tune({ policy: EP.policy, today: executor.today() });
    await agents.pollDecisions();
    if (!agents.wantRestart) agents.checkStall(S);
    if (agents.wantRestart) { log('agent restart: ' + agents.wantRestart); break; }
    for (const p of r.fresh) if (!p.profit) await notifier.send({ id: 'p:' + p.id, title: 'Chronos problem', text: p.msg, level: 'error' });
    for (const id of r.resolved) if (!id.startsWith('profit-stage')) await notifier.send({ id: 'r:' + id, title: 'Chronos: resolved', text: id, minIntervalMs: 60000 });
    const verdict = S.session.summary(S.thresholds).verdict;
    if (lastVerdict && verdict !== lastVerdict) await notifier.send({ id: 'verdict', title: `Measurement verdict: ${verdict}`, text: verdict === 'GO TO SHADOW TEST' ? 'Opportunities met your GO thresholds. Next step: a shadow test, not live capital.' : 'The verdict changed.', minIntervalMs: 0 });
    lastVerdict = verdict;
    const pr = PROFIT.evaluate(S); S.profit = { current: pr.current, profiting: pr.profiting };
    const stageNow = pr.current ? pr.current.n : 8;
    if (S.lastStage && stageNow !== S.lastStage) await notifier.send({ id: 'stage', title: stageNow > S.lastStage ? `Path to profit: stage ${Math.min(stageNow, 7)} of 7 reached` : `Path to profit: back to stage ${stageNow} of 7`, text: pr.current ? `${pr.current.name} · next: ${pr.current.next}` : 'Verified on-chain profit.', level: stageNow < S.lastStage ? 'error' : 'info', minIntervalMs: 0 });
    if (refresh || stageNow !== S.lastStage) await pinStatus(pauseChanged); // a pause or resume shows at once
    S.lastStage = stageNow;
    if (pr.profiting && !S.profitAnnounced) { S.profitAnnounced = true; await notifier.send({ id: 'profit', title: 'Verified on-chain profit', text: `$${S.realized.totalNetUsd.toFixed(2)} net after gas across ${S.realized.executions.length} execution(s)`, minIntervalMs: 0 }); }
    if (Date.now() >= nextUpdate) {
      nextUpdate = Date.now() + (envGet('CHRONOS_AUTO_UPDATE') === 'off' ? 6 : 1) * 3600000; // hourly when updates install themselves
      const DV = require('./device.cjs');
      if (process.env.TERMUX_VERSION) { // a newer archive saved into Downloads: one tap installs it
        try {
          const nd = require('./autoupdate.cjs').newerDownload({ home: require('os').homedir(), current: require('../package.json').version, cmp: DV.cmp, versionOf: DV.archiveVersion });
          if (nd) await notifier.send({ id: 'download:' + nd.version, title: `Chronos v${nd.version} is in your Downloads`, text: `Tap Install: its seal is checked, it is installed with your settings kept and published for your other devices.`, minIntervalMs: 0, buttons: [{ label: 'Install', action: 'chronos update' }] });
        } catch (_) { /* Downloads not readable: termux-setup-storage */ }
      }
      if (fs.existsSync(DV.KEYFILE)) DV.latest(require('../package.json').version).then(async (l) => {
        const mine = require('../package.json').version;
        S.update = l && DV.cmp(l.version, mine) > 0 ? { version: l.version, notes: l.notes || '' } : null;
        if (!S.update) return;
        const how = require('./autoupdate.cjs').decide({ env: envGet, termux: !!process.env.TERMUX_VERSION, busy: !!(executor && executor.inFlight), lastTried: S.autoUpdateTried, version: l.version });
        if (how.install) {
          S.autoUpdateTried = l.version;
          await notifier.send({ id: 'update:' + l.version, title: `Updating Chronos to v${l.version}`, text: `from v${mine}: verified, installed with your settings kept, engine restarts by itself${l.notes ? ' · ' + l.notes : ''}`, minIntervalMs: 0 });
          agents.event('updater', 'info', 'auto-update', `installing v${l.version} (from v${mine})`, { action: 'install', outcome: 'started' });
          require('./autoupdate.cjs').install({ root: path.join(__dirname, '..'), dataDir: DATA });
        } else await notifier.send({ id: 'update:' + l.version, title: `Chronos v${l.version} is available`, text: `You have v${mine}. ${how.why}. Install it: chronos update${l.notes ? ' · ' + l.notes : ''}`, minIntervalMs: 0 });
      }).catch(() => { /* not approved yet, or offline: checked again in 6 h */ });
    }
    if (sync.enabled) {
      if (Date.now() >= nextBeat) { nextBeat = Date.now() + 30000; sync.enqueue('heartbeats', { service: 'chronos-engine@' + DV.engineName(), ts: new Date().toISOString(), mode: S.mode.mode, version: require('../package.json').version, detail: { role: S.role, acting: S.acting, paused: !!S.paused, lastScanAt: S.lastScanAt ? new Date(S.lastScanAt).toISOString() : null, error: S.error || null, problems: (S.problems || []).length, syncPending: sync.pending(), ...portalDetail(S, live.DATA) } }); }
      if (relayPub) relayPub.tick();
      await sync.flush();
      S.syncStatus = sync.status ? sync.status() : null;
    }
    if (scans >= maxScans) break;
    await sleep(250);
  }
  if (feed) feed.stop();
  if (agents.wantRestart) { await sync.flush(Date.now() + 1e9); S.phase = 'restarting'; publish(); return finish(EXIT_RESTART); }
  S.phase = 'stopped'; publish(); log('stopped');
  await unpinStatus('stopped on request · start it again: chronos service start');
  return finish(0);
}
module.exports = { portalDetail, runDaemon, EXIT_SETUP, EXIT_RESTART, DATA, nodeEntries, choosePrimary, governInterval };
