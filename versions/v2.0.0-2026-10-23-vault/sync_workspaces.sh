#!/bin/bash
set -eo pipefail

PRIMARY_REMOTE="vdizzle-drive:ChronosMasterVault"
SECONDARY_REMOTE="vinnieboy-drive:ChronosMasterVault"
LOCAL_DIR="$HOME/chronos-infrastructure-core"
VAULT_DIR="$LOCAL_DIR/google_drive_vault"
GEMINI_CONFIG_DIR="$HOME/.gemini"

echo "[$(date)] Starting streamlined multi-account workspace & Gemini synchronization..."

mkdir -p "$VAULT_DIR"

# Synchronize repository excluding logs, node_modules, git, and local build artifacts
rclone sync "$LOCAL_DIR" "$PRIMARY_REMOTE/repo" \
  --exclude "node_modules/**" \
  --exclude ".git/**" \
  --exclude "google_drive_vault/**" \
  --exclude "logs/**" \
  --exclude "*.tsbuildinfo" \
  --copy-links --update --checksum --transfers 8 || true

rclone sync "$LOCAL_DIR" "$SECONDARY_REMOTE/repo" \
  --exclude "node_modules/**" \
  --exclude ".git/**" \
  --exclude "google_drive_vault/**" \
  --exclude "logs/**" \
  --exclude "*.tsbuildinfo" \
  --copy-links --update --checksum --transfers 8 || true

# Synchronize Gemini configurations
rclone sync "$GEMINI_CONFIG_DIR" "$PRIMARY_REMOTE/gemini_config" --update --checksum || true
rclone sync "$GEMINI_CONFIG_DIR" "$SECONDARY_REMOTE/gemini_config" --update --checksum || true

# Synchronize cloud vaults between accounts for parity
rclone sync "$PRIMARY_REMOTE" "$SECONDARY_REMOTE" --update --checksum --transfers 8 || true

echo "[$(date)] Synchronization cycle completed successfully."
