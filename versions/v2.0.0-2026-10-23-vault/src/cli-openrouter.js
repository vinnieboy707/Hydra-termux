'use strict';
require('dotenv').config();
const readline = require('readline');
const https = require('https');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.trim() : '';

// Prioritize the absolute most advanced free frontier-reasoning & coding models
const ADVANCED_FREE_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free', // 1M context, elite reasoning/orchestration
  'thinkingmachines/inkling:free',          // 1M context, massive open-weight MoE reasoning
  'poolside/laguna-s-2.1:free'              // Advanced software engineering & coding agent
];

const MODEL_NAME = process.env.OPENROUTER_MODEL || ADVANCED_FREE_MODELS[0];

if (!OPENROUTER_API_KEY) {
  console.error("🚨 [CRITICAL] Missing OPENROUTER_API_KEY in your .env configuration.");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('close', () => {
  process.exit(0);
});

console.log(`🤖 [Chronos Advanced Free Engine] Active: ${MODEL_NAME}`);
console.log(`Type your prompt, use '/model <id>' to switch, or 'exit' to quit.\n`);

function promptUser() {
  if (rl.closed) return;
  rl.question('Chronos (Advanced Free)> ', async (input) => {
    if (input === null || input === undefined) {
      rl.close();
      return;
    }
    const cleanInput = input.trim();
    if (cleanInput.toLowerCase() === 'exit') {
      rl.close();
      process.exit(0);
    }

    if (!cleanInput) {
      return promptUser();
    }

    if (cleanInput.startsWith('/model ')) {
      process.env.OPENROUTER_MODEL = cleanInput.replace('/model ', '').trim();
      console.log(`⚡ [Model Switched] Active model is now: ${process.env.OPENROUTER_MODEL}`);
      return promptUser();
    }

    process.stdout.write('Thinking with advanced free reasoning...');
    await queryOpenRouter(cleanInput, process.env.OPENROUTER_MODEL || MODEL_NAME);
    console.log('\n');
    promptUser();
  });
}

async function queryOpenRouter(promptText, targetModel) {
  const payload = JSON.stringify({
    model: targetModel,
    messages: [
      { role: "system", content: "You are Chronos CLI, an elite autonomous engineering assistant operating on advanced free-tier reasoning infrastructure. Provide strict, clean, production-grade solutions." },
      { role: "user", content: promptText }
    ]
  });

  const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/chronos-engine',
      'X-Title': 'Chronos Advanced CLI'
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed.choices && parsed.choices[0]?.message?.content) {
            console.log(parsed.choices[0].message.content);
          } else if (parsed.error) {
            console.log(`[-] OpenRouter API Error: ${parsed.error.message || responseBody}`);
          } else {
            console.log(`[-] Response: ${responseBody}`);
          }
        } catch (err) {
          console.log(`[-] Parsing Error: ${err.message} | Raw: ${responseBody}`);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.log(`[-] Network Error: ${err.message}`);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

promptUser();
