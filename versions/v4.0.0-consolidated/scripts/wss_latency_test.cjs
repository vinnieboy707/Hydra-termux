const { ethers } = require('ethers');
require('dotenv').config();

const WSS_URL = process.env.ARBITRUM_WSS_URL || 'wss://arb1-sequencer.arbitrum.io/rpc';

async function benchmarkWss() {
    console.log("⚡ [WSS Diagnostic] Connecting to Arbitrum Sequencer WebSocket...");
    const startTime = Date.now();
    
    const provider = new ethers.WebSocketProvider(WSS_URL);

    try {
        // Wait for connection ready
        await provider.ready;
        const connectTime = Date.now() - startTime;
        console.log(`✅ [Connection Success] WebSocket established in ${connectTime}ms`);

        console.log("👂 [Listening] Waiting for next live block header (newHeads)...");
        
        const blockPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                provider.destroy();
                reject(new Error("Timeout: No block header received within 15 seconds."));
            }, 15000);

            provider.on('block', (blockNumber) => {
                clearTimeout(timeout);
                resolve(blockNumber);
            });
        });

        const blockStart = Date.now();
        const blockNumber = await blockPromise;
        const blockLatency = Date.now() - blockStart;

        console.log(`🎯 [Block Header Received] Block #${blockNumber}`);
        console.log(`⏱️ [Sequencer Response Latency]: ${blockLatency}ms`);

        await provider.destroy();
        process.exit(0);

    } catch (err) {
        console.error("❌ [WSS Diagnostic Error]:", err.message);
        process.exit(1);
    }
}

benchmarkWss();
