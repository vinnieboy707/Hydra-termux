#!/bin/bash
# Repository Sync Script (Patched for local config)
BASE_URL=$1
EMAIL="vdizzle707@gmail.com"
NAME="vdizzle707"

if [ -z "$BASE_URL" ]; then
  echo "Usage: ./scripts/sync_all.sh <base_remote_url>"
  exit 1
fi

REPOS=("chronos" "zero-waste-hud" "ewaste-mining-core" "asset-protection-core")

for repo in "${REPOS[@]}"; do
  echo "Syncing $repo..."
  cd "/data/data/com.termux/files/home/$repo"
  git init
  # Configure identity locally to avoid global permission errors
  git config user.email "$EMAIL"
  git config user.name "$NAME"
  git config init.defaultBranch main
  git branch -m main
  git add .
  git commit -m "Initial commit for $repo - Q>1 Ecosystem"
  git remote add origin "${BASE_URL}${repo}.git"
  git push -u origin main
done
