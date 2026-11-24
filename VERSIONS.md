# Chronos — Consolidated Version Lineage

This branch (`chronos-consolidation`) brings every scattered copy of Chronos into **one
repository**, each copy preserved as a **complete, self-contained snapshot** under
`versions/`, in **chronological order**, oldest first. Nothing is deleted or merged
destructively — you can open any version and see the whole thing as it was.

Each version also has an annotated git tag (`v1.0.0` … `v4.0.0`) pointing at the commit that
added it, so `git diff v1.0.0 v3.0.0` (etc.) gives you the exact file-by-file difference.
`CHANGELOG.md` spells those differences out in prose.

| Version | Date | Source copy | What it is | Files* |
|--------|------|-------------|------------|-------|
| **v1.0.0** | 2026-02-24 | `Hydra-termux` GitHub repo (the base) | Termux brute-force / pen-test suite + full-stack web app | 305 |
| **v2.0.0** | 2026-10-23 | `ChronosMasterVault/repo` (Google Drive) | Broad Chronos "vault" workspace: src, arbitrage engine, agent-skill system, dig-ai, fullstack-app | 438 |
| **v3.0.0** | 2026-11-17 | `chronos_workspace_backup` (Google Drive) | Chronos arbitrage/DeFi swarm (Solana/Arbitrum), scripts + contracts | 98 |
| **v4.0.0** | 2026-11-24 | v3.0.0 + imports | Consolidated go-forward: v3 plus reusable modules pulled from the other projects | 98 + 11 |

\* Authored source files only. Vendored dependency trees (`google-cloud-sdk`, `node_modules`,
`__pycache__`, build output), secrets (`.env*`), databases (`*.db`, `*.sqlite`) and runtime logs
were **excluded on purpose** from every version — those are environment/secret material, not
part of the codebase. Exactly what was excluded is listed per version in `CHANGELOG.md`.

## The headline difference between versions

**v1 and v3 share zero files** — not one path, not one filename. The project did **not** evolve
file-by-file from Hydra-Termux into Chronos; it was a **complete rewrite into a different kind of
system**:

- **v1 (Hydra-Termux)** is a Termux-oriented brute-force / penetration-testing toolkit with a
  separate full-stack web app (`fullstack-app/` — React frontend + Node backend), Docker/nginx
  deployment, and extensive docs.
- **v3 (Chronos arb-swarm)** is a DeFi arbitrage engine: Solidity flash-arbitrage contracts
  (`contracts/`), their compiled artifacts (`artifacts/`), and ~87 Node/TS swarm scripts
  (`scripts/`) for multi-exchange/multi-chain execution, gas management, policy enforcement and
  monitoring.

**v2 is the bridge** between them — a broad "vault" workspace (src, arbitrage engine, a ~20-folder
agent/skill system, dig-ai, fullstack-app, governance policies). But the overlap is small even so:
v1↔v2 share only 3 paths and v2↔v3 only 2, each of them changed. The full file-by-file breakdown is
in `CHANGELOG.md` and `versions/DIFF_MATRIX.md`.

## What could not be retrieved

- The **194 MB `chronos_workspace_backup_1794945173.tar.gz`** (Nov 17, same day as v3) could not
  be pulled through the Google Drive connector, which only returns file contents inline and cannot
  hand over a file that large. v3 above was reconstructed instead from the **companion JSON backup**
  taken the same day, which stores every source file's text — so v3 is complete at the source level,
  but the tarball's binary payload (node_modules, compiled output) is not included.
- The **phone / Termux working copy** is not reachable from here, so if there is a copy newer than
  Nov 17, it is not represented. Say the word and tell me how to reach it.
