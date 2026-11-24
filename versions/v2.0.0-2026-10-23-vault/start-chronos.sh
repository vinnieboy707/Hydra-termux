#!/usr/bin/env bash
set -e

echo "[CHRONOS OS] Initializing Mainnet Execution Environment..."
export NODE_ENV=production
export CHRONOS_LIVE=1

npm install
npx tsc
node scripts/task_b_verifier.js

pm2 start ecosystem.config.js
pm2 save

echo "[CHRONOS OS] Swarm online and operating in fail-closed production mode."
