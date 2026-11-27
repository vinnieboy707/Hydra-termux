# 🌐 Master API & Endpoint Registry (Chronos Infrastructure)

This document serves as the centralized, elite-optimized registry for all API routes, Web3 RPC providers, gateway endpoints, government records, and settlement configurations across the Chronos Infrastructure ecosystem.

---

## 1. Web3 RPC Endpoints & Blockchain Networks

| Network / Chain | Provider | Endpoint URL | Purpose / Routing |
| :--- | :--- | :--- | :--- |
| **Arbitrum One (L2)** | Public / Primary | `https://arb1.arbitrum.io/rpc` | High-frequency arbitrage execution, Uniswap V3 pool reading, flash swaps (`real-web3-executor.js`). |
| **Ethereum Mainnet** | Alchemy | `https://eth-mainnet.g.alchemy.com/v2/REDACTED` | Primary consensus state, token verification, oracle price feeds. |
| **Ethereum Mainnet** | QuickNode | `https://sly-tame-bird.ethereum-mainnet.quiknode.pro/REDACTED` | Redundant / Failover RPC node for high-throughput block monitoring. |

---

## 2. External Public Records, FOIA & Property Database APIs

| Category | Provider | API Base URL / Portal | Purpose / Data Scope |
| :--- | :--- | :--- | :--- |
| **Government Transparency** | FOIA.gov | `https://www.foia.gov/developer` | Access federal agency FOIA data, requests, and public record endpoints. |
| **Government Documents** | GovInfo (.gov) | `https://www.govinfo.gov/features/api` | Access official government publications, bills, congressional records, and federal regulations. |
| **Federal Open Data** | Data.gov | `https://api.data.gov` | Unified catalog of open data provided by federal agencies. |
| **Property & Deed Data** | First American Data Co | `https://dna.firstam.com/property_data` | Access national property database, deeds, liens, encumbrances, and real estate analytics. |
| **Property & Public Records** | PropMix | `https://pubrec.propmix.io` | Real estate public records, property valuation, and market data APIs. |
| **Public Records & Investigative** | Tracers | `https://www.tracers.com/api` | Public records search, background checks, asset location, and investigative data. |
| **Public Records / Vital Stats** | Record Information Services | `https://public-record.com/record_category/apis` | County-level public records, bankruptcies, liens, judgements, and real estate transactions. |
| **Real Estate & Market Data** | Zillow Group | `https://www.zillowgroup.com/developers/api/` | Housing market indices, property valuation, and real estate datasets. |
| **Municipal Public Records** | CivicPlus | `https://www.civicplus.com` | Local government FOIA management, public records request workflows, and civic portals. |

---

## 3. Internal Microservice & Gateway Endpoints

| Service Name | Port / Route | Protocol | Purpose / Lifecycle |
| :--- | :--- | :--- | :--- |
| **gRPC Telemetry Daemon** | `0.0.0.0:50051` | gRPC (HTTP/2) | Zero-trust system telemetry, heartbeat streams, keepalives (`server.js`, `stats.proto`). |
| **Live Revenue Dashboard** | `http://localhost:3800` | HTTP / WebSocket | Real-time financial telemetry and metric monitoring (`src/live-revenue-dashboard.js`). |
| **Metrics Exporter** | `http://localhost:3900` | HTTP | Prometheus-compatible metrics export (`src/metrics-exporter.js`). |
| **Tap-to-Pay Gateway** | `http://localhost:3800/tap-pay` | HTTP POST/GET | Instant payment ingestion and liquidity routing (`tap_to_pay_gateway.js`). |

---

## 4. Financial & Direct Settlement Routing

| Configuration File | Target Route / Asset | Status |
| :--- | :--- | :--- |
| `direct_settlement_config.json` | Arbitrum One USDC (`0xB2B33E9464c060aF8e6B95eaF77FE3954e7E13A0`) | ACTIVE |
| `direct_settlement_config.json` | Primary Commercial Bank (ACH/Wire) | CONFIGURED |
| `revenue_streams_config.json` | 9 Autonomous Streams (Arbitrage, SaaS, Compute, Staking) | ACTIVE_24_7 |

---

## 5. Etherscan API v2 Endpoints (Multi-Chain 60+ Chains)

| Module | Action / Endpoint | Base URL / Route | Purpose / Description |
| :--- | :--- | :--- | :--- |
| **Account** | `balance` | `https://api.etherscan.io/v2/api?chainid={id}&module=account&action=balance` | Retrieves native token balance in wei. |
| **Account** | `balancemulti` | `https://api.etherscan.io/v2/api?chainid={id}&module=account&action=balancemulti` | Retrieves native balances for multiple addresses. |
| **Account** | `txlist` | `https://api.etherscan.io/v2/api?chainid={id}&module=account&action=txlist` | Retrieves normal transaction history. |
| **Account** | `tokentx` | `https://api.etherscan.io/v2/api?chainid={id}&module=account&action=tokentx` | Retrieves ERC-20 token transfers. |
| **Stats** | `ethsupply` / `ethsupply2` | `https://api.etherscan.io/v2/api?chainid={id}&module=stats&action=ethsupply` | Retrieves circulating supply of native tokens. |
| **Stats** | `ethprice` | `https://api.etherscan.io/v2/api?chainid={id}&module=stats&action=ethprice` | Retrieves current token price in USD/BTC. |
| **Tokens** | `tokenbalance` | `https://api.etherscan.io/v2/api?chainid={id}&module=account&action=tokenbalance` | Retrieves ERC-20 token balance for an address. |
| **Contracts**| `getsourcecode` | `https://api.etherscan.io/v2/api?chainid={id}&module=contract&action=getsourcecode` | Retrieves verified contract source code and ABI. |

> **Note:** Etherscan API v2 calls require an `&apikey=REDACTED` query parameter (API key injected via environment variable, redacted from this registry).

---

## 6. Elite Optimization & Utilization Process

To maintain maximum system performance, reliability, and security when utilizing these internal and external APIs:

1. **Keepalive & Connection Pooling:** All HTTP/2 and gRPC connections must maintain persistent keepalive settings (5s keepalive interval, 2s timeout) to prevent dropped packets and socket starvation.
2. **Rate Limiting & Caching:** External public record and property APIs (FOIA, GovInfo, Data.gov, Tracers, PropMix, First American) must enforce strict request rate-limiting, local response caching (TTL-based), and exponential backoff retry policies.
3. **Circuit Breaking:** External API calls must incorporate consecutive failure thresholds (max 5 consecutive failures before tripping circuit breakers) to isolate unresponsive data providers.
4. **Idempotency & Ledger Recording:** Financial or transactional interactions derived from public records or property intelligence must include unique idempotency keys and be permanently logged to `unified_financial_ledger.wal` with SHA-256 hash chaining.
5. **Credential Isolation:** API keys, tokens, and private identifiers for external providers (e.g., Tracers, PropMix, Alchemy) must be injected strictly via environment variables (`.env`) and redacted from logs.
