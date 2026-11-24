# Chronos OS // Master Synchronization & Bootstrap Guide

To run on a different terminal, server, or device and automatically download all files, align policies (`GEMINI.md`), configure environment parameters, install dependencies, and validate system health, use the following one-liner command:

## One-Liner Execution Command

```bash
curl -sSL https://raw.githubusercontent.com/vdizzle707/chronos-infrastructure-core/master/sync_and_bootstrap.sh | bash
```

Alternatively, if you already have the repository cloned or want to run it manually:

```bash
git clone https://github.com/vdizzle707/chronos-infrastructure-core.git
cd chronos-infrastructure-core
bash sync_and_bootstrap.sh
```

---

## What the Synchronization Script Does:
1. **Clones / Updates Repository:** Fetches all code files, architecture, modules, and subdirectories from the official Chronos GitHub repository.
2. **Aligns Policies & Parameters:** Ensures `GEMINI.md` foundational mandates, configuration parameters, and agent rules match the master terminal.
3. **Bootstraps Environment:** Automatically creates `.env` from `.env.example` if no `.env` exists.
4. **Installs Dependencies:** Detects `pnpm` or `npm` and installs all required Node.js packages silently.
5. **System Health Validation:** Executes system health diagnostics to verify operational readiness.
