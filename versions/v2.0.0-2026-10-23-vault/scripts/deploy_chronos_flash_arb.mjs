import fs from "node:fs";
import { ethers } from "ethers";

const AAVE_POOL   = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Aave V3 Pool, Arbitrum
const ROUTERS     = ["0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 SwapRouter
                     "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"]; // Sushi V2 router
const BORROW      = process.env.BORROW_ASSET;                 // e.g. native USDC on Arbitrum
const CAP         = BigInt(process.env.MAX_LOAN_UNITS);       // in asset units, e.g. 5000000000 = 5000 USDC
const OPERATOR    = process.env.EXECUTOR_WALLET_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.ARB_RPC_URL);
const net = await provider.getNetwork();
if (net.chainId !== 42161n) throw new Error(`wrong chain ${net.chainId}`);
if ((await provider.getCode(AAVE_POOL)) === "0x") throw new Error("Aave pool has no code at that address");
for (const r of ROUTERS) if ((await provider.getCode(r)) === "0x") throw new Error(`router ${r} has no code`);

const art = JSON.parse(fs.readFileSync("artifacts/contracts/ChronosFlashArb.sol/ChronosFlashArb.json", "utf8"));
const owner = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
const f = new ethers.ContractFactory(art.abi, art.bytecode, owner);
const c = await f.deploy(AAVE_POOL);
await c.waitForDeployment();
console.log("deployed:", await c.getAddress());

for (const r of ROUTERS) await (await c.setRouter(r, true)).wait();
await (await c.setMaxLoan(BORROW, CAP)).wait();
await (await c.setOperator(OPERATOR, true)).wait();
console.log("configured: routers, cap, operator");
