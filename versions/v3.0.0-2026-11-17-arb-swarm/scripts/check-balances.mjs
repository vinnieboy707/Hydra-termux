import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const network = ethers.Network.from(42161);
const provider = new ethers.JsonRpcProvider(
    process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    network,
    { staticNetwork: network }
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddr = ethers.getAddress((process.env.CONTRACT_ADDRESS || "0x9dFF36775eAB4BbAe7c03eCb13ce8636791C4326").toLowerCase());

const tokens = [
    { symbol: "WETH", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", decimals: 18 },
    { symbol: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6 },
    { symbol: "ARB",  address: "0x912ce59144191c1204e64559fe8253a0e49e6548", decimals: 18 },
    { symbol: "WBTC", address: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", decimals: 8 }
];

const erc20Abi = ["function balanceOf(address) view returns (uint256)"];

async function runAudit() {
    const [walletEth, contractEth, blockNum] = await Promise.all([
        provider.getBalance(wallet.address),
        provider.getBalance(contractAddr),
        provider.getBlockNumber()
    ]);

    console.log("================================================================");
    console.log(`📡 Arbitrum One Block: #${blockNum}`);
    console.log(`🔑 EOA Wallet:         ${wallet.address}`);
    console.log(`📜 Arb Contract:       ${contractAddr}`);
    console.log("----------------------------------------------------------------");
    console.log(`ETH (Native Gas) | Wallet: ${ethers.formatEther(walletEth).padEnd(20)} | Contract: ${ethers.formatEther(contractEth)}`);

    for (const t of tokens) {
        const checksummed = ethers.getAddress(t.address.toLowerCase());
        const c = new ethers.Contract(checksummed, erc20Abi, provider);
        const [wBal, cBal] = await Promise.all([c.balanceOf(wallet.address), c.balanceOf(contractAddr)]);
        console.log(`${t.symbol.padEnd(16)} | Wallet: ${ethers.formatUnits(wBal, t.decimals).padEnd(20)} | Contract: ${ethers.formatUnits(cBal, t.decimals)}`);
    }
    console.log("================================================================");

    if (fs.existsSync("logs/real_execution_ledger.jsonl")) {
        console.log("--- Settled On-Chain Executions & Sweeps ---");
        console.log(fs.readFileSync("logs/real_execution_ledger.jsonl", "utf8").trim());
    } else {
        console.log("ℹ️ No settled trades logged in real_execution_ledger.jsonl yet.");
    }
}

runAudit().catch(console.error);
