#!/usr/bin/env bash
set -e

cd ~/chronos-infrastructure-core

echo "[CHRONOS] Stopping PM2 cluster..."
pm2 delete all || true

echo "[CHRONOS] Cleaning build artifacts and node_modules..."
rm -rf dist node_modules package-lock.json

echo "[CHRONOS] Reinstalling clean dependencies..."
npm install

echo "[CHRONOS] Building TypeScript code using local compiler..."
./node_modules/.bin/tsc

echo "[CHRONOS] Running verification script..."
node scripts/task_b_verifier.js

echo "[CHRONOS] Starting PM2 cluster..."
pm2 start ecosystem.config.js
pm2 save

echo "[CHRONOS] Current PM2 Status:"
pm2 status
