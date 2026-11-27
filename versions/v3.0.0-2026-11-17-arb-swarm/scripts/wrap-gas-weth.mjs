import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const network = ethers.Network.from(42161);
const provider = new ethers.JsonRpcProvider(
    process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    network,
    { staticNetwork: network }
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const WETH_ADDR = ethers.getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1");
const WETH_ABI = [
    "function deposit() external payable",
    "function balanceOf(address) external view returns (uint256)"
];

async function adjustGasAndWeth() {
    const nativeEth = await provider.getBalance(wallet.address);
    const gasReserve = ethers.parseEther("0.006"); // Keep 0.006 ETH for ~100+ Arbitrum txs

    if (nativeEth <= gasReserve) {
        console.log(`⚠️ Native ETH (${ethers.formatEther(nativeEth)} ETH) is already at or below the 0.006 ETH gas reserve. No wrap needed.`);
        return;
    }

    const wrapAmount = nativeEth - gasReserve;
    const weth = new ethers.Contract(WETH_ADDR, WETH_ABI, wallet);

    console.log(`🔄 Wrapping ${ethers.formatEther(wrapAmount)} ETH -> WETH (retaining 0.006 ETH native gas)...`);
    const tx = await weth.deposit({ value: wrapAmount });
    const receipt = await tx.wait();

    const [newEth, newWeth] = await Promise.all([
        provider.getBalance(wallet.address),
        weth.balanceOf(wallet.address)
    ]);

    console.log(`✅ Wrap Confirmed | Tx: ${receipt.hash}`);
    console.log(`⛽ Native ETH (Gas): ${ethers.formatEther(newEth)} ETH`);
    console.log(`💎 Wrapped WETH:     ${ethers.formatEther(newWeth)} WETH`);
}

adjustGasAndWeth().catch(console.error);
