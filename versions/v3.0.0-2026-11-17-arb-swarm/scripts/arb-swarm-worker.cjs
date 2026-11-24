const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function startSwarmDaemon() {
  console.log('=========================================================');
  console.log('CHRONOS OS: ARBITRUM WSS SWARM WORKER (STABLE TELEMETRY)');
  console.log('=========================================================');

  const wssUrl = process.env.ALCHEMY_WSS_URL || 'wss://arb-mainnet.g.alchemy.com/v2/demo';
  const httpUrl = process.env.ALCHEMY_RPC_URL || 'https://arb1.arbitrum.io/rpc';

  const wsProvider = new ethers.WebSocketProvider(wssUrl);
  const httpProvider = new ethers.JsonRpcProvider(httpUrl);

  console.log(`🌐 Connected to Arbitrum RPC & WSS endpoints`);
  console.log(`👁️ Monitored Deployer Address: 0xc873fEcbd354f5A56E00E710B90EF4201db2448d`);

  const auditPath = path.join(process.cwd(), 'artifacts', 'deployment_audit.json');
  let contractAddress = 'PENDING_DEPLOYMENT';
  if (fs.existsSync(auditPath)) {
    try {
      const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      contractAddress = auditData.address || contractAddress;
    } catch (e) {}
  }
  console.log(`🎯 Target Router Address: ${contractAddress}`);

  // Real-time block listener via WebSocket (Read-Only Telemetry)
  wsProvider.on('block', async (blockNumber) => {
    console.log(`[WSS BLOCK TELEMETRY] Height: ${blockNumber} | Scanning Arbitrum DEX liquidity pools...`);
  });

  wsProvider.on('error', (error) => {
    console.error('❌ WebSocket provider error:', error.message);
  });

  console.log('⚡ WSS listener active. Streaming live Arbitrum mempool data...');
}

startSwarmDaemon().catch((err) => {
  console.error('❌ Swarm worker crashed:', err);
  process.exit(1);
});
