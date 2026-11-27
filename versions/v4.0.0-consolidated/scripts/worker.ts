import { loadEnvironment, getRpcUrl } from './utils/env-loader';

loadEnvironment();

async function runWorker() {
  const workerId = process.env.WORKER_ID || 'default-worker';
  const rpcUrl = getRpcUrl();
  
  console.log(`[${workerId}] Starting ArbiBot execution worker...`);
  console.log(`[${workerId}] Connected to RPC endpoint: ${rpcUrl.substring(0, 30)}...`);

  setInterval(async () => {
    try {
      console.log(`[${workerId}] Polling DEX liquidity pools and lending health factors...`);
    } catch (error) {
      console.error(`[${workerId}] Error in execution loop:`, error);
    }
  }, 5000);
}

runWorker().catch((err) => {
  console.error('Fatal worker error:', err);
  process.exit(1);
});
