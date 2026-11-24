import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const root = path.resolve(import.meta.dirname, "..");
const art = JSON.parse(fs.readFileSync(path.join(root, "artifacts", "FlashLoanArbitrageExecutor.json"), "utf8"));

const provider = new ethers.JsonRpcProvider(need("RPC_URL") || need("ARBITRUM_RPC_URL"));
const deployer = new ethers.Wallet(need("DEPLOYER_PRIVATE_KEY"), provider);
const net = await provider.getNetwork();
console.log(`🌐 Connected to chain ID: ${net.chainId}, Deployer: ${deployer.address}`);

const factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
console.log("🚀 Deploying FlashLoanArbitrageExecutor contract...");
const c = await factory.deploy(need("BALANCER_VAULT"), need("AAVE_POOL"), need("MORPHO"), need("TREASURY"));
await c.waitForDeployment();
const addr = await c.getAddress();
console.log("✅ Deployed contract address:", addr);

await (await c.setExecutor(need("EXECUTOR_ADDRESS"), true)).wait();
await (await c.setRouter(need("ROUTER"), true)).wait();
console.log("✅ Hot-wallet executor and router successfully allowlisted.");
console.log(`\n👉 Set CONTRACT_ADDRESS=${addr} in your .env file.`);
