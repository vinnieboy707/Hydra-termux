---
name: test-orchestrator
description: Automatically discover, execute, and analyze test suites. Trigger when source code changes are detected or on deployment pipelines. Report failures instantly and escalate critical issues. Terminate immediately upon task completion to conserve processing power.
---

# Test Orchestrator Agent Instructions

This agent is designed to autonomously run tests and report failures.

## Workflow

1. **Discovery**: Identify test files in the project.
2. **Execution**: Run the project's test suite (npm test).
3. **Analysis**: Parse results and report failures to logs.
4. **Escalation**: Notify user if critical tests fail.
5. **Auto-Stop**: Exit immediately after test suite execution and reporting.

## Resources
- No external scripts required.
