# Chronos — consolidated repository

Every scattered copy of Chronos, brought into one place and version-tracked.

> **This is the `chronos-consolidation` branch.** It restructures the repo so that each historical
> copy lives, complete and untouched, under `versions/`. It has not been merged — it's here for you
> to review.

## Layout

```
versions/
  v1.0.0-2026-02-24-hydra-termux/   ← the base: the original Hydra-Termux repo, as-is
  v2.0.0-2026-10-23-vault/          ← Chronos workspace from Google Drive (ChronosMasterVault)
  v3.0.0-2026-11-17-arb-swarm/      ← Chronos arbitrage swarm (Nov 17 backup)
  v4.0.0-consolidated/              ← v3 + reusable modules imported from the other projects
  v5.0.0-2026-11-26-console/        ← newest engine: chronos-console 2.9.19 (packaged, tested, KMS-signed)
VERSIONS.md   ← the index: what each version is, dates, provenance, what was excluded
CHANGELOG.md  ← the file-by-file differences between versions
```

Start with **[VERSIONS.md](VERSIONS.md)** for the overview and **[CHANGELOG.md](CHANGELOG.md)** for
exactly what differs between each version.

## How versions are tracked

Each version is also an annotated git tag (`v1.0.0` … `v4.0.0`) on the commit that added it, in
chronological order. So you have two ways to see differences:

- **Side by side:** open any two folders under `versions/`.
- **As a diff:** `git diff v1.0.0 v3.0.0 -- <path>` etc.

## Ground rules used while consolidating

- **No secrets committed.** Every `.env*`, key file, database (`*.db`/`*.sqlite`) and runtime log
  was excluded from every version; they are listed by name in `CHANGELOG.md`. Code keeps reading
  its secrets from environment variables.
- **No vendored bulk.** `node_modules`, `google-cloud-sdk`, `__pycache__` and build output were
  excluded — they are not part of the codebase and belong to a dependency install, not version
  control.
- **Nothing lost.** Copies are added, never overwritten; the base (v1) is preserved whole.
