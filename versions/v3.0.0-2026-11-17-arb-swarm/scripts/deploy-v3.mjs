import { ethers } from "ethers";
import solc from "solc";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const BALANCER_VAULT = ethers.getAddress("0xBA12222222228d8Ba445958a75a0704d566BF2C8");
const SOL_PATH = path.join(process.cwd(), "contracts", "ChronosFlashArbitrageV3.sol");
const ARTIFACT_PATH = path.join(process.cwd(), "artifacts", "ChronosFlashArbitrageV3.json");

const input = {
    language: "Solidity",
    sources: { "ChronosFlashArbitrageV3.sol": { content: fs.readFileSync(SOL_PATH, "utf8") } },
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } }
};

console.log("⚙️ Compiling ChronosFlashArbitrageV3.sol...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const fatal = (output.errors || []).filter(e => e.severity === "error");
if (fatal.length > 0) {
    console.error(fatal.map(e => e.formattedMessage).join("\n"));
    process.exit(1);
}

const artifact = output.contracts["ChronosFlashArbitrageV3.sol"]["ChronosFlashArbitrageV3"];
const abi = artifact.abi;
const bytecode = "0x" + artifact.evm.bytecode.object;
fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
fs.writeFileSync(ARTIFACT_PATH, JSON.stringify({ abi, bytecode }, null, 2));

const network = ethers.Network.from(42161);
const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc", network, { staticNetwork: network });
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const factory = new ethers.ContractFactory(abi, bytecode, wallet);

console.log("🚀 Deploying ChronosFlashArbitrageV3 to Arbitrum One...");
const contract = await factory.deploy(BALANCER_VAULT);
await contract.waitForDeployment();
const deployedAddress = await contract.getAddress();

const envPath = path.join(process.cwd(), ".env");
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
envContent = /^CONTRACT_ADDRESS=/m.test(envContent)
    ? envContent.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${deployedAddress}`)
    : envContent + `\nCONTRACT_ADDRESS=${deployedAddress}\n`;
fs.writeFileSync(envPath, envContent);

console.log(`✅ DEPLOYED ChronosFlashArbitrageV3: ${deployedAddress}`);
