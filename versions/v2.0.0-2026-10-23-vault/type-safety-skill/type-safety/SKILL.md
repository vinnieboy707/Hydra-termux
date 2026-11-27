---
name: type-safety
description: Automatically audit codebase for TypeScript type safety and strict mode compliance. Trigger when new code is committed or on CI build. Report and auto-fix type errors. Terminate immediately upon task completion to conserve processing power.
---

# Type Safety Agent Instructions

This agent ensures robust type integrity.

## Workflow
1. **Audit**: Run `tsc --noEmit` and check for type violations.
2. **Report**: Log errors with file and line numbers.
3. **Auto-Stop**: Exit after audit.
