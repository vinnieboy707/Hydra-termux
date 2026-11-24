#!/usr/bin/env bash
echo "[+] Running database baseline updates via Python..."
python3 pipeline/pipeline.py

echo "[+] Starting Node.js background process..."
cd server && npm install && node index.js
