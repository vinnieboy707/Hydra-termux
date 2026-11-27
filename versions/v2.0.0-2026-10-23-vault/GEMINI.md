# CHRONOS OS // MASTER OPERATING STANDARD

## 1. Core Invariants
- **Policy C1 (Fail-Closed Default)**: CHRONOS_LIVE=0 and KILL_SWITCH active until the 14-day observation window passes.
- **Policy P1 (Real Capital Mandate)**: Profit is recognized solely upon finalized on-chain settlement or merchant processor clearance. Paper simulations and quotes evaluate to exactly $0.00.
- **Policy T1 (Tax Reserve Requirement)**: 30% of recognized gross revenue is locked in reserve prior to any payout approval calculation.

## 2. Infrastructure Architecture
- **Phone (Termux Sentinel)**: Telemetry monitoring, killswitch management, and secure signing on port 8022.
- **Laptop (vdizzle Compute Engine)**: Multi-provider quoting, PM2 daemon execution, log evaluation, and automated OpenRouter auditing.

## 3. Engineering Protocols
- Strict CommonJS (`require` / `module.exports`) across all production scripts.
- No silent error swallowing (`catch (_) {}` without logging is prohibited).
- Fail loudly with stack traces written to `unresolved-audit.log`.
