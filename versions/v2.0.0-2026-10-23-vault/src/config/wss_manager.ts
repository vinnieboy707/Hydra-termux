// =========================================================================
// CHRONOS OS // WSS MULTI-NETWORK WEBSOCKET MANAGER
// =========================================================================

import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

export interface NetworkConfig {
  name: string;
  wssUrl: string;
  chainId: number;
}

export class WssManager {
  private connections: Map<string, WebSocket> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  private networks: NetworkConfig[] = [
    {
      name: 'ethereum',
      wssUrl: process.env.ETH_MAINNET_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/demo',
      chainId: 1
    },
    {
      name: 'arbitrum',
      wssUrl: process.env.ARBITRUM_WS_URL || 'wss://arb-mainnet.g.alchemy.com/v2/demo',
      chainId: 42161
    },
    {
      name: 'optimism',
      wssUrl: process.env.OPTIMISM_WS_URL || 'wss://opt-mainnet.g.alchemy.com/v2/demo',
      chainId: 10
    },
    {
      name: 'base',
      wssUrl: process.env.BASE_WS_URL || 'wss://base-mainnet.g.alchemy.com/v2/demo',
      chainId: 8453
    }
  ];

  public connectAll(): void {
    for (const net of this.networks) {
      this.connectNetwork(net);
    }
  }

  private connectNetwork(net: NetworkConfig): void {
    if (!net.wssUrl || net.wssUrl.includes('YOUR_API_KEY')) {
      console.warn(`[WSS WARNING] Skipping ${net.name}: Missing valid Alchemy API key in environment.`);
      return;
    }

    console.log(`[WSS] Connecting to ${net.name} (Chain ID: ${net.chainId})...`);
    const ws = new WebSocket(net.wssUrl);

    ws.on('open', () => {
      console.log(`[WSS CONNECTED] ${net.name} WebSocket stream active.`);
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_subscribe',
        params: ['newHeads']
      }));
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.params && message.params.result) {
          console.log(`[WSS DATA // ${net.name}] New Block Header:`, message.params.result.number);
        }
      } catch (err) {
        console.error(`[WSS ERROR // ${net.name}] Failed to parse message:`, err);
      }
    });

    ws.on('error', (error) => {
      console.error(`[WSS ERROR // ${net.name}]:`, error.message);
    });

    ws.on('close', () => {
      console.warn(`[WSS CLOSED] ${net.name} disconnected. Reconnecting in 5s...`);
      this.connections.delete(net.name);
      
      const timer = setTimeout(() => this.connectNetwork(net), 5000);
      this.reconnectTimers.set(net.name, timer);
    });

    this.connections.set(net.name, ws);
  }

  public shutdown(): void {
    for (const [name, ws] of this.connections.entries()) {
      ws.terminate();
      console.log(`[WSS SHUTDOWN] Terminated connection for ${name}`);
    }
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.connections.clear();
    this.reconnectTimers.clear();
  }
}

// Execution Harness
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new WssManager();
  manager.connectAll();

  process.on('SIGINT', () => {
    manager.shutdown();
    process.exit(0);
  });
}
