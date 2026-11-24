# ADR-002: Enterprise Production Readiness & Zero-Simulation Mandate

## Status
Accepted & Enforced

## Context
In financial infrastructure, mock data, simulation fallbacks, and unverified calculations introduce systemic risk, accounting discrepancies, and regulatory non-compliance. To transition the Chronos Infrastructure into an enterprise-grade production-ready environment, all simulation logic must be permanently purged, and all revenue/profit/fund metrics must be strictly real, auditable, and channeled through immutable write-ahead ledgers.

## Decision
1. **Zero-Simulation Policy:** All fallback mock modes, synthetic transaction generators, and stubbed responses in live revenue execution paths are prohibited. If live gateway credentials or ledger connections are unavailable, operations must halt rather than simulate.
2. **Interchangeable Financial Metrics:** Revenue, gross profit, net profit, and available funds share a strictly typed, immutable decimal representation across all ledger entries and reporting APIs.
3. **Cryptographic Append-Only Ledger:** Every monetary event must be appended to `unified_financial_ledger.wal` with an SHA-256 cryptographic chain linking consecutive entries.
4. **Strict Idempotency:** All fund transfers and settlements require deterministic idempotency keys to prevent double-spending or duplicate processing.

## Consequences
- **Positive:** Absolute accounting accuracy, auditable trail for financial audits, elimination of simulated false positives.
- **Negative:** Strict operational dependency on live gateway connectivity and valid credentials.
