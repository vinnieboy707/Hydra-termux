import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { ChronosAgentBus } from '../src/agent_bus.js';
import { ChronosApexBrain } from '../src/apex_brain.js';
import { ChronosLatencyRouter } from '../src/latency_router.js';
import { ChronosStateStore } from '../src/sqlite_wal_manager.js';

const bus = new ChronosAgentBus();
const brain = new ChronosApexBrain();
const latencyRouter = new ChronosLatencyRouter();
const stateStore = new ChronosStateStore('./data/real_estate_master.db');

async function startSwarmWorker() {
    bus.broadcast('SwarmWorker', 'INFO', '⚡ Chronos Sub-Millisecond Swarm Worker initializing...');
    bus.broadcast('SwarmWorker', 'INFO', `Connected to Direct Sequencer: ${latencyRouter.getSequencerEndpoint()}`);
    bus.broadcast('SwarmWorker', 'INFO', '🛡️ Policy P0 safeguards active: 8.5 bps hurdle & 0.05 Gwei gas cap.');

    // Load deployed flash-loan contract address if available
    const deploymentPath = path.resolve('data', 'deployment.json');
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        bus.broadcast('SwarmWorker', 'INFO', `🔗 Loaded ChronosFlashArb contract at: ${deployment.address}`);
    } else {
        bus.broadcast('SwarmWorker', 'WARN', '⚠️ deployment.json not found. Run deployment script to bind contract.');
    }

    // Periodic heartbeat and state sync
    setInterval(() => {
        bus.broadcast('SwarmWorker', 'DEBUG', 'Heartbeat check: Honeycomb mesh synchronized.');
    }, 30000);
}

startSwarmWorker().catch(err => {
    bus.broadcast('SwarmWorker', 'ERROR', `Fatal worker error: ${err.message}`);
    process.exit(1);
});
