#!/bin/bash
BASE_URL=$1
REPOS=("chronos" "zero-waste-hud" "ewaste-mining-core" "asset-protection-core")

for repo in "${REPOS[@]}"; do
  echo "Cleaning and pushing $repo..."
  cd "/data/data/com.termux/files/home/$repo"
  
  # Remove existing remote if it exists
  git remote remove origin 2>/dev/null
  
  # Re-add and push
  git remote add origin "${BASE_URL}${repo}.git"
  git push -u origin main --force
done
