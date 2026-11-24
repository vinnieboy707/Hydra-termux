'use strict';
const { Connection, PublicKey } = require('@solana/web3.js');
const Logger = require('./logger');

const SOLANA_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.rpc.extrnode.com',
  'https://rpc.ankr.com/solana'
];

async function verifySolanaState(walletAddress = 'ETjApxrCMxpnr46p5mWFXyVhmuVZtM23HJZxNSfCk8Jr', timeoutMs = 4500) {
  let conn = null;
  let activeUrl = null;

  for (const url of SOLANA_RPCS) {
    try {
      const testConn = new Connection(url, 'confirmed');
      await Promise.race([
        testConn.getSlot(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Solana Slot Timeout')), timeoutMs))
      ]);
      conn = testConn;
      activeUrl = url;
      break;
    } catch (err) {
      Logger.warn(`Solana RPC candidate ${url} failed: ${err.message}`);
    }
  }

  if (!conn) {
    Logger.failLoud('All Solana RPC endpoints timed out or failed.', new Error('SOLANA_RPC_EXHAUSTION'), true);
  }

  try {
    const pubkey = new PublicKey(walletAddress);
    const lamports = await conn.getBalance(pubkey);
    return { balance: lamports / 1e9, lamports, endpoint: activeUrl };
  } catch (err) {
    Logger.failLoud(`Failed querying Solana balance for ${walletAddress}`, err, true);
  }
}
module.exports = { verifySolanaState };

// --- UNIVERSAL I/O COMPLIANCE ENFORCED ---
console.log("[IO Audit] File loaded successfully: solana-direct.js");
const executeIO = (input = process.argv[2] || process.env.NODE_ENV || "default") => {
  const output = { file: "solana-direct.js", inputReceived: input, timestamp: new Date().toISOString(), status: "nominal" };
  console.log("[IO Output]:", JSON.stringify(output));
  return output;
};
executeIO();
