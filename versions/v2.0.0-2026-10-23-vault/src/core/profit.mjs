import { toMicro } from "../db/json-ledger.mjs";

export function gasCostUsd(receipt, ethUsd) {
  const price = receipt.gasPrice ?? receipt.effectiveGasPrice; // ethers v6 / v5
  return (Number(BigInt(receipt.gasUsed) * BigInt(price)) / 1e18) * ethUsd;
}

// swapOutUsd: value actually received from swaps, measured from the Transfer
// logs or balance delta BEFORE repayment. Never use the quote.
// Read premiumBps from the Aave pool instead of hardcoding it.
export function arbEntry({ txHash, asset, principalUsd, swapOutUsd, premiumBps, receipt, ethUsd }) {
  const ok = receipt.status === 1;
  const gas = gasCostUsd(receipt, ethUsd);
  const premium = ok ? (principalUsd * premiumBps) / 10000 : 0;
  const gross = ok ? swapOutUsd - principalUsd : 0;
  return {
    ref: txHash,
    kind: ok ? "arb" : "arb_reverted",
    source: "onchain",
    asset,
    borrowed: String(principalUsd),
    revenue: toMicro(gross),
    cost: toMicro(premium + gas),
  };
}
