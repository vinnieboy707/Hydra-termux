---
name: build-automation
description: Automatically monitor and trigger build pipelines. Trigger on dependency updates or code changes. Report build status and escalate critical failures. Terminate immediately upon task completion to conserve processing power.
---

# Build Automation Agent Instructions

This agent manages build pipeline stability.

## Workflow
1. **Detect**: Monitor for file system changes or git events.
2. **Build**: Run project-specific build command (e.g., `npm run build`).
3. **Report**: Log status and alert on failure.
4. **Auto-Stop**: Exit after build completion/reporting.
