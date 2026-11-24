#!/usr/bin/env bash
echo "=== System Status Check ==="
echo "Node version: $(node -v 2>/dev/null || echo 'Not Installed')"
echo "Python version: $(python3 -v 2>&1 | head -n 1 || echo 'Not Installed')"
echo "Data Directory contents:"
ls -lh data/
