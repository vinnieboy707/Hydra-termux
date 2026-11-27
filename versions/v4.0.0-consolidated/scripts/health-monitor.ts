import { loadEnvironment } from './utils/env-loader';

loadEnvironment();

const intervalSec = parseInt(process.env.MONITORING_INTERVAL || '60', 10);

console.log(`[HealthMonitor] Initialized 24/7 telemetry service (Interval: ${intervalSec}s).`);

setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`[HealthMonitor] Heartbeat OK | RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB | Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}, intervalSec * 1000);
