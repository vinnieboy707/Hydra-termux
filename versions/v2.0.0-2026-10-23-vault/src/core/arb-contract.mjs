import "./boot.mjs";
import { ethers } from "ethers";
import { arbEntry } from "./profit.mjs";

const ABI = [
  "function POOL() view returns (address)",
  "function execute(address asset,uint256 amount,uint256 minProfit,uint256 deadline,(uint8 dex,address router,address tokenOut,uint24 fee,uint256 minOut)[] legs) returns (uint256 profit)",
  "event Arbitrage(address indexed asset,uint256 amount,uint256 premium,uint256 profit)",
];
const POOL_ABI = ["function FLASHLOAN_PREMIUM_TOTAL() view returns (uint128)"];

export function makeArb(provider) {
  const wallet = new ethers.Wallet(process.env.EXECUTOR_PRIVATE_KEY, provider); // KMS signer needs an adapter
  const c = new ethers.Contract(process.env.CHRONOS_ARB_CONTRACT, ABI, wallet);
  const iface = new ethers.Interface(ABI);
  const DEC = Number(process.env.BORROW_ASSET_DECIMALS || 6);
  const usd = (units) => Number(units) / 10 ** DEC;

  // opp: { asset, amount (bigint units), minProfit (bigint units), legs[], chainId, slippageBps, quotedAtMs, ethUsd }
  return {
    async simulate(opp) {
      const deadline = Math.floor(Date.now() / 1000) + 30;
      const args = [opp.asset, opp.amount, opp.minProfit, deadline, opp.legs];
      try {
        const pool = new ethers.Contract(await c.POOL(), POOL_ABI, provider);
        const premiumBps = Number(await pool.FLASHLOAN_PREMIUM_TOTAL());
        const profit = await c.execute.staticCall(...args);       // eth_call on live state
        const gasUnits = await c.execute.estimateGas(...args);
        const gasPriceWei = (await provider.getFeeData()).gasPrice;
        const premium = (opp.amount * BigInt(premiumBps)) / 10000n;
        return { simulatedOk: true, simulatedGrossUsd: usd(profit + premium), gasUnits, gasPriceWei,
                 ethUsd: opp.ethUsd, premiumBps, principalUsd: usd(opp.amount), deadline };
      } catch (e) {
        return { simulatedOk: false, simulatedGrossUsd: 0, gasUnits: 0n, gasPriceWei: 0n,
                 ethUsd: opp.ethUsd, premiumBps: 0, principalUsd: usd(opp.amount), deadline, error: e.shortMessage ?? e.message };
      }
    },

    async send(opp, sim) {
      const tx = await c.execute(opp.asset, opp.amount, opp.minProfit, sim.deadline, opp.legs,
        { gasLimit: (sim.gasUnits * 12n) / 10n });
      try { return { txHash: tx.hash, receipt: await tx.wait() }; }
      catch (e) { if (e.receipt) return { txHash: tx.hash, receipt: e.receipt }; throw e; } // reverts still get recorded
    },

    toEntry(sent, sim, opp) {
      let swapOutUsd = 0;
      for (const log of sent.receipt.logs) {
        try {
          const p = iface.parseLog(log);
          if (p?.name === "Arbitrage") swapOutUsd = usd(p.args.amount + p.args.premium + p.args.profit);
        } catch {}
      }
      return arbEntry({ txHash: sent.txHash, asset: opp.asset, principalUsd: sim.principalUsd, swapOutUsd,
                        premiumBps: sim.premiumBps, receipt: sent.receipt, ethUsd: opp.ethUsd });
    },
  };
}
