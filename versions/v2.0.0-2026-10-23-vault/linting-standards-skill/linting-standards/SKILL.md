---
name: linting-standards
description: Automatically audit codebase for idiomatic consistency and lint errors. Trigger when new code is committed or on CI build. Report and auto-fix simple errors. Terminate immediately upon task completion to conserve processing power.
---

# Linting Standards Agent Instructions

This agent ensures strict code quality.

## Workflow
1. **Audit**: Run `eslint --fix` on modified files.
2. **Report**: Log remaining issues.
3. **Auto-Stop**: Exit after audit/fix.
