#!/usr/bin/env bash
set -e

cd ~/chronos-infrastructure-core

echo "[CHRONOS SWARM] Setting up robust TypeScript compilation for Termux environment..."

pm2 delete all || true

# Install typescript explicitly and verify bin path
npm install --save-dev typescript@5.3.3

# Locate and invoke tsc correctly via npx or local bin
if [ -f "./node_modules/.bin/tsc" ]; then
    ./node_modules/.bin/tsc
else
    npx --no-install tsc || ./node_modules/typescript/bin/tsc || npx tsc
fi

node scripts/task_b_verifier.js

pm2 start ecosystem.config.js
pm2 save

echo "[CHRONOS SWARM] All modules successfully compiled, verified, and running under PM2:"
pm2 status
pm2 logs arb-swarm-worker --lines 15 --nostream
