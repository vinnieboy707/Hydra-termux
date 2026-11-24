# 🛡️ Chronos Infrastructure Core
> Enterprise-grade zero-trust gRPC daemon, adaptive arbitrage revenue engine, secure settlement gateway, and real-time telemetry worker managed via PM2.

---

## 📚 Documentation & Runbooks
- **[Enterprise Production Runbook & Honesty Policy](./PRODUCTION_RUNBOOK_MAX_DETAIL.md)**: Comprehensive deployment, architecture, accounting honesty principles, and operational guides.

---

## 🌟 Architecture & Key Modules

Chronos Infrastructure Core consists of 6 core production modules:
1. **Direct Settlement & Payout Bridge (`src/direct-settlement-gateway.js`, `src/production-payout-bridge.js`):** Idempotent Stripe payouts, SHA-256 hash-chained WAL ledger (`unified_financial_ledger.wal`), balance checks, and exponential backoff retries.
2. **Stripe Webhook Listener (`src/stripe-webhook-listener.js`):** Raw body signature verification (`constructEvent`), fast 2xx responses, and deduplication by `event.id`.
3. **Adaptive Parameter Optimizer (`src/adaptive-parameter-optimizer.js`):** Automatically tunes profit spread thresholds, gas price caps, and slippage tolerance on trade failure, locking in "Golden Baselines" upon sustained success.
4. **Notification Policy Manager (`src/notification-policy-manager.js`):** Real-time alerts for errors (with root-cause suggested solutions), build/test failures, port offline status, capital movements towards bank/wallet, and profit optimization proposals.
5. **System Stabilization Enforcer:** Circuit breakers, health probes, memory threshold guardians, and kill switches.
6. **Live Revenue Dashboard & Telemetry:** Sourced directly from immutable WAL ledgers with compounding growth factors.

---

## ⚙️ Quick Start Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run compliance and verifier test suite
node verify_all_6_modules_compliance.js
node test_adaptive_optimizer.js
node test_notification_policy.js
node test_system_integration.js

# 4. Launch production stack via PM2
pm2 start ecosystem.config.js
pm2 save
```
