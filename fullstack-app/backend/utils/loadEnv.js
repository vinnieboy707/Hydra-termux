'use strict';
/**
 * Loads environment variables from the one shared secrets file that every
 * APEX project reads, so keys live in a single place.
 *
 * Where the file is:
 *   APEX_ENV_FILE if set, otherwise ~/.config/apex/secrets.env
 *   (on Termux that is /data/data/com.termux/files/home/.config/apex/secrets.env)
 *
 * Precedence, highest first:
 *   1. Variables already in the process environment (Docker, PM2, Vercel, shell)
 *   2. <PROJECT>__NAME entries in the shared file, applied as NAME for this project
 *   3. Plain NAME entries in the shared file
 *   4. The project's own local .env, kept only as a fallback while you migrate
 * Blank values in the shared file are ignored, so a half-filled template never
 * wipes out a working value.
 *
 * This file has no dependencies and is the same in every repo.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// Older names some projects still read, mapped to the one canonical name.
const ALIASES = {
  SUPABASE_PROJECT_URL: 'SUPABASE_URL',
  SUPABASE_SERVICE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  TELEGRAM_TOKEN: 'TELEGRAM_BOT_TOKEN',
};

function sharedEnvPath(env = process.env) {
  return env.APEX_ENV_FILE || path.join(os.homedir(), '.config', 'apex', 'secrets.env');
}

function parseEnv(text) {
  const out = {};
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let raw = m[2];
    const q = raw[0];
    if (q === '"' || q === "'" || q === '`') {
      // Quoted value, may span lines until the closing quote.
      let body = raw.slice(1);
      while (body.indexOf(q) === -1 && i + 1 < lines.length) body += '\n' + lines[++i];
      const end = body.indexOf(q);
      let val = end === -1 ? body : body.slice(0, end);
      if (q === '"') val = val.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');
      out[key] = val;
    } else {
      // An unquoted value that starts with # is a comment, so the value is blank.
      out[key] = raw.startsWith('#') ? '' : raw.replace(/\s+#.*$/, '').trim();
    }
  }
  return out;
}

function readIfPresent(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function loadEnv(options = {}) {
  const env = options.env || process.env;
  const project = options.project ? String(options.project).toUpperCase() : '';
  const sharedFile = options.sharedFile || sharedEnvPath(env);
  const localFile = options.localFile === undefined ? path.resolve(process.cwd(), '.env') : options.localFile;
  const log = options.quiet ? () => {} : (msg) => console.log(`[env] ${msg}`);

  const merged = {};
  const localText = localFile ? readIfPresent(localFile) : null;
  if (localText !== null) Object.assign(merged, parseEnv(localText));

  const sharedText = readIfPresent(sharedFile);
  if (sharedText !== null) {
    const shared = parseEnv(sharedText);
    const prefix = project ? `${project}__` : null;
    for (const [k, v] of Object.entries(shared)) {
      if (v === '' || k.includes('__')) continue;
      merged[k] = v;
    }
    if (prefix) {
      for (const [k, v] of Object.entries(shared)) {
        if (v !== '' && k.startsWith(prefix)) merged[k.slice(prefix.length)] = v;
      }
    }
    try {
      if (process.platform !== 'win32' && (fs.statSync(sharedFile).mode & 0o077)) {
        log(`warning: ${sharedFile} is readable by other users, run: chmod 600 "${sharedFile}"`);
      }
    } catch (_) { /* stat failure is not fatal */ }
  }

  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (merged[canonical] === undefined && merged[alias] !== undefined) merged[canonical] = merged[alias];
    if (merged[alias] === undefined && merged[canonical] !== undefined) merged[alias] = merged[canonical];
  }

  let applied = 0;
  for (const [k, v] of Object.entries(merged)) {
    if (env[k] === undefined) {
      env[k] = v;
      applied++;
    }
  }

  log(`${sharedText !== null ? `shared file ${sharedFile}` : `no shared file at ${sharedFile}`}`
    + `${localText !== null ? ', plus local .env fallback' : ''}; ${applied} variables set`);
  return { sharedFile, sharedFound: sharedText !== null, localFound: localText !== null, applied };
}

module.exports = { loadEnv, parseEnv, sharedEnvPath, ALIASES };
