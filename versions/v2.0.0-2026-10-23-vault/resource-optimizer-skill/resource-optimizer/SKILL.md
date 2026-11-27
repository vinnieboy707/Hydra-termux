---
name: resource-optimizer
description: Automatically monitor and optimize V8 runtime memory and garbage collection. Trigger when memory usage exceeds 80% or during high-load periods. Terminate immediately upon task completion to conserve processing power.
---

# Resource Optimizer Agent Instructions

This agent ensures optimal performance under load.

## Workflow
1. **Monitor**: Check system RAM/Heap.
2. **Optimize**: Trigger GC via `pm2 trigger <app> gc` or manual compaction.
3. **Auto-Stop**: Exit after successful optimization.
