#!/usr/bin/env bash
set -e

cd ~/chronos-infrastructure-core

echo "[CHRONOS LAUNCH] Finalizing environment, compiling, verifying, and launching mainnet swarm..."

pm2 delete all || true
rm -rf dist

npm install --save-dev typescript@5.3.3

# Locate and invoke the TypeScript compiler directly via node without wrapper collision
TSC_PATH=$(node -e "try { console.log(require.resolve('typescript/lib/tsc.js')) } catch (e) { console.log('') }")

if [ -n "$TSC_PATH" ]; then
    node "$TSC_PATH"
elif [ -f "./node_modules/typescript/lib/tsc.js" ]; then
    node ./node_modules/typescript/lib/tsc.js
else
    npx --no-install tsc
fi

node scripts/task_b_verifier.js

pm2 start ecosystem.config.js
pm2 save

echo "[CHRONOS LAUNCH] Deployment complete. System status and logs:"
pm2 status
pm2 logs arb-swarm-worker --lines 20 --nostream
