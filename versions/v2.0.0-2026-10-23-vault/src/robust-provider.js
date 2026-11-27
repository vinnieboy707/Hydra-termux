'use strict';
/**
 * ==============================================================================
 * CHRONOS OS // WSS-FIRST ROBUST PROVIDER FACTORY
 * ==============================================================================
 * Prioritizes WebSocket (wss://) connections before HTTP JSON-RPC (https://)
 * for ultra-low latency transaction broadcasting, mempool streaming, and execution.
 * ==============================================================================
 */

const { ethers } = require('ethers');

const ETH_CHAIN_ID = 1;
const ethNetwork = new ethers.Network("mainnet", ETH_CHAIN_ID);

const DEFAULT_WSS_ENDPOINTS = [
    process.env.ETH_WSS_URL,
    "wss://ethereum-rpc.publicnode.com",
    "wss://eth.llamarpc.com"
].filter(Boolean);

const DEFAULT_HTTP_ENDPOINTS = [
    process.env.ETHEREUM_RPC_URL,
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com"
].filter(Boolean);

/**
 * Creates a WSS-first WebSocketProvider with HTTP JSON-RPC fallback support.
 * @returns {ethers.WebSocketProvider | ethers.JsonRpcProvider}
 */
function createWssFirstProvider(customWssUrl) {
    const wssUrl = customWssUrl || DEFAULT_WSS_ENDPOINTS[0];
    
    if (wssUrl) {
        try {
            console.log(`[+] Initializing Primary WSS Connection: ${wssUrl}`);
            const wsProvider = new ethers.WebSocketProvider(wssUrl, ethNetwork, {
                staticNetwork: ethNetwork
            });
            return wsProvider;
        } catch (err) {
            console.warn(`⚠️ WSS Connection failed (${err.message}). Falling back to HTTP RPC...`);
        }
    }

    // Fallback to robust HTTP JSON-RPC provider
    const httpUrl = DEFAULT_HTTP_ENDPOINTS[0] || "https://ethereum-rpc.publicnode.com";
    console.log(`[+] Initializing Fallback HTTP RPC Provider: ${httpUrl}`);
    return new ethers.JsonRpcProvider(httpUrl, ethNetwork, {
        staticNetwork: ethNetwork
    });
}

module.exports = {
    createWssFirstProvider,
    ETH_CHAIN_ID
};
