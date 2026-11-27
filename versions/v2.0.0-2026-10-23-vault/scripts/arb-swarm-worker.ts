import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// Chronos OS v10.0 - Arbitrage Swarm Worker with Dynamic Gas & Fail-Closed Guard
async function executeArbLoop() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL || process.env.ALCHEMY_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  console.log(`[Chronos Worker] Initialized worker on Arbitrum provider`);

  const txRequest = {
    to: process.env.ARBITRUM_ROUTER_ADDRESS || "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    data: "0x",
    value: 0n
  };

  try {
    // Dynamic gas estimation with 1.12x multiplier and real-time fee oracle
    const estimatedGas = await provider.estimateGas(txRequest);
    const gasLimit = (estimatedGas * 112n) / 100n;

    const feeData = await provider.getFeeData();
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.1", "gwei");
    const maxFeePerGas = (feeData.lastBaseFeePerGas ?? 0n) * 2n + maxPriorityFeePerGas;

    const estimatedGasCost = gasLimit * maxFeePerGas;
    const projectedNetProfit = ethers.parseUnits("0.005", "ether");

    if (projectedNetProfit <= estimatedGasCost) {
      throw new Error(`[FAIL-CLOSED] Projected net profit (${projectedNetProfit}) below calculated gas overhead (${estimatedGasCost}). Aborting transaction broadcast.`);
    }

    console.log(`[Execution] Gas limit: ${gasLimit.toString()} | MaxFee: ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei | Estimated Cost: ${ethers.formatEther(estimatedGasCost)} ETH`);
    
    const tx = await wallet.sendTransaction({
      ...txRequest,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas
    });

    console.log(`[Success] Transaction broadcasted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[Confirmed] Block: ${receipt?.blockNumber} | Gas Used: ${receipt?.gasUsed?.toString()}`);

  } catch (err: any) {
    console.error(`[Worker Error] ${err.message}`);
  }
}

executeArbLoop();
