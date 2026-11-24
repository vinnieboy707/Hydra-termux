'use strict';
const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

const envPath = path.join(__dirname, '..', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  });
}

const API_KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free';

if (!API_KEY) {
  Logger.failLoud('OPENROUTER_API_KEY is not defined in environment or .env', new Error('MISSING_API_KEY'), true);
}

async function runAudit() {
  Logger.info(`Running Chronos AI Code & Log Audit via ${MODEL}...`);

  const logFiles = ['unresolved-audit.log', 'output_log.txt'];
  let logSnippets = '';
  for (const lf of logFiles) {
    const fp = path.join(__dirname, '..', lf);
    if (fs.existsSync(fp)) {
      const lines = fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean);
      logSnippets += `\n--- ${lf} (Last 20 lines) ---\n` + lines.slice(-20).join('\n');
    }
  }

  const prompt = `Perform an enterprise code and reliability audit on Chronos OS.
Evaluate recent errors, verify zero silent failures, enforce CommonJS compliance, and confirm Policy C1 adherence.
Logs:
${logSnippets || 'No critical errors recorded.'}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://chronos-os.local',
        'X-Title': 'Chronos Code Auditor'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are the Chronos OS Lead Production Engineer. Enforce strict CommonJS syntax, fail-closed safety, and zero unverified income.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    if (!res.ok) {
      throw new Error(`OpenRouter HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const report = data.choices[0].message.content;
    const reportDir = path.join(__dirname, '..', 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'latest_ai_audit.md'), report);
    Logger.info('AI Audit completed and saved to reports/latest_ai_audit.md');
  } catch (err) {
    Logger.warn('Audit run failed: ' + err.message);
  }
}

runAudit();
