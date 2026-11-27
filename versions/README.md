# Chronos — version archive

This folder is the **archive** of every earlier scattered copy of Chronos, kept whole so the
project's history is never lost. **The live app is the repository root**, not this folder.

> **This is the `chronos-consolidation` branch.** The newest, 24/7-capable engine
> (`chronos-console` v2.9.19) now lives at the **repo root** as the working codebase; the four
> earlier copies are preserved here under `versions/`, each complete and untouched. The branch has
> not been merged — it's here for review.

## Where things are

```
/                                   ← the LIVE app: chronos-console v2.9.19 (bin, lib, test, tui, docs, server, contract…)
versions/
  v1.0.0-2026-02-24-hydra-termux/   ← the original Hydra-Termux repo, as-is (the base)
  v2.0.0-2026-10-23-vault/          ← Chronos workspace from Google Drive (ChronosMasterVault)
  v3.0.0-2026-11-17-arb-swarm/      ← Chronos arbitrage swarm (Nov 17 backup)
  v4.0.0-consolidated/              ← v3 + reusable modules imported from the other projects
  README.md       ← this file
  VERSIONS.md     ← the index: what each version is, dates, provenance, what was excluded
  CHANGELOG.md    ← the file-by-file differences between versions
  DIFF_MATRIX.md  ← the complete Added/Removed/Changed/Identical lists per step
```

The root-level app (v5 / chronos-console 2.9.19) is the version the phones and laptop actually run:
it is packaged and test-covered, and it holds **no private key in code** — trades are signed by an
HSM key in Google Cloud KMS. That is why it was chosen as the live codebase over the earlier copies.

Start with **[VERSIONS.md](VERSIONS.md)** for the overview and **[CHANGELOG.md](CHANGELOG.md)** for
exactly what differs between each version.

## How versions are tracked

Each archived copy is also an annotated git tag (`v1.0.0` … `v5.0.0`) on the commit that added it,
in chronological order. So you have two ways to see differences:

- **Side by side:** open any two folders under `versions/` (and the repo root for v5).
- **As a diff:** `git diff v1.0.0 v3.0.0 -- <path>` etc.

## Ground rules used while consolidating

- **No secrets committed.** Every `.env*`, key file, database (`*.db`/`*.sqlite`) and runtime log
  was excluded from every version; they are listed by name in `CHANGELOG.md`. Code keeps reading
  its secrets from environment variables. (v5's `.env.scanner.example` is a template only — every
  value commented out.)
- **No vendored bulk.** `node_modules`, `google-cloud-sdk`, `__pycache__`, build output and the
  vendored `vendor/deps.tgz` were excluded — they belong to a dependency install, not version
  control.
- **Nothing lost.** Copies are added, never overwritten; the base (v1) is preserved whole.
