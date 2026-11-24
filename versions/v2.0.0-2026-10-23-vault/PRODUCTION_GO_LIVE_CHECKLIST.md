# Chronos Infrastructure: Production Go-Live Checklist & Enforcement Policies

This document serves as the authoritative, mandatory enterprise checklist and governance policy framework for promoting Chronos Infrastructure services to live production environments. Every deployment phase requires verified sign-off against these gates.

---

## Phase 1: Environment & Credential Hardening
- [ ] **Strict Environment Validation:** All mandatory environment variables (`ARBITRUM_RPC_URL`, `ETHERSCAN_API_KEY`, `PRIVATE_KEY`, `STRIPE_SECRET_KEY`, `DESTINATION_BANK_ACCOUNT_ID`, `STRIPE_WEBHOOK_SECRET`) are explicitly checked at startup; missing variables trigger an immediate non-zero exit (`process.exit(1)`).
- [ ] **Credential Redaction in Memory:** Sensitive keys (`PRIVATE_KEY`, `STRIPE_SECRET_KEY`) are read into local constants during initialization and immediately redacted from `process.env` to prevent leakage via diagnostic dumps or third-party dependencies.
- [ ] **Non-Root Execution:** Processes run under dedicated least-privilege system service accounts (e.g., PM2 managed user processes) without root permissions.

## Phase 2: Financial Integrity & Zero-Simulation Mandate (ADR-001 & ADR-002)
- [ ] **Zero-Simulation Policy:** All fallback mock modes, synthetic transaction generators, and stubbed responses are permanently purged from live execution paths. Services halt rather than simulate when live gateway/RPC connectivity fails.
- [ ] **Immutable Write-Ahead Ledgers:** All financial events are appended to `unified_financial_ledger.wal` secured with cryptographic SHA-256 hash chaining.
- [ ] **Strict Idempotency:** Every payout request (`stripe.payouts.create`) utilizes a deterministic idempotency key (e.g., `payout_${session.id}`) to prevent double-spending or duplicate processing upon service restarts.

## Phase 3: Resource Governance & 95% Threshold Stabilization
- [ ] **Active Resource Governor:** `SystemStabilizationEnforcer` (`src/system-stabilization-enforcer.js`) is deployed and managed via PM2.
- [ ] **95% Threshold Trigger:** System memory utilization and V8 heap usage are monitored continuously. If usage reaches or exceeds **95%**, the enforcer automatically triggers forced garbage collection (`global.gc()`), sheds non-essential load, and records critical audit entries in `logs/stabilization_audit.log`.

## Phase 4: Circuit Breakers & Fault Tolerance
- [ ] **Web3 RPC Circuit Breaker:** Configured with failure threshold limits (e.g., max 5 consecutive failures) to suspend non-critical RPC polling during node outages and prevent cascade failures.
- [ ] **Banking Settlement Circuit Breaker:** Configured with strict consecutive failure thresholds (max 3 failures) to automatically trip and disable automated fiat payouts during banking gateway outages.

## Phase 5: Observability, Logging & Alerting
- [ ] **Structured Telemetry:** All daemons emit correlation IDs (`correlationId`) alongside structured JSON log events.
- [ ] **Process Management:** All core modules (`revenue-engine`, `direct-settlement`, `real-web3-executor`, `system-stabilization-enforcer`, `live-dashboard`) are registered under PM2 (`ecosystem.config.js`) with `autorestart: true`.
- [ ] **Audit Trail Compliance:** Compliance reports and error auditor daemons are active to capture anomalies in real-time.

## Phase 6: Staged Rollout & Verification Gate
- [ ] **Step 1 - Local Simulation & Unit Tests:** Run test suites (`node test_hardening.js`, `node test_stabilization_enforcer.js`) with passing exit codes.
- [ ] **Step 2 - Testnet / Fork Validation:** Deploy contracts and test execution against Arbitrum Sepolia / Mainnet Fork.
- [ ] **Step 3 - Limited Mainnet Rollout:** Deploy with capped transaction size limits and live webhook validation.
- [ ] **Step 4 - Full Production Go-Live:** Authorized final sign-off after successful health probe verification (`GET /health`).

---
*Enforced by Chronos Infrastructure Governance Council.*
