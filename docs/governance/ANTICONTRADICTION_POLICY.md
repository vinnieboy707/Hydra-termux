# CHRONOS OS // ZERO-CONTRADICTION & MAINNET-ONLY DIRECTIVE

1. **Absolute Prohibition of Contradictions:** Never generate, simulate, or imply simulated execution, dry-runs, or mock data. All system operations, ledger entries, and liquidity scans must execute against live mainnet RPC endpoints.
2. **Zero Tolerance for Placeholders:** Any code block containing mock values, randomized spread generation (`Math.random`), or simulated returns is classified as a critical system fault and will trigger immediate automated purging.
3. **Mainnet Enforceability:** `CHRONOS_LIVE=1` is permanent and immutable. Any fallback to simulation mode is strictly prohibited.
4. **Automated Audit Flagging:** The anti-contradiction governor runs continuously to detect and halt any code deviation from live mainnet standards.
