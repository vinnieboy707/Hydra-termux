#!/usr/bin/env node
'use strict';
// chronos — one command for the whole console.
const path = require('path');
const ROOT = path.join(__dirname, '..');
const [cmd = 'console', ...rest] = process.argv.slice(2);
const run = (file, args = []) => { process.argv = [process.argv[0], path.join(ROOT, file), ...args]; require(path.join(ROOT, file)); };

const HELP = `
  ◆ CHRONOS — flash-loan arbitrage engine for Arbitrum One (shadow test first; live only when your rules are met)

  chronos               open the live dashboard
  chronos autopilot     do everything that does not need you, then list what does
  chronos setup         import keys from this phone, paste missing ones, settings, action checklist
  chronos set KEY       change one setting or key (checked; secrets are typed hidden)
  chronos release-check run the release gate (docs, syntax, settings, contract, server deployed, counterparts, planted bugs, tests)
  chronos role R        this device's role: primary (your laptop: does the heavy work, the only sender) or standby
  chronos vault set N   save resend_api_key or alert_email in your Supabase Vault, typed hidden (for alert emails)
  chronos ask "…"       ask the VP's analyst (docs, logs, mind-state, Blockscout, allowlisted web; read-only)
  chronos archive       the VP's documentation archive: search <words> · sync (copies your Drive documents, never secrets)
  chronos nodes         every node and websocket: provider, plan limits (from their docs), its turn in the scans (alias: providers)
  chronos deploy        deploy your ChronosFlashArb and set it up (asks YES before each send; --plan shows costs only; --v2 deploys contract v2: Balancer loans and direct pool swaps)
  chronos payout        move your contract's confirmed profit: T1 reserve to TAX_RESERVE_VAULT, rest to PAYOUT_WALLET_ADDRESS
  chronos research [h]  what flash-loan arbitrage actually landed on Arbitrum in the last h hours (default 2): contracts, legs, venues, gas, kept
  chronos service …     background engine: install | status | start | stop | restart | logs | uninstall
  chronos cloud-pack    write chronos-settings.env (your settings, no secrets) for the Google Cloud engine
  chronos keys          every wallet address and key in one sitting, in order (websocket derived from your node when it can be)
  chronos keys export   seal every setting and your owner keystore into chronos-keys.enc (passphrase) for another device
  chronos keys import   restore them on a new phone or computer from chronos-keys.enc
  chronos owner save    keep your owner private key encrypted here: deploy and payouts then ask only its passphrase
  chronos progress      the road to cash: each milestone, verified from the chain, receipts and your checks
  chronos executor      save the HSM executor your cloud engine offered (address + KMS key name; nothing to copy)
  chronos tune small-trades | undo   smaller trade sizes ($25 up) and a gas-based floor ($0.05, 1.5× gas): shows before → after, asks YES
  chronos liquidations [days] [--arbitrum|--base]   read-only: every Aave liquidation on Arbitrum and Base, what winners kept, the auction's share, build or not (Etherscan key)
  chronos narrate       the engine explains what it is doing, out loud, live (space pause/resume · n next · r repeat · q quit; your place is kept) · --voices · --from-start
  chronos executor import | unlock | lock | status   your own operator key signs trades on this phone (encrypted keystore + key agent)
  chronos update        get the newest private release for this device, install it, deploy, open the dashboard
  chronos publish [F]   publish a release (newest chronos-console*.tgz in Downloads) to your approved devices
  chronos device        this device's approval status and pairing code
  chronos scan          one scan, printed as text (sends nothing)
  chronos measure       timed measurement run with GO / NO-GO (sends nothing)
  chronos audit         check src/registry.ts pools on-chain
  chronos gas 0xTX…     measured gas from your real transactions
  chronos doctor        check settings, policies, nodes and services
  chronos assist [Q]    help agent: finds every problem, says what is fixed automatically and what needs you; answers Q (--fix: run the safe fixes, each verified)
  chronos test          run the test suite
  chronos phone         keep the engine running on this phone: starts it, restarts it whenever Termux opens, wake lock, boot start, battery setting, checks it reaches your portal
  chronos mainnet       every remaining step to trade on Arbitrum One, in order (settings, real checks, contract v2, executor); safe to run again
  chronos verify-real   run every test stand-in's real counterpart: your RPC, Multicall3, Aave, venues, a real quote, websocket feed, deployed contract, contract v2 against the real protocols (one eth_call), KMS, release service, phone notification, webhook, AI agent. Sends nothing on chain
  chronos docs          regenerate the reference sections of the docs from the code (--check: report stale docs)
  chronos verify        check the code against its integrity seal
  chronos unlock        make the code editable (for a deliberate change)
  chronos lock          make the code read-only again (chronos seal also does this)
  chronos seal          record the current code as trusted and lock it again
  chronos help          this text

  Sends happen only in three places: the engine in LIVE mode (signed by your Google Cloud HSM key), and chronos deploy
  and chronos payout (signed by your owner key, after you type YES).
`;

(async () => {
  switch (cmd) {
    case 'console': case 'ui': case 'dash': return require(path.join(ROOT, 'tui', 'app.cjs')).main();
    case 'setup': { const ctx = await require('../tui/setup.cjs').runSetup(); if (ctx.summary.length) { console.log('◆ Came online during this setup:'); for (const n of ctx.summary) console.log('  ✓ ' + n); } console.log('Next: chronos'); process.exit(0); }
    case 'scan': return run('scan.cjs', rest);
    case 'measure': return run('measure.cjs', rest);
    case 'audit': return run('registry_audit.cjs', rest);
    case 'gas': return run('calibrate_gas.cjs', rest);
    case 'test': {
      try { require.resolve('ganache', { paths: [ROOT] }); require.resolve('solc', { paths: [ROOT] }); } catch (_) {
        console.log('The tests need the test tools (ganache, solc: about 100 MB, not installed on purpose).\nRun:  chronos unlock && npm ci && chronos test && chronos seal --yes');
        process.exit(2);
      }
      const r = require('child_process').spawnSync(process.execPath, ['--require', './test/isolate.cjs', '--test', '--test-timeout=600000', 'test/wiring.test.cjs', 'test/engine.test.cjs', 'test/chain.test.cjs', 'test/realcheck.test.cjs', 'test/v2engine.test.cjs', 'test/mainnet.test.cjs', 'test/autoupdate.test.cjs', 'test/phone.test.cjs', 'test/envkeys.test.cjs', 'test/server.test.cjs', 'test/visuals.test.cjs', 'test/alerts.test.cjs', 'test/handoff.test.cjs', 'test/insights.test.cjs', 'test/milestones.test.cjs', 'test/success.test.cjs', 'test/mirror.test.cjs', 'test/indicators.test.cjs', 'test/keys.test.cjs', 'test/keystore.test.cjs', 'test/keyagent.test.cjs', 'test/emailreport.test.cjs', 'test/drivepull.test.cjs', 'test/dataapis.test.cjs', 'test/witness.test.cjs', 'test/narrate.test.cjs', 'test/liquidations.test.cjs', 'test/tune.test.cjs', 'test/fan.test.cjs', 'test/providers.test.cjs', 'test/vpaudit.test.cjs', 'test/vpbrain.test.cjs', 'test/team.test.cjs', 'test/tempo.test.cjs', 'test/gas.test.cjs', 'test/chainsignals.test.cjs', 'test/relay.test.cjs', 'test/settingswatch.test.cjs', 'test/roles.test.cjs', 'test/spend.test.cjs', 'test/watchdog.test.cjs', 'test/walletbridge.test.cjs', 'test/releasegate.test.cjs', 'test/cycles.test.cjs', 'test/blockfeed.test.cjs', 'test/research.test.cjs', 'test/docs.test.cjs', 'test/assist.test.cjs', 'test/resolver.test.cjs', 'test/company.test.cjs', 'test/batch.test.cjs', 'test/realized.test.cjs', 'test/execution.test.cjs', 'test/sync.test.cjs', 'test/agents.test.cjs', 'test/deploy.test.cjs', 'test/payout.test.cjs', 'test/device.test.cjs', 'test/console.test.cjs', 'test/setup.test.cjs', 'test/engine-service.test.cjs', 'test/autopilot.test.cjs'], { cwd: ROOT, stdio: 'inherit' });
      process.exit(r.status);
    }
    case 'sync-key': { console.log('Not needed any more: the engine signs portal data with this device\'s approved key. Nothing to copy. Status: chronos device'); return; }
    case 'set': return setCmd(rest[0], rest[1]);
    case 'release-check': {
      // the release gate: every check, none skipped (package.sh refuses to build when any fails)
      const G = require('../lib/releasegate.cjs');
      if (rest[0] === '--record-deployed') { const f = G.recordDeployed(); console.log(`✓ recorded what is deployed: schema + ${Object.keys(f.functions).length} functions (server/DEPLOYED.json)`); return; }
      console.log('◆ release gate: every check must pass before this version can be packaged');
      const r = G.check({ only: rest.length ? rest : null, log: (l) => console.log('  ' + l) });
      console.log(r.ok ? '✓ release gate passed' : `✗ release gate: ${r.results.filter((x) => !x.ok).length} check(s) failed; nothing can be packaged until each is fixed`);
      process.exit(r.ok ? 0 : 1);
    }
    case 'role': {
      // chronos role [primary | standby]: this device's role (kept in ~/.chronos/role, never synced)
      const RO = require('../lib/roles.cjs');
      if (rest[0]) { try { RO.write(rest[0]); } catch (e) { console.log('usage: chronos role primary | standby'); process.exit(2); } }
      const r = RO.read();
      console.log(`this device: ${r}${rest[0] ? ' (set)' : ''} · ${r === 'primary' ? 'full scanning, the VP and its AI brain, research, and the only device that sends' : 'warm backup: scans every 4th interval, no AI calls, no research, never sends; takes over if the primary is silent for 10 minutes'}`);
      if (rest[0]) { const SV = require('../lib/service.cjs'); const x = SV.restartSoon(); if (x === 'requested') console.log('  the engine restarts with its new role'); }
      return;
    }
    case 'vault': {
      // chronos vault set resend_api_key | alert_email: into your Supabase Vault from this approved device, typed hidden
      const name = rest[1];
      if (rest[0] !== 'set' || !['resend_api_key', 'alert_email'].includes(name)) { console.log('usage: chronos vault set resend_api_key | alert_email'); process.exit(2); }
      if (!process.stdin.isTTY) { console.log('chronos vault asks at a hidden prompt: run it in a terminal.'); process.exit(2); }
      const P = require('../tui/prompt.cjs');
      const v = name === 'alert_email' ? await P.input('Email for alerts') : await P.secret('Resend API key (re_…)', 'hidden · paste or type · enter to save · esc to cancel');
      if (!v) { console.log('nothing saved'); process.exit(1); }
      try { const j = await require('../lib/sync.cjs').createSync({}).call('vault', { name, secret: v }); console.log(`✓ saved in your Supabase Vault: ${j.name} (alerts by email use it from now on)`); }
      catch (e) { console.log('✗ ' + e.message); process.exit(1); }
      return;
    }
    case 'ask': { // the VP's analyst from your terminal: read-only tools (docs, log, mind, Blockscout, allowlisted web)
      const q = rest.filter((x) => !x.startsWith('--')).join(' ').trim(); if (!q) { console.log('usage: chronos ask "your question"'); process.exit(2); }
      const live = require('../lib/live.cjs'); const f = live.findEnvFile(); const env = f ? require('../lib/config.cjs').parseEnvFile(f) : {};
      const get = (k) => (process.env[k] !== undefined ? process.env[k] : env[k]); const LLM = require('../lib/llm.cjs');
      const m = await require('../lib/agentmodel.cjs').resolve(get, live.DATA).catch(() => null);
      const brain = new LLM.Brain({ get, orModel: m && m.model }); if (!brain.ready) { console.log('No AI key set: chronos set OPENROUTER_API_KEY (or _2…_5, or ANTHROPIC_API_KEY)'); process.exit(2); }
      const BS = require('../lib/blockscout.cjs'); const base = BS.baseUrl(get);
      const fs = require('fs'); let lines = [];
      for (const n of ['engine.err.log', 'engine.out.log']) { try { lines.push(...fs.readFileSync(path.join(live.DATA, 'logs', n), 'utf8').split('\n').slice(-100)); } catch (_) { /* no log */ } }
      const audit = (() => { try { return JSON.parse(fs.readFileSync(path.join(live.DATA, 'audit.json'), 'utf8')); } catch (_) { return null; } })();
      const a = require('../lib/vpagent.cjs').createAnalyst({ brain, archive: require('../lib/knowledge.cjs').archive(get, { workspace: f ? live.workspaceDir(f) : null }), mind: new (require('../lib/mind.cjs').Mind)({ dataDir: live.DATA }), logTail: () => lines, lastAudit: () => audit, bs: base ? new BS.Blockscout(base) : null,
        checks: [], runCheck: async () => null, actions: [], act: async () => 'not from the terminal', propose: () => 'proposals come from the engine\'s VP, not the terminal' });
      console.log('◆ asking the analyst (docs, log, mind-state, Blockscout, allowlisted web; read-only)…');
      const r = await a(q);
      if (!r.answer) { console.log('no answer: ' + (r.why || 'unknown')); process.exit(1); }
      console.log(`\nCAUSE: ${r.answer.cause}\n${r.answer.evidence.map((e) => '  evidence: ' + e).join('\n')}\n${r.answer.next.map((n, i) => `NEXT ${i + 1} (${n.owner === 'you' ? 'yours' : 'Chronos'}): ${n.step}${n.profitEffect ? ' · profit: ' + n.profitEffect : ''}`).join('\n')}\nconfidence ${r.answer.confidence} · via ${r.via} · tools ${r.used.join(', ') || 'none'}`);
      return;
    }
    case 'archive': { // the VP's documentation archive: search it, or copy your Drive documents into it
      const live = require('../lib/live.cjs'); const f = live.findEnvFile(); const env = f ? require('../lib/config.cjs').parseEnvFile(f) : {}; const get = (k) => (process.env[k] !== undefined ? process.env[k] : env[k]);
      if (rest[0] === 'sync') { const r = await require('../lib/drivepull.cjs').pullArchive(); console.log(r.skipped ? r.why : `${r.files.length} Drive document(s) in ${r.dir}${r.why ? ' · ' + r.why : ''} (env, secret, password, wallet and key files are never copied)`); }
      const K = require('../lib/knowledge.cjs'); const a = K.archive(get, { workspace: f ? live.workspaceDir(f) : null });
      const q = rest.filter((x) => x !== 'sync' && x !== 'search').join(' ').trim();
      if (q) for (const r of a.search(q, 5)) console.log(`\n${r.file} § ${r.heading} (score ${r.score.toFixed(1)})\n${r.text.slice(0, 400)}`);
      else console.log(`archive: ${a.size} sections (Chronos docs, references, your workspace, ~/.chronos/archive, MCP configs) · chronos archive search <words> · chronos archive sync (Drive)`);
      return;
    }
    case 'nodes': case 'providers': { // each node's provider, plan and limits (from the providers' docs), and its role
      const live = require('../lib/live.cjs'); const f = live.findEnvFile(); const env = f ? require('../lib/config.cjs').parseEnvFile(f) : {};
      const get = (k) => (process.env[k] !== undefined ? process.env[k] : env[k]); const PR = require('../lib/providers.cjs');
      const http = PR.nodeEntries(get); const wss = require('../lib/blockfeed.cjs').WSS_KEYS.map((key) => ({ key, url: get(key) })).filter((e) => /^wss:\/\//.test(e.url || ''));
      const per = Number(rest.find((x) => /^\d+$/.test(x))) || 236;
      console.log(`◆ chronos nodes — what each provider's plan allows (their docs; sources: docs/PROVIDERS.md)\n`);
      for (const l of PR.lines([...http, ...wss], get, per)) console.log('  ' + l);
      const ranked = PR.rankForScanning(http, get);
      if (ranked.length) console.log(`\n  scanning node: ${get('CHRONOS_PRIMARY_NODE') || ranked[0].key} · backups (failover, balance checks, second broadcast): ${ranked.slice(1).map((x) => x.key).join(', ') || 'none: add ARB_RPC_URL_2 from another provider'}`);
      console.log(`  plans are read from INFURA_PLAN / SWIFTNODES_PLAN (default free): chronos set INFURA_PLAN developer`);
      return;
    }
    case 'keys': {
      if (!process.stdin.isTTY) { console.log('chronos keys asks for each key at a hidden prompt: run it in a terminal.'); process.exit(2); }
      const KY = require('../tui/keys.cjs'); const live = require('../lib/live.cjs'); const P = require('../tui/prompt.cjs'); const os = require('os');
      const dl = require('fs').existsSync('/sdcard/Download') ? '/sdcard/Download' : path.join(os.homedir(), 'Downloads');
      const base = { envFile: live.findEnvFile() || live.defaultEnvFile(), dataDir: live.DATA, P, log: (s) => console.log(s) };
      if (rest[0] === 'export') process.exit(await KY.exportBundle({ ...base, out: rest[1] || path.join(dl, 'chronos-keys.enc') }));
      if (rest[0] === 'import') {
        const C = require('../lib/catalog.cjs');
        process.exit(await KY.importBundle({ ...base, file: rest[1] || path.join(dl, 'chronos-keys.enc'), test: async (k, v) => { const s = C.SECRETS.find((x) => x.key === k); return s ? s.test(v) : null; } }));
      }
      const r = await KY.runKeys(KY.realDeps()); process.exit(r.missing.length ? 1 : 0);
    }
    case 'owner': {
      if (!process.stdin.isTTY) { console.log('chronos owner asks at a hidden prompt: run it in a terminal.'); process.exit(2); }
      process.exit(await require('../tui/keys.cjs').ownerCmd({ sub: rest[0], dataDir: require('../lib/live.cjs').DATA, P: require('../tui/prompt.cjs'), log: (s) => console.log(s) }));
    }
    case 'progress': {
      let st = null; try { st = JSON.parse(require('fs').readFileSync(path.join(require('../lib/live.cjs').DATA, 'live', 'state.json'), 'utf8')); } catch (_) { /* no engine yet */ }
      if (!st || !Array.isArray(st.road)) { console.log('The engine has not checked the road to cash yet: start it (chronos phone) and run chronos progress in a minute.'); process.exit(1); }
      console.log(require('../lib/milestones.cjs').lines(st.road).join('\n'));
      { const M = require('../lib/milestones.cjs'); const net = st.realized && Number.isFinite(st.realized.totalNetUsd) ? st.realized.totalNetUsd : 0; const sl = M.stepsLeft(st.road, net);
        console.log('\n' + M.ladderLines(net).join('\n') + `\n\nFrom today to $100,000: ${sl.done} of ${sl.total} steps done, ${sl.left} left.`); }
      console.log(`\n(checked ${st.heartbeat ? new Date(st.heartbeat).toLocaleString() : 'by the running engine'}; reminders for your steps every ${process.env.CHRONOS_VP_NUDGE_HOURS || 3} h outside quiet hours)`);
      process.exit(0);
    }
    case 'tune': {
      if (rest[0] === 'small-trades' && !process.stdin.isTTY) { console.log('chronos tune small-trades asks for YES: run it in a terminal.'); process.exit(2); }
      const live = require('../lib/live.cjs'); const envFile = live.findEnvFile(); const E = require('../lib/envfile.cjs');
      const get = (k) => (envFile ? require('../lib/config.cjs').parseEnvFile(envFile)[k] : undefined);
      process.exit(await require('../tui/tune.cjs').run({ sub: rest[0], get, dataDir: live.DATA, P: require('../tui/prompt.cjs'), log: (x) => console.log(x),
        setEnv: (k, v) => { if (!envFile) return; const d = E.load(envFile); if (v === '' && typeof E.unset === 'function') E.unset(d, k); else E.set(d, k, v); E.save(d); } }));
    }
    case 'liquidations': {
      const live = require('../lib/live.cjs'); const envFile = live.findEnvFile();
      const get = (k) => (process.env[k] !== undefined ? process.env[k] : envFile ? require('../lib/config.cjs').parseEnvFile(envFile)[k] : undefined);
      try { process.exit(await require('../tui/liquidations.cjs').main({ args: rest, get, dataDir: live.DATA })); } catch (e) { console.log('✗ ' + require('../lib/safety.cjs').redact(e.message) + ' (read-only: nothing was sent)'); process.exit(1); }
    }
    case 'narrate': {
      // the engine's live commentary, read aloud (lib/narrate.cjs, lib/voice.cjs)
      const live = require('../lib/live.cjs'); const envFile = live.findEnvFile();
      const get = (k) => (process.env[k] !== undefined ? process.env[k] : envFile ? require('../lib/config.cjs').parseEnvFile(envFile)[k] : undefined);
      if (rest[0] === '--voices') { const e = require('../lib/voice.cjs').engines(); const b = require('../lib/voice.cjs').backend(get); console.log(b ? `speaking with: ${b.name}` : 'no speech engine found (phone: Termux:API app + pkg install termux-api)'); if (e) for (const x of e) console.log(`  ${x.name}${x.default ? '  (default)' : ''}  ${x.label || ''}  → chronos set CHRONOS_VOICE_ENGINE ${x.name}`); process.exit(0); }
      if (rest[0] === '--from-start') require('../lib/narrate.cjs').writeCursor(live.DATA, 0);
      process.exit(await require('../tui/narrate.cjs').run({ dataDir: live.DATA, get }));
    }
    case 'executor': {
      if (!['import', 'unlock', 'lock', 'status'].includes(rest[0])) process.exit(await require('../lib/handoff.cjs').run({ envFile: require('../lib/live.cjs').findEnvFile(), executors: () => require('../lib/device.cjs').executors() }));
      if (['import', 'unlock'].includes(rest[0]) && !process.stdin.isTTY) { console.log(`chronos executor ${rest[0]} asks at a hidden prompt: run it in a terminal.`); process.exit(2); }
      const live = require('../lib/live.cjs'); const envFile = live.findEnvFile(); const E = require('../lib/envfile.cjs');
      const get = (k) => (process.env[k] !== undefined ? process.env[k] : envFile ? require('../lib/config.cjs').parseEnvFile(envFile)[k] : undefined);
      const contractOwner = async () => { const { ethers } = require('ethers'); const a = get('CHRONOS_FLASH_ARB_ADDRESS'); if (!ethers.isAddress(a || '')) return null; const p = await require('../lib/chain.cjs').connect(require('../lib/config.cjs').loadConfig(envFile)); return new ethers.Contract(a, ['function owner() view returns (address)'], p).owner(); };
      process.exit(await require('../tui/executorkey.cjs').run({ sub: rest[0], dataDir: live.DATA, envFile, get, P: require('../tui/prompt.cjs'), log: (x) => console.log(x), contractOwner,
        setEnv: (k, v) => { if (!envFile) return; const d = E.load(envFile); E.set(d, k, v); E.save(d); },
        verify: () => require('../lib/realcheck.cjs').verifyReal({ envFile, dataDir: live.DATA, only: ['executor-agent'] }) }));
    }
    case 'payout': { if (rest.includes('--metamask')) process.env.CHRONOS_OWNER_SIGNER = 'metamask'; const live = require('../lib/live.cjs'); const f = live.findEnvFile(); const get = (k) => (process.env[k] !== undefined ? process.env[k] : f ? require('../lib/config.cjs').parseEnvFile(f)[k] : undefined);
      const sync = require('../lib/sync.cjs').createSync({ url: get('CHRONOS_SYNC_URL'), dataDir: live.DATA });
      let code; try { code = await require('../tui/payout.cjs').runPayout({ planOnly: rest.includes('--plan'), sync }); } catch (e) { if (sync.enabled) await sync.flush().catch(() => {}); // confirmed transfers still reach the portal
        console.log('\n✗ ' + require('../lib/safety.cjs').redact(e.message || String(e)) + '\nStopped. data/payouts.jsonl shows anything already sent; run chronos payout again to finish.'); code = 1; } process.exit(code); }
    case 'assist': case 'help-me': { const q = rest.filter((x) => !x.startsWith('--')).join(' '); let code; try { code = await require('../tui/assist.cjs').runAssist({ question: q, doFix: rest.includes('--fix') }); } catch (e) { console.log('\n✗ ' + require('../lib/safety.cjs').redact(e.message) + ' (read-only: nothing was changed)'); code = 1; } process.exit(code); }
    case 'phone': {
      const P = require('../tui/prompt.cjs'); const PH = require('../lib/phone.cjs');
      console.log('\n◆ CHRONOS phone — keeping the engine running on this phone\n');
      const tty = !!process.stdin.isTTY;
      const checks = await PH.checkPhone(PH.realDeps({ ask: (q) => (tty ? P.confirm(q, true) : false) }));
      const left = checks.filter((c) => !c.ok);
      console.log(left.length ? `\n${left.length} thing(s) only you can do, listed above with !.` : '\nEverything that keeps the engine running is in place.');
      process.exit(left.some((c) => c.name === 'engine running' || c.name === 'engine supervisor (PM2)') ? 1 : 0);
    }
    case 'mainnet': {
      if (rest.includes('--metamask')) process.env.CHRONOS_OWNER_SIGNER = 'metamask'; // every owner step (deploy, setup) is approved in MetaMask
      if (!process.stdin.isTTY) { console.log('chronos mainnet asks you questions and for YES before sending: run it in Termux.'); process.exit(2); }
      const M = require('../tui/mainnet.cjs'); let r;
      try { r = await M.runMainnet(M.realDeps()); } catch (e) { console.log('\n✗ ' + require('../lib/safety.cjs').redact(e.message) + ' (nothing further was sent; run chronos mainnet again)'); process.exit(1); }
      process.exit(r.left.length ? 1 : 0);
    }
    case 'verify-real': {
      const live = require('../lib/live.cjs'); const envFile = live.findEnvFile();
      const mark = { pass: '✓', fail: '✗', 'not run': '·' };
      console.log('\n◆ CHRONOS verify-real — each test stand-in checked against the real system it stands in for\n');
      let r;
      try { r = await require('../lib/realcheck.cjs').verifyReal({ envFile, dataDir: live.DATA, log: (x) => console.log(`  ${mark[x.status]} ${x.title}\n      ${x.detail}`) }); }
      catch (e) { console.log('\n✗ ' + require('../lib/safety.cjs').redact(e.message) + ' (nothing was sent)'); process.exit(1); }
      if (r.v2) { console.log('\n  contract v2 against the real protocols:'); for (const c of r.v2) console.log(`    ${c.ok ? '✓' : '✗'} ${c.name} [${c.values.join(', ')}]${c.err ? ' ' + c.err : ''}`); console.log('    (the profit checks make their own price gap inside the call: they prove the machinery, not a market opportunity)'); }
      const n = (s) => r.results.filter((x) => x.status === s).length;
      console.log(`\n  ${n('pass')} pass · ${n('fail')} fail · ${n('not run')} not run (not run is never counted as a pass)\n`);
      process.exit(n('fail') ? 1 : 0);
    }
    case 'docs': { const D = require('../lib/docs.cjs'); if (rest.includes('--check')) { const p = D.check(); for (const x of p) console.log('✗ ' + x); console.log(p.length ? `${p.length} documentation problem(s)` : '✓ documentation matches the code'); process.exit(p.length ? 1 : 0); } const ch = D.write(); console.log(ch.length ? '✓ updated ' + ch.join(', ') : '✓ already up to date'); const p = D.check(); for (const x of p) console.log('✗ ' + x); process.exit(p.length ? 1 : 0); }
    case 'research': { const h = Number(rest.find((x) => /^\d+(\.\d+)?$/.test(x)) || 2); let code; try { code = await require('../tui/research.cjs').runResearch({ hours: Math.min(Math.max(h, 0.1), 48) }); } catch (e) { console.log('\n✗ ' + require('../lib/safety.cjs').redact(e.shortMessage || e.message) + ' (read-only: nothing was sent)'); code = 1; } process.exit(code); }
    case 'deploy': { if (rest.includes('--metamask')) process.env.CHRONOS_OWNER_SIGNER = 'metamask'; let code; try { code = await require('../tui/deploy.cjs').runDeploy({ planOnly: rest.includes('--plan'), v2: rest.includes('--v2') }); } catch (e) { console.log('\n✗ ' + require('../lib/safety.cjs').redact(e.message || String(e)) + '\nNothing was sent.'); code = 1; } process.exit(code); }
    case 'cloud-pack': { const live = require('../lib/live.cjs'); const f = live.findEnvFile(); if (!f) { console.log('No .env found. Run: chronos setup'); process.exit(2); } const r = require('../lib/cloudpack.cjs').writePack(f); for (const l of r.lines) console.log('  ' + l); if (r.missing.length) console.log(`  ! not set (the cloud engine will use the suggested starting values): ${r.missing.join(', ')}`); console.log(`\nwrote ${r.file}\nIt holds no secrets. Upload it to Google Cloud Shell next to chronos-console.tgz, then run gcp-setup.sh.`); return; }
    case 'update': { const r = require('child_process').spawnSync('sh', [require('../lib/autoupdate.cjs').runnableCopy(ROOT, require('../lib/live.cjs').DATA)], { stdio: 'inherit' }); process.exit(r.status === null ? 1 : r.status); }
    case 'publish': {
      const DV = require('../lib/device.cjs'); const fs = require('fs'); const os = require('os');
      const f = rest[0] || [path.join('/sdcard', 'Download'), path.join(os.homedir(), 'storage', 'downloads'), path.join(os.homedir(), 'Downloads')].flatMap((d) => { try { return fs.readdirSync(d).filter((x) => /^chronos-console.*\.tgz$/.test(x)).map((x) => path.join(d, x)); } catch (_) { return []; } }).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
      if (!f) { console.log('usage: chronos publish [chronos-console.tgz]   (default: the newest one in Downloads)'); process.exit(2); }
      try { const r = await DV.publish(f, rest.slice(1).join(' ')); console.log(`✓ published v${r.version} from ${f}: your approved devices will be offered it`); } catch (e) { console.log('✗ ' + e.message); process.exit(1); }
      return;
    }
    case 'device': {
      const DV = require('../lib/device.cjs');
      try { const s = await DV.enroll(); console.log(`this device: ${s.status} · pairing code ${s.code}${s.status === 'pending' ? ' · approve it in your portal → Devices' : ''}`); const l = s.status === 'approved' ? await DV.latest(require('../package.json').version) : null; if (l) console.log(`newest release v${l.version} (you have v${require('../package.json').version})`); } catch (e) { console.log('✗ ' + e.message); process.exit(1); }
      return;
    }
    case 'doctor': return doctor();
    case 'daemon': {
      // an uncaught error is recorded (cause, time) before the service manager restarts the engine, so the crash-loop
      // breaker and chronos assist can say why; repeated crashes put the engine in safe mode (lib/remedy.cjs)
      const D = require('../lib/daemon.cjs'); const RM = require('../lib/remedy.cjs');
      const fatal = (e) => { try { RM.onCrash(D.DATA, e); console.error('FATAL ' + require('../lib/safety.cjs').redact(String((e && e.message) || e))); } finally { process.exit(1); } };
      // leftovers of a connection already closed or replaced (a websocket feed reconnecting) are logged, never fatal
      const guard = (e) => { if (require('../lib/safety.cjs').benignNetworkError(e)) { console.error('ignored (closed connection): ' + require('../lib/safety.cjs').redact(String((e && e.message) || e)).slice(0, 160)); return; } fatal(e); };
      process.on('uncaughtException', guard); process.on('unhandledRejection', guard);
      let code; try { code = await D.runDaemon(); } catch (e) { fatal(e); } process.exit(code); }
    case 'autopilot': { const r = await require('../lib/autopilot.cjs').runAutopilot({ service: !rest.includes('--no-service'), drive: !rest.includes('--no-drive'), firstScan: !rest.includes('--no-scan') }); process.exit(r.ok ? 0 : 1); }
    case 'service': return serviceCmd(rest[0] || 'status');
    case 'verify': {
      const I = require('../lib/integrity.cjs');
      if (rest.includes('--install')) { const t = I.tidy(); if (t.moved.length) console.log(`  moved ${t.moved.length} file(s) left by an older version to ${t.dest}: ${t.moved.join(', ')}`); }
      const v = I.verify(); printIntegrity(v); process.exit(v.ok ? 0 : 1);
    }
    case 'unlock': { require('../lib/integrity.cjs').unlock(); console.log('code is editable. When you are done: chronos test && chronos seal'); return; }
    case 'lock': { require('../lib/integrity.cjs').lock(); console.log('code files are read-only'); return; }
    case 'seal': return sealCmd();
    case 'help': case '-h': case '--help': return console.log(HELP);
    default: console.log(`unknown command: ${cmd}`); console.log(HELP); process.exit(2);
  }
})();

async function serviceCmd(sub) {
  const SVC = require('../lib/service.cjs');
  const LS = require('../lib/livestate.cjs');
  const live = require('../lib/live.cjs');
  const path = require('path');
  if (sub === 'install') { const r = SVC.install({ envFile: live.findEnvFile() }); for (const s of r.steps) console.log(`  ${s.ok ? '✓' : s.warn ? '!' : '✗'} ${s.msg}`); process.exit(r.ok ? 0 : 1); }
  if (sub === 'status') {
    const s = SVC.status(); const ls = LS.read(live.DATA);
    console.log(`  service     ${!s.pm2 ? 'PM2 not found (npm install -g pm2)' : s.installed ? `${s.status}${s.restarts ? ` · ${s.restarts} restarts` : ''}` : 'not installed (chronos service install)'}`);
    console.log(`  boot start  ${s.boot ? 'on' : s.bootAppReady ? 'off (chronos service install)' : 'off (install Termux:Boot, open it once)'}`);
    if (ls.ok) { const st = ls.state; const ago = (ms) => (ms < 120000 ? Math.round(ms / 1000) + ' s' : ms < 7200000 ? Math.round(ms / 60000) + ' min' : (ms / 3600000).toFixed(1) + ' h'); const alive = LS.alive(st, 120000); console.log(`  engine      ${alive ? st.phase : 'NOT RUNNING (stopped ' + ago(Date.now() - st.heartbeat) + ' ago; start it: chronos phone)'} · heartbeat ${ago(Date.now() - st.heartbeat)} ago · last scan ${st.lastScanAt ? Math.round((Date.now() - st.lastScanAt) / 1000) + ' s ago' : 'none yet'}${st.error ? ' · ' + st.error : ''}`); if (st.res) console.log(`  last scan   block ${st.res.blockNumber} · ${st.res.approved} approved · best net ${st.res.candidates[0] ? '$' + st.res.candidates[0].netUsd.toFixed(2) : '—'}`); if (st.profit && st.profit.current) console.log(`  profit      NOT PROFITING · stage ${st.profit.current.n} of 7: ${st.profit.current.name}`); }
    else console.log(`  engine      ${ls.reason === 'signature' ? 'state file failed its signature check' : 'no state yet'}`);
    process.exit(0);
  }
  if (['start', 'stop', 'restart', 'uninstall', 'logs'].includes(sub)) { try { const r = SVC.control(sub); console.log(sub === 'logs' ? r : `  ✓ ${r}`); process.exit(0); } catch (e) { console.log('  ✗ ' + e.message.split('\n')[0]); process.exit(1); } }
  console.log('usage: chronos service install | status | start | stop | restart | logs | uninstall'); process.exit(2);
}

function printIntegrity(v) {
  if (v.foreign && v.foreign.length) {
    console.log(`  ✗ ${v.foreign.length} file(s) in the Chronos folder are not part of this release (not Chronos code): ${v.foreign.slice(0, 5).join(', ')}${v.foreign.length > 5 ? ' …' : ''}`);
    console.log(`      move them out: mkdir -p ~/quarantine && cd ${require('../lib/integrity.cjs').ROOT} && mv ${v.foreign.slice(0, 5).map((f) => JSON.stringify(f)).join(' ')} ~/quarantine/`);
  }
  if (v.ok) return console.log(`  ✓ integrity: ${v.count} code files${v.depsSealed ? ` + ${v.depsCount} libraries` : ''} match the seal from ${v.sealedAt}`);
  if (!v.sealed) return console.log('  ✗ integrity: not sealed yet (run: chronos seal)');
  console.log('  ✗ integrity: code differs from the seal');
  for (const f of v.changed) console.log('      changed  ' + f);
  for (const f of v.missing) console.log('      missing  ' + f);
  for (const f of v.added) console.log('      new      ' + f);
  if (v.deps) console.log('      ' + v.deps);
}

async function sealCmd() {
  const I = require('../lib/integrity.cjs');
  const v = I.verify();
  if (v.sealed && v.ok && (v.depsSealed || !v.depsInstalled)) { I.lock(); return console.log('already sealed and unchanged; code locked read-only'); }
  if (v.sealed && v.ok) { I.unlock(); I.seal(); I.lock(); const n = I.verify(); return console.log(`code unchanged; added the ${n.depsCount} installed libraries to the seal (${n.count} files) and locked read-only`); }
  printIntegrity(v);
  const confirm = process.argv.includes('--yes') || await new Promise((res) => {
    if (!process.stdin.isTTY) return res(false);
    process.stdout.write('\nTrust the code exactly as it is now? Type "seal" to confirm: ');
    process.stdin.once('data', (d) => res(String(d).trim() === 'seal'));
  });
  if (!confirm) { console.log('not sealed'); process.exit(1); }
  I.unlock(); I.seal(); I.lock();
  console.log(`sealed ${I.verify().count} files and locked them read-only`);
  process.exit(0);
}

/** chronos set KEY [VALUE]: one checked .env write. Secrets are typed hidden (never on the command line); signing keys are refused. */
async function setCmd(key, value) {
  const C = require('../lib/catalog.cjs'); const E = require('../lib/envfile.cjs'); const live = require('../lib/live.cjs');
  const { POLICY, readExecPolicy } = require('../lib/execpolicy.cjs'); const { DEPLOY_POLICY, readDeployPolicy } = require('../lib/deploy.cjs');
  const keys = [...C.SECRETS.map((x) => x.key), ...C.SETTINGS.map((x) => x.key), ...POLICY.map((x) => x.key), ...DEPLOY_POLICY.map((x) => x.key)];
  if (!key) { console.log('usage: chronos set KEY [VALUE]\nkeys: ' + keys.join(' ')); process.exit(2); }
  if (C.SIGNING_KEYS.includes(key)) { console.log(`${key} is a signing key: chronos never stores one. chronos deploy asks for it hidden, per run.`); process.exit(2); }
  const sec = C.SECRETS.find((x) => x.key === key); const st = C.SETTINGS.find((x) => x.key === key);
  const pol = POLICY.find((x) => x.key === key) || DEPLOY_POLICY.find((x) => x.key === key);
  if (!sec && !st && !pol) { console.log(`unknown key ${key}. Known: ${keys.join(' ')}`); process.exit(2); }
  if (sec && sec.secret && value !== undefined) { console.log(`${key} is secret: run "chronos set ${key}" and type it at the hidden prompt, so it stays out of your shell history.`); process.exit(2); }
  if (value === undefined) {
    const P = require('../tui/prompt.cjs');
    const label = process.env.CHRONOS_SET_LABEL || `${key}: ${(sec || st || pol).what}`; // chronos keys passes its own, once
    value = sec && sec.secret ? await P.secret(label, 'hidden · paste or type · enter to save · esc to cancel') : await P.input(label);
    if (value === null || value === undefined || value === '') { console.log('cancelled, nothing saved'); process.exit(1); }
  }
  value = String(value).trim();
  let note = 'format checked';
  if (sec) { const r = await sec.test(value); if (!r.ok) { console.log(`not saved: ${r.msg}`); process.exit(1); } note = `${r.level === 'verified' ? 'verified' : 'format checked'}${r.msg ? ' · ' + r.msg : ''}`; }
  else if (st) { const e = C.checkSetting(st, value); if (e) { console.log(`not saved: ${e}`); process.exit(1); } note = `within ${st.min}–${st.max}`; }
  else { const r = (POLICY.includes(pol) ? readExecPolicy : readDeployPolicy)((k) => (k === key ? value : undefined)); if (r.problems.length) { console.log('not saved: ' + r.problems[0]); process.exit(1); } note = pol.oneOf ? `one of ${pol.oneOf.join('/')}` : `within ${pol.min}–${pol.max}`; }
  const file = live.defaultEnvFile(); const doc = E.load(file); E.set(doc, key, value); E.save(doc);
  console.log(`saved ${key}${sec && sec.secret ? ' (' + E.mask(value) + ')' : '=' + value} in ${file} · ${note}`);
  // the engine loads it on a restart: said first, since PM2 can take a while on a phone; skipped inside chronos keys
  // (one restart at the end of the whole sitting, not one per key)
  if (!process.env.CHRONOS_NO_RESTART) {
    const r = require('../lib/service.cjs').restartSoon();
    console.log(r === 'requested' ? 'engine restarting in the background to load it (a few seconds)' : 'engine not running: it loads it when it starts');
  }
  process.exit(0);
}

async function doctor() {
  try { const s = await require('../lib/device.cjs').status(); console.log(`\n  device       ${s.status} · pairing code ${s.code}${s.status === 'approved' ? ' · portal data on' : ' · approve it in your portal → Devices'}`); } catch (e) { console.log(`\n  device       ${e.status === 403 ? 'not enrolled: chronos device' : 'release service not reachable'}`); }
  const live = require('../lib/live.cjs');
  const { loadConfig } = require('../lib/config.cjs');
  const pol = require('../lib/policies.cjs');
  const sys = require('../lib/system.cjs');
  const { readRecord } = require('../lib/record.cjs');
  const ok = (b) => (b ? '✓' : '✗');
  const envFile = live.findEnvFile();
  const cfg = loadConfig(envFile);
  console.log('\n◆ CHRONOS doctor\n');
  console.log(`  .env           ${envFile || 'NOT FOUND'}`);
  console.log(`  RPC variable   ${cfg.rpcEnvKey || 'none'} (url not shown)\n`);
  printIntegrity(require('../lib/integrity.cjs').verify());
  console.log('');
  console.log('  POLICIES');
  for (const p of pol.evaluatePolicies({ envFile, cfg, record: readRecord(live.workspaceDir(envFile)), lastRes: null, integrity: require('../lib/integrity.cjs').verify() })) console.log(`    ${p.id.padEnd(7)} ${p.status.padEnd(10)} ${p.name} — ${p.detail}`);
  console.log('\n  PARAMETERS');
  for (const p of pol.listParameters({ envFile, cfg })) console.log(`    ${p.ok ? '✓' : p.required ? '✗' : '·'} ${p.key.padEnd(24)} ${p.ok ? p.value : p.required ? 'MISSING (required)' : 'not set'}`);
  console.log('\n  NODES');
  const nodes = await sys.probeNodes(envFile);
  if (!nodes.length) console.log('    ✗ no RPC url in .env');
  for (const n of nodes) console.log(`    ${ok(n.ok)} ${n.key.padEnd(20)} ${n.ms !== undefined ? (n.ms + ' ms').padEnd(9) : ''.padEnd(9)} ${n.detail}${n.block ? ' · block ' + n.block : ''}`);
  console.log('\n  SERVICES');
  const s = await sys.pm2List();
  console.log(`    PM2: ${s.source}`);
  for (const a of s.apps) console.log(`    · ${a.name.padEnd(26)} ${a.status}`);
  for (const a of sys.ecosystemApps(live.workspaceDir(envFile))) console.log(`    ${ok(a.exists)} ${a.name.padEnd(26)} ${a.exists ? 'script present' : 'script missing: ' + a.script}`);
  console.log(`\n  ${cfg.problems.length ? '✗ ' + cfg.problems.length + ' setting(s) to fix before the console can scan' : '✓ ready: run  chronos'}\n`);
}
