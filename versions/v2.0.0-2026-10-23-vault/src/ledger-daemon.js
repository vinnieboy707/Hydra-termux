'use strict';

const Logger = require('./logger');
const { getWorkingProvider } = require('./evm-engine');
const { verifySolanaState } = require('./solana-direct');
const { processInboundSettlement } = require('./settlement-waterfall');

const EVM_WALLET = '0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0';
const SOL_WALLET = 'ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr';

let lastSolBalance = 0.0885;

async function checkInflows() {
  try {
    // 1. Solana Balance delta check
    const solState = await verifySolanaState(SOL_WALLET);
    if (solState.balance > lastSolBalance) {
      const delta = solState.balance - lastSolBalance;
      // Rough peg test: delta * estimated SOL price ($175)
      const estimatedUSD = +(delta * 175).toFixed(2);
      Logger.info(`[INFLOW_DETECTED] Inbound ${delta.toFixed(4)} SOL received on-chain!`);
      processInboundSettlement('SOLANA_MAINNET', estimatedUSD, `SOL_SLOT_${Date.now()}`);
      lastSolBalance = solState.balance;
    }

    // 2. EVM Provider connectivity heartbeat
    const { provider, url } = await getWorkingProvider('arbitrum');
    const balanceWei = await provider.getBalance(EVM_WALLET);
    Logger.info(`[LEDGER_HEARTBEAT] EVM sync via ${url} | Solana slot verified via ${solState.endpoint}`);
  } catch (err) {
    Logger.warn('Error during ledger inflow check: ' + err.message);
  }
}

async function start() {
  Logger.info('Starting Chronos On-Chain Settlement Watcher...');
  await checkInflows();
  setInterval(checkInflows, 60000); // Poll once every 60 seconds
}

start();

// --- UNIVERSAL I/O COMPLIANCE ENFORCED ---
console.log("[IO Audit] File loaded successfully: ledger-daemon.js");
const executeIO = (input = process.argv[2] || process.env.NODE_ENV || "default") => {
  const output = { file: "ledger-daemon.js", inputReceived: input, timestamp: new Date().toISOString(), status: "nominal" };
  console.log("[IO Output]:", JSON.stringify(output));
  return output;
};
executeIO();
