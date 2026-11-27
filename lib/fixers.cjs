'use strict';
// Automatic fixes for the checklist. Every fix keeps a backup and checks its own result; if anything is uncertain
// it changes nothing and says so.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { scriptsUploadingEnv, findSuspects } = require('./actions.cjs');

const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14); // e.g. 20261123083412
const balanced = (l) => { const c = (ch) => l.split(ch).length - 1; return c('(') === c(')') && c('{') === c('}') && c('[') === c(']'); };

/** Disable the lines that put .env into Drive backups. Only single, complete statements are touched; the file must still parse. */
function fixUploadScripts(workspace) {
  const hits = scriptsUploadingEnv(workspace) || [];
  const byFile = {};
  for (const h of hits) { const [rel, line] = h.split(':'); (byFile[rel] = byFile[rel] || []).push(Number(line)); }
  const results = [];
  for (const [rel, lines] of Object.entries(byFile)) {
    const file = path.join(workspace, rel);
    const src = fs.readFileSync(file, 'utf8'); const L = src.split('\n');
    const unsafe = lines.filter((n) => { const t = (L[n - 1] || '').trim(); return !(t.endsWith(';') && balanced(t) && !t.startsWith('}') && !/^(else|case|default)\b/.test(t)); });
    if (unsafe.length) { results.push({ file: rel, ok: false, msg: `line ${unsafe.join(', ')} is not a single complete statement; left unchanged, edit it by hand` }); continue; }
    const backup = `${file}.chronos-bak-${stamp()}`;
    fs.copyFileSync(file, backup);
    for (const n of lines) { const raw = L[n - 1]; const indent = raw.match(/^\s*/)[0]; L[n - 1] = `${indent}// [chronos] disabled: this line put your .env (all API keys) into Drive backups. Was: ${raw.trim()}`; }
    fs.writeFileSync(file, L.join('\n'));
    const chk = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (chk.status !== 0) { fs.copyFileSync(backup, file); results.push({ file: rel, ok: false, msg: 'syntax check failed after the edit; original restored' }); continue; }
    results.push({ file: rel, ok: true, msg: `disabled line ${lines.join(', ')} · backup ${path.basename(backup)}` });
  }
  return results;
}

/** Move scripts known to report profit that never happened into _quarantine/<time>/ (reversible). */
function quarantineSuspects(workspace) {
  const found = findSuspects(workspace);
  const dest = path.join(workspace, '_quarantine', stamp());
  return found.map((rel) => {
    const to = path.join(dest, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(path.join(workspace, rel), to);
    return { file: rel, ok: true, msg: `moved to ${path.relative(workspace, to)}` };
  });
}
module.exports = { fixUploadScripts, quarantineSuspects };
