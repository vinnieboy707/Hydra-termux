#!/bin/bash
echo "[DEPLOY] Starting DIG AI Production Environment..."

# Install dependencies if not present
pip install -q requests numpy jsonschema 2>/dev/null || true

# Start Services
python3 services/hydra_router.py &
HYDRA_PID=$!

python3 services/sim_monitor.py
SIM_EXIT=$?

kill $HYDRA_PID
