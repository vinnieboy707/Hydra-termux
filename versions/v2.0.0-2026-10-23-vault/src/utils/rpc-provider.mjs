import { ethers } from "ethers";

const RPC_ENDPOINTS = [
  process.env.ALCHEMY_RPC_URL,
  process.env.ARB_RPC_URL,
  "https://arb1.arbitrum.io/rpc",
  "https://arbitrum.llamarpc.com",
  "https://1rpc.io/arb"
].filter(Boolean);

export async function getResilientProvider() {
  for (const url of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      console.log(`[+] Fallback Connected Successfully via: ${url}`);
      return provider;
    } catch (err) {
      console.warn(`[!] Provider failed (${url}): ${err.message}. Trying next fallback...`);
    }
  }
  throw new Error("[!] CRITICAL: All RPC endpoints and fallbacks are unreachable.");
}
