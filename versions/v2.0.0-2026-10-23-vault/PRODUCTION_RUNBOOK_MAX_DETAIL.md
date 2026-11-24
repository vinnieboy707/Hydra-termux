# 📚 Chronos OS // Enterprise Production Runbook & Honesty Policy

> **Core Mandate:** *"Honesty in Accounting. No Omission, No False Wins."* 
> True profitability requires uncompromising transparency: every failed transaction, reverted flash loan, or high-slippage execution must be logged as a failure in the immutable WAL and failure ledger. False reporting destroys capital over time.

---

## 1. System Architecture & Core Modules

| Module Name | Path | Primary Purpose |
| :--- | :--- | :--- |
| **Direct Settlement & Payout Bridge** | `src/direct-settlement-gateway.js` | Idempotent Stripe payouts with SHA-256 hash-chained WAL auditing. |
| **Adaptive Parameter Optimizer** | `src/adaptive-parameter-optimizer.js` | Automatically tunes profit spreads, gas caps, and slippage thresholds on trade failure; locks golden baselines on success. |
| **Notification Policy Manager** | `src/notification-policy-manager.js` | Real-time alerts for errors (with suggested root-cause solutions), build/test failures, port offline status, and capital movements. |
| **Database Integration Hub** | `src/database-integration-hub.js` | Dual-write synchronization between WAL ledgers, PostgreSQL tables (`chronos_ledger`), and Firebase Firestore. |
| **API Router** | `src/api-routes-router.js` | Enterprise REST endpoints for dashboard stats, ledger entries, optimizer state, and tap-to-pay ingress. |
| **Foundry Smart Contracts** | `chronos_workspace/src/` | Flash loan execution vaults and multi-DEX arbitrage routing. |

---

## 2. Honesty & Profitability Policies

1. **Never Log Failures as Wins:**
   - If a smart contract reverts or net profit is $\le 0$, `AdaptiveParameterOptimizer` treats it as a failure event, immediately tightening spread and gas parameters.
   - The ledger records `payout_failed` or `trade_reverted` status. Zero profits are never inflated.
2. **Circuit Breakers & Kill Switches:**
   - If settlement failures exceed threshold (3 consecutive failures), the circuit breaker trips automatically, halting further money movement and notifying the operator.
3. **Daily Spend Caps & Minimum Reserves:**
   - Payout bridges fail closed if daily limits or minimum balance reserves are breached.

---

## 3. Operational Runbook & Deployment Guide

### Step 1: Environment Configuration
Ensure `.env` is fully configured with production credentials:
```bash
cp .env.example .env
# Edit .env with valid STRIPE_SECRET_KEY, ALCHEMY_RPC_URL, ETHERSCAN_API_KEY, PRIVATE_KEY, DISCORD_WEBHOOK_URL
```

### Step 2: Pre-Flight Verification & Test Suites
Run all compliance audits and unit/integration tests before deployment:
```bash
node verify_all_6_modules_compliance.js
node test_adaptive_optimizer.js
node test_notification_policy.js
node test_system_integration.js
```

### Step 3: PM2 Production Deployment
Start the enterprise server and telemetry workers under PM2 process management:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

### Step 4: Health Monitoring & Logs
Inspect real-time telemetry and audit logs:
```bash
pm2 logs
tail -n 100 data/alert_history.log
tail -n 100 unified_financial_ledger.wal
```
