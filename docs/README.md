# Chronos documentation

<!-- GENERATED:nav -->
[Project home](../README.md) · **Docs home** · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

Chronos is a mainnet-only, fail-closed flash-loan arbitrage engine for Arbitrum One. It finds loops across
decentralised exchanges, proves each one with a simulation of your own contract's exact call, and sends only when your
rules allow it. These documents describe how it works, how to run it, and how it is kept safe.

| Document | Read it to |
| --- | --- |
| [Company](COMPANY.md) | see who runs what: your VP, its departments, what reaches you and when |
| [Architecture](ARCHITECTURE.md) | understand the parts, how data flows, and where the trust boundaries are |
| [Configuration](CONFIGURATION.md) | look up every setting, policy and key (generated from the code) |
| [Commands](COMMANDS.md) | look up every `chronos` command (generated from the code) |
| [Operations](OPERATIONS.md) | install, update, run, monitor, troubleshoot, roll back, respond to incidents |
| [Security](SECURITY.md) | see how keys, devices, data and money are protected, and what is not yet verified |
| [Testing](TESTING.md) | see what is tested, how, and what no test here can reach (counts generated) |
| [Releasing](RELEASING.md) | ship a change: the checklist every release follows |
| [Changelog](../CHANGELOG.md) | see what changed in each version |

## Your journey, start to profit

Follow these in order. Each step links to the section that covers it; every page links back here.

| # | You want to | Go to |
| --- | --- | --- |
| 1 | Install Chronos on a device (one command; then `chronos mainnet` walks every step below in order) | [Operations → First-time setup](OPERATIONS.md#first-time-setup-in-order) |
| 2 | Approve that device | [Security → Devices and releases](SECURITY.md#devices-and-releases) |
| 3 | Keep the engine running on your phone (`chronos phone`) | [Operations → Keeping the engine running](OPERATIONS.md#keeping-the-engine-running-on-your-phone) |
| 4 | Enter keys and settings | [Configuration → Where settings live](CONFIGURATION.md#where-settings-live) · [Keys and secrets](CONFIGURATION.md#keys-and-secrets) · [Advanced and platform variables](CONFIGURATION.md#advanced-and-platform-variables) |
| 5 | Check everything against the real systems (`chronos verify-real`) | [Testing → Stand-ins and their real counterparts](TESTING.md#stand-ins-and-their-real-counterparts) |
| 6 | Create the executor's signing key and the cloud engine | [Security → Keys and custody](SECURITY.md#keys-and-custody) |
| 7 | Deploy and set up your contract | [Commands](COMMANDS.md) (`chronos deploy`) · [Deploy policy](CONFIGURATION.md#deploy-policy) · [Moving to contract v2](OPERATIONS.md#moving-to-contract-v2) |
| 8 | Understand what the scanner does | [Architecture → Components](ARCHITECTURE.md#components) |
| 9 | Watch it work, through your VP | [Company → What reaches you](COMPANY.md#what-reaches-you) · [Operations → Daily operation](OPERATIONS.md#daily-operation) |
| 10 | Know when it trades for real | [Configuration → Execution policy](CONFIGURATION.md#execution-policy) |
| 11 | Take your profit | [Security → Money](SECURITY.md#money) · [Commands](COMMANDS.md) (`chronos payout`) |
| 12 | Stay up to date (automatic on your phone) | [Operations → Updating](OPERATIONS.md#updating) · [Changelog](../CHANGELOG.md) |
| 13 | Fix a problem, any time | run `chronos assist` (add `--fix` to apply the safe fixes) · [Automatic resolution](OPERATIONS.md#automatic-resolution) · [Troubleshooting](OPERATIONS.md#troubleshooting) · [Rollback](OPERATIONS.md#rollback) · [Incident response](OPERATIONS.md#incident-response) |
| 14 | Know the server side: routes and database | [Server API and database](API.md) |
| 15 | Change the code | [Releasing](RELEASING.md) · [Testing](TESTING.md) |

When you finish step 12, you are back at step 7: watching it work. [Back to the top](#chronos-documentation).

## How these documents stay current

Reference sections (settings, policies, keys, commands, modules, test counts, version) are generated from the code
between `GENERATED` markers. `chronos docs` rewrites them. `chronos docs --check` runs in the test suite and in
packaging, and fails when:

- any document is out of date with the code,
- a source file has no one-line header saying what it is for,
- `CHANGELOG.md` has no entry for the current version,
- a test file exists that the test runner does not run,
- any page lacks its navigation back home, or any link or section anchor in the docs does not resolve.

A change cannot be packaged until its documentation is current.

---

<!-- GENERATED:nav -->
[Project home](../README.md) · **Docs home** · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · [Releasing](RELEASING.md) · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
