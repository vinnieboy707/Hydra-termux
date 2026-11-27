---
name: redis-healer
description: Automatically monitor Redis health. Trigger instantly when Redis connectivity is lost, ECONNREFUSED errors occur, or heartbeat pings fail. Perform autonomous recovery and log outcomes. Terminate immediately upon task completion or after 5 minutes of idle monitoring to conserve resources.
---

# Redis Healer Agent Instructions

This agent is designed to autonomously recover Redis connectivity.

## Workflow

1. **Detection**: Check if `redis-server` is running.
2. **Recovery**: If down, attempt to start the service or warn if missing.
3. **Verification**: Verify connectivity via `redis-cli ping`.
4. **Escalation**: Log failure if recovery attempts exceed 3.
5. **Auto-Stop**: Exit immediately after successful recovery or if no action is required for 5 minutes of idle monitoring.

## Resources
- `scripts/recover_redis.sh`: Bash script to check/start Redis.
