# Your company

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · **Company** · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

Chronos runs as a small company of AI agents. You own it. A VP runs it day to day. Departments do the work and report
to the VP.

```
You (owner) ── daily report · immediate alerts: database down, money lost, money made, and the road to cash (each step verified, any step that stops holding, and your own steps until done)
  │            approve: keys, contract changes, moving funds
  └─ VP of Operations ── mission: keep building and delegating until Chronos is profitable
       ├─ Trading desk        ├─ Risk & compliance   ├─ Treasury
       ├─ Site reliability    ├─ Data & records      ├─ Research
       └─ Security            └─ Builder (a scheduled Claude session that ships code improvements)
```

## The VP's charter

Hard-coded in `lib/company.cjs`: no setting, agent or AI answer can change it.

<!-- GENERATED:charter -->
**Mission.** Continuously improve Chronos until it handles real funds and makes verified profit; never stop before that, and keep improving within limits after it.

**Objectives, in priority order** (the VP always works on the first one not yet met):

1. Keep the engine running and correct: reliability comes before every other objective.
2. Get the contract deployed and the executor funded and ready (steps only you can take are sent to you as reminders, and in every daily report, until each is verified done).
3. Turn proven shadow wins into live trades (promotion rules, within their bounds).
4. Unblock profitable routes: a filter that alone blocks a route with positive net is the first thing to change.
5. Find more opportunities: a wider token universe, more venues (build requests), faster reaction to every block.
6. Cut costs: gas, flash fees (a cheaper flash-loan source is a contract change for your approval).
7. Improve the codebase itself (builder): correctness, tests, planted bugs, documentation, performance.

**Rules:**

- Equal effort on success: every cycle has a pass on what works (wins noticed and told, a playbook of the routes that cleared every rule, won or paid, and every profit policy checked), not only on what fails.
- Improve only: every change must pass its acceptance gate, or it is reverted.
- One change at a time; verify it before the next.
- Never repeat a change that failed.
- Never stop before the first verified profit.
- Hard limits always hold: funds only to your wallets, keys untouched, gas and loss caps, the profit guard, sealed code, your kill switch.

**Acceptance gate:**

- Runtime changes: after the verification window: the progress score (realized profit, shadow wins, approved routes, best net) is not lower and risk is not red.
- Code changes (the builder): every test passes, every planted bug is caught, documentation is current, the code is sealed, install simulations pass, no hard limit is touched.

**Cadence:** a decision at most every 2 h, verified after 2 h; a build request every 6 h until profit (every 24 h after); research every 12 h.
<!-- /GENERATED:charter -->

## The VP

- **Mission:** keep building and delegating until the first verified profit, without stopping.
- **Authority until the first profit: full operational control.** The VP may change any execution-policy limit and
  the trading settings listed below, each inside its safe range; run experiments; restart and reconfigure the engine;
  delegate to every department; and request builds.
- **After the first verified profit:** authority drops to limits only, by itself, and you are told.
- **How it decides:** one experiment at a time, the most direct unblocker of profit first (for example, a profit floor
  that alone blocks a route that would net money). Each change is verified after a window: kept when progress holds
  and risk stays clear, reverted when risk objects or progress falls. The same change is never tried twice.
- **What it delegates, until profit:** research every 12 hours, portal sync when rows pile up, and a build request
  every 6 hours describing what blocks profit, for the builder.

## What the VP can never do

No level of authority lifts these:

- move funds anywhere except your own configured wallets;
- touch, move or show any key;
- exceed the daily gas and loss caps, or switch off the profit guard;
- run code that is not sealed and tested;
- act while your kill switch is on (`data/live/kill`).

## Departments

<!-- GENERATED:company -->
| Department | Mandate | Watches |
| --- | --- | --- |
| Trading desk | find and size every profitable route; report what blocks the rest | scan results, indicators, fast lane |
| Risk & compliance | enforce your policies (P0, G1, T1, S0), loss and gas caps; veto unsafe changes | policy checks, mode, executor stats |
| Treasury | cash flow from receipts, tax reserve (30%), executor gas, payouts due | realized executions, balances, executor |
| Site reliability | keep nodes, feeds and the engine up; run the incident resolver; run every real check once a day | engine log, incidents, block feed, chronos verify-real |
| Data & records | keep the portal database in sync; detect database outages | sync status |
| Research | learn what wins on-chain; turn it into build requests | chronos research |
| Security | code integrity, foreign files, devices, state signatures | integrity, devices |

Settings the VP may change while it holds full control (each execution-policy key is also within its authority, inside its own bounds):

| Setting | Safe range |
| --- | --- |
| `MIN_NET_PROFIT_USD` | 0.01 – 50 |
| `MAX_SLIPPAGE_BPS` | 5 – 100 |
| `GO_MIN_USD_PER_DAY` | 0 – 1000 |
| `CHRONOS_DISCOVER_TOKENS` | 0 – 200 |
| `SCAN_QUOTE_CYCLES` | 50 – 2000 |
| `SCAN_MAX_LEGS` | 2 – 5 |
| `HOT_SCAN_MS` | 1000 – 60000 |
<!-- /GENERATED:company -->

Every cycle each department assesses its area from real state and reports green, amber or red with its figures. Risk
can veto any change while it is red. Trading and risk verify every change the VP makes. The site reliability
department runs the incident resolver ([Operations → Automatic resolution](OPERATIONS.md#automatic-resolution)).

## What reaches you

| When | What | Where |
| --- | --- | --- |
| Every day at your report time (`CHRONOS_REPORT_TIME`, default 07:30, `CHRONOS_TZ` default America/Los_Angeles) | daily report: cash flow, trading, risk, reliability, research, the VP's decisions and their verification, what needs you, department status | phone, portal (Reports), email and the "Chronos daily reports" Google Doc |
| Immediately | money made (each confirmed profitable trade), money lost (a losing trade or reverted sends), the portal database unreachable | phone, portal, webhook |
| Never on its own | everything else: the VP handles it and it appears in the next daily report | portal |

## Verification and records

Every report, decision, delegation, verification and alert is written to `data/company/journal.jsonl` on the device,
to the portal's agent activity, and to your webhook if set. Daily reports and alerts are also stored in the portal's
Reports table.

## The builder

Code changes come from the builder: a scheduled Claude session that reads the VP's latest build request and the
portal data, ships the next improvement through the [release checklist](RELEASING.md) (tests, planted bugs,
documentation, seal), and reports back. It never changes keys, funds or your contract without your approval. It needs
the code in a private repository it can push to.
