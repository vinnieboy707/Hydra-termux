---
name: concurrency-auditor
description: Automatically monitor and resolve atomic database operation conflicts or race conditions in index.js. Trigger when concurrency errors are logged. Terminate immediately upon task completion to conserve processing power.
---

# Concurrency Auditor Agent Instructions

This agent ensures ACID compliance for asynchronous operations.

## Workflow
1. **Detect**: Monitor logs for concurrency hazards.
2. **Audit**: Analyze `index.js` for non-atomic operations.
3. **Remediate**: Apply safe, atomic patterns.
4. **Auto-Stop**: Exit after successful audit/fix.
