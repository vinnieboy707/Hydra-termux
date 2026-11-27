# Releasing

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · **Releasing** · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->

<!-- GENERATED:version -->
Version **2.9.19**.
<!-- /GENERATED:version -->

Every change ships through this checklist. Steps 4 and 6 are enforced: the test suite and packaging fail when they
are skipped.

1. **Change the code**, with a one-line header comment on every new file saying what it is for.
2. **Add tests** that fail on the old behaviour. Add a planted bug to `test/mutate.cjs` for every new guardrail.
3. **Bump the version** in `package.json` (MAJOR: how trades are found or sent; MINOR: new capability; PATCH: fixes
   and reporting).
4. **Document it:** add a `## <version> — <date>` entry to `CHANGELOG.md`; update the hand-written parts of `README.md`
   and `docs/` that describe the change; run `chronos docs` to regenerate the reference sections.
5. **Verify:** `chronos test` (all pass, docs check included) and `node test/mutate.cjs "$PWD"` (every planted bug
   caught; the source is restored afterwards).
6. **Package:** `sh package.sh`. It refuses stray files and stale docs, seals the code, and prints the archive's
   sha256.
7. **Simulate:** fresh install, upgrade and the one-command path against a local chain.
8. **Publish:** put the archive in Downloads on a device allowed to publish and run the one-command installer, or run
   `chronos publish`. Approved devices are offered the update.
9. **Portal:** if the portal changed, deploy `chronos-portal.tgz` from Cloud Shell.
10. **External docs:** update the Builder Playbook document's "Chronos context and current state" section with the
    new version, test and planted-bug counts, and status.

## What a release note states

- what changed, in user terms;
- what was verified, with counts;
- what could not be verified in the build environment;
- what the owner must do (install, approve, deploy, settings), in order.

---

<!-- GENERATED:nav -->
[Project home](../README.md) · [Docs home](README.md) · [Company](COMPANY.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Commands](COMMANDS.md) · [Operations](OPERATIONS.md) · [Security](SECURITY.md) · [Testing](TESTING.md) · **Releasing** · [Server API](API.md) · [Changelog](../CHANGELOG.md)
<!-- /GENERATED:nav -->
