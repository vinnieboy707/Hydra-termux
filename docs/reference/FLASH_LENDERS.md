# Flash lenders on Arbitrum One

Read from each protocol's own documentation on 2026-11-25 (links below). Contract v2.2 borrows from the first three;
the engine picks, per route, the cheapest lender the deployed contract borrows from that holds enough of the asset.

| Lender | Address (Arbitrum One) | Fee | How the loan is repaid | Contract source id |
| --- | --- | --- | --- | --- |
| Aave V3 | Pool `0x794a61358D6845594F94dc1DB02A252b5b4814aD` | `FLASHLOAN_PREMIUM_TOTAL`, 0.05 % at deployment, changeable by governance (the engine reads it live) | the receiver approves the Pool for amount + premium; the Pool pulls it after `executeOperation` returns `true` | 0 |
| Balancer V2 | Vault `0xBA12222222228d8Ba445958a75a0704d566BF2C8` | the protocol fee collector's flash-loan fee (read live; 0 today) | the receiver transfers amount + fee back to the Vault inside `receiveFlashLoan` | 1 |
| Morpho Blue | `0x6c247b1F6182318877311737BaC0844bAa518F5e` (docs.morpho.org/developers/contracts/addresses) | none | Morpho sends, calls `onMorphoFlashLoan(assets, data)`, then pulls `assets` back with `transferFrom`: the callback approves Morpho | 2 |
| Balancer V3 | Vault (not used yet) | none | `unlock` → `sendTo` → transfer back → `settle` inside the unlock callback | — |

Note: `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` is Morpho Blue on Ethereum mainnet, not Arbitrum.

## Security points that shaped the contract
- **Aave:** `executeOperation` checks `msg.sender == POOL` and `initiator == address(this)`, so nobody else can start a
  loan to the contract (Aave docs: verify the initiator).
- **Balancer V2 and Morpho:** their callbacks do not name who started the loan, so the contract records a one-time hash
  of the exact loan it starts (asset, amount, route) and accepts the callback only for that loan, only from that
  lender, and only while `execute` is running (re-entry guard). Three separate locks; the tests attack each.
- **Morpho:** the repayment is a pull, so the contract approves exactly `assets` and nothing more; no allowance is
  left after the trade (tested).

## Sources
- https://aave.com/docs/aave-v3/guides/flash-loans
- https://docs.balancer.fi/concepts/vault/flash-loans.html (V3)
- https://docs.morpho.org/learn/concepts/flashloans/
- https://docs.morpho.org/developers/contracts/blue/
- https://docs.morpho.org/developers/contracts/addresses/

## Not for Chronos
- Jupiter Lend flash loans (developers.jup.ag/docs/lend/flashloan) are on Solana. Chronos runs on Arbitrum One, so they
  cannot be combined with this contract.
