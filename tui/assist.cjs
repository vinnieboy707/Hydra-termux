'use strict';
// `chronos assist ["question"]`: the help agent on the command line. Checks this device and its engine, lists every
// problem with what Chronos already does about it and what only you can do, answers a question from the
// troubleshooting guide, and adds an AI diagnosis when OPENROUTER_API_KEY and CHRONOS_AGENT_MODEL are set. Read-only unless
// you pass --fix, which runs only the allowlisted terminal resolutions below, each verified.
const AS = require('../lib/assist.cjs');
const { redact } = require('../lib/safety.cjs');

const say = (s = '') => process.stdout.write(s + '\n');

// Terminal resolutions `chronos assist --fix` may run on this device: an allowlist, tried in order, each verified,
// never repeated. Nothing else is ever executed.
const TERMINAL = {
  'engine-down': [
    { name: 'keep Termux awake (termux-wake-lock)', run: () => { const cp = require('child_process'); cp.execFileSync('termux-wake-lock', [], { timeout: 10000, stdio: 'ignore' }); return 'wake lock held'; }, when: () => hasCmd('termux-wake-lock') },
    { name: 'start the engine service (chronos service start)', run: () => require('../lib/service.cjs').control('start'), when: () => require('../lib/service.cjs').status().installed },
    { name: 'install the engine service (chronos service install)', run: () => { const live = require('../lib/live.cjs'); require('../lib/service.cjs').install({ envFile: live.findEnvFile() }); return 'installed'; }, when: () => !require('../lib/service.cjs').status().installed },
  ],
  'device-unenrolled': [{ name: 'create this device\'s key and ask to join (chronos device)', run: async () => { const d = await require('../lib/device.cjs').enroll(require('os').hostname()); return `pairing code ${d.code}: approve it in the portal`; }, when: () => true }],
};
function hasCmd(c) { try { require('child_process').execFileSync('sh', ['-c', `command -v ${c}`], { stdio: 'ignore' }); return true; } catch (_) { return false; } }

/** runs the allowlisted terminal resolutions for the findings, verifying each with a fresh check */
async function fix(found, { log, recheck, steps = TERMINAL, settleMs = 15000 }) {
  const done = [];
  for (const f of found) {
    const ladder = steps[f.id]; if (!ladder) continue;
    const tried = new Set();
    for (const st of ladder) {
      if (tried.has(st.name)) continue; tried.add(st.name);
      let ok = false; try { ok = await st.when(); } catch (_) { ok = false; }
      if (!ok) continue;
      let evidence; try { evidence = String(await st.run()); } catch (e) { evidence = 'failed: ' + redact(e.message).slice(0, 120); }
      await new Promise((r) => setTimeout(r, settleMs));
      const still = (await recheck()).some((x) => x.id === f.id);
      log(`  ${still ? '✗' : '✓'} ${st.name} · ${evidence} · verified: ${still ? 'problem still there' : 'resolved'}`);
      done.push({ problem: f.id, step: st.name, resolved: !still });
      if (!still) break;
    }
  }
  return done;
}

async function runAssist({ question = '', log = say, facts = null, diagnoser = undefined, doFix = false, steps = TERMINAL, settleMs = 15000, regather = null } = {}) {
  log('◆ chronos assist · checking this device and its engine…');
  const F = facts || (await AS.gather());
  const found = AS.explain(AS.diagnose(F));
  if (!found.length) log('\n  ✓ No problems found. The engine is running and nothing needs you right now.');
  else {
    log(`\n  ${found.length} thing(s) found, most important first:\n`);
    found.forEach((x, i) => {
      log(`  ${i + 1}. ${x.title}`);
      log(`     what I see   ${x.detail}`);
      if (x.cause) log(`     why          ${x.cause}`);
      if (x.auto) log(`     automatic    ${x.auto}`);
      log(`     ${x.auto ? 'you can' : 'you need to'}  ${x.you || x.fix || 'see the guide'}`);
      log(`     guide        ${x.doc}`);
      log('');
    });
  }
  if (doFix && found.length) {
    log('  Applying the allowlisted resolutions this device can run, each verified:');
    const out = await fix(found, { log, steps, settleMs, recheck: async () => AS.diagnose(regather ? await regather() : await AS.gather()) });
    if (!out.length) log('  Nothing here can be fixed from the terminal; the engine handles the automatic parts, the rest needs you (above).');
    log('');
  } else if (found.some((x) => TERMINAL[x.id])) log('  Some of these can be fixed from here: chronos assist --fix\n');
  if (question) {
    const hits = AS.answer(question);
    log(`  Your question: "${redact(question).slice(0, 200)}"`);
    if (!hits.length) log('     The guide has no matching entry. Try other words, or read docs/OPERATIONS.md.');
    for (const h of hits) log(`     · ${h.symptom.replace(/`/g, '')}: ${h.cause}. Fix: ${h.fix.replace(/`/g, '')}  (${h.doc})`);
    log('');
  }
  // optional AI explanation (text only; nothing it says is executed)
  let diag = diagnoser;
  if (diag === undefined) {
    const get = (k) => (F.env ? F.env(k) : process.env[k]);
    const am = get('OPENROUTER_API_KEY') ? await require('../lib/agentmodel.cjs').resolve(get, require('../lib/live.cjs').DATA).catch(() => null) : null;
    diag = require('../lib/agentllm.cjs').createDiagnoser({ apiKey: get('OPENROUTER_API_KEY'), model: am && am.model });
  }
  if (diag && (found.length || question)) {
    try {
      const d = await diag({ id: question ? 'question' : found[0].id, msg: [question && `Owner asks: ${question}`, ...found.map((x) => `${x.title}: ${x.detail}`)].filter(Boolean).join('\n') });
      log(`  AI diagnosis (${d.model}, ${d.confidence} confidence; advice only, nothing is executed):`);
      log(`     cause  ${d.cause}`);
      log(`     fix    ${d.fix}\n`);
    } catch (e) { log(`  AI diagnosis unavailable: ${redact(e.message).slice(0, 100)}\n`); }
  } else if (!diag) log('  For a plain-language AI diagnosis too, set OPENROUTER_API_KEY (chronos set OPENROUTER_API_KEY; the model is chosen for you unless you set CHRONOS_AGENT_MODEL).\n');
  return found.some((x) => !x.auto) ? 1 : 0;
}

module.exports = { runAssist, fix, TERMINAL };
