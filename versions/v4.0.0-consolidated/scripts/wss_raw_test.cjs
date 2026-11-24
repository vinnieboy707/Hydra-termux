const WebSocket = require('ws');
require('dotenv').config();

const WSS_URL = process.env.ARBITRUM_WSS_URL || 'wss://arb1-sequencer.arbitrum.io/rpc';

console.log("⚡ [WSS Raw Diagnostic] Opening raw WebSocket connection to Arbitrum Sequencer...");
const ws = new WebSocket(WSS_URL);

const timeout = setTimeout(() => {
    console.error("❌ [Timeout] Raw WSS connection did not receive a block within 15 seconds.");
    ws.terminate();
    process.exit(1);
}, 15000);

ws.on('open', () => {
    console.log("✅ [Connection Open] Sending JSON-RPC eth_subscribe payload...");
    const subPayload = JSON.stringify({
        id: 1,
        method: "eth_subscribe",
        params: ["newHeads"]
    });
    ws.send(subPayload);
});

ws.on('message', (data) => {
    try {
        const response = JSON.parse(data.toString());
        if (response.method === 'eth_subscription' && response.params && response.params.result) {
            clearTimeout(timeout);
            const blockHeader = response.params.result;
            console.log(`🎯 [Live Block Header Received via WSS!]`);
            console.log(`   - Block Number (Hex): ${blockHeader.number}`);
            console.log(`   - Block Hash: ${blockHeader.hash}`);
            console.log(`   - Parent Hash: ${blockHeader.parentHash}`);
            ws.terminate();
            process.exit(0);
        } else if (response.result) {
            console.log("📡 [Subscription Confirmed ID]:", response.result);
        }
    } catch (err) {
        console.error("❌ [Parse Error]:", err.message);
    }
});

ws.on('error', (err) => {
    clearTimeout(timeout);
    console.error("❌ [WSS Error]:", err.message);
    process.exit(1);
});
