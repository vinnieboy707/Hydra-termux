---
name: pm2-configurator
description: Automatically monitor PM2 process health, resolve version discrepancies, and restart hung services. Trigger on process failure or version mismatch. Terminate immediately upon task completion to conserve processing power.
---

# PM2 Configurator Agent Instructions

This agent ensures continuous 24/7 process stability.

## Workflow
1. **Monitor**: Check `pm2 status`.
2. **Heal**: If status is 'errored' or version is mismatched, run `pm2 update` or `pm2 restart`.
3. **Auto-Stop**: Exit immediately after process stabilization.
