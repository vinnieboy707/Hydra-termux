#!/usr/bin/env bash
# The Google Cloud half of `chronos mainnet`, in one command in Cloud Shell (shell.cloud.google.com, already signed in):
#   1. gcp-setup.sh: the HSM executor key (Cloud KMS), its locked-down service account, your secrets in Secret
#      Manager (typed hidden), and the cloud engine VM. Prints your executor address and KMS key name.
#   2. the portal on Firebase Hosting, when chronos-portal.tgz was uploaded too.
# Uploads it uses from your home folder: chronos-console-<version>.tgz (CHRONOS_TGZ), chronos-settings.env (from
# chronos cloud-pack on your phone; optional on the first run), chronos-portal.tgz (optional).
# Safe to run again: everything is created only if missing. Usage: bash mainnet-cloud.sh [PROJECT_ID]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
[ -n "$PROJECT" ] || { echo "No Google Cloud project selected: run  gcloud config set project YOUR_PROJECT_ID  (or pass it as the first argument)."; exit 1; }
export CHRONOS_TGZ="${CHRONOS_TGZ:-$(ls -t "$HOME"/chronos-console*.tgz 2>/dev/null | head -1)}"
[ -f "${CHRONOS_TGZ:-}" ] || { echo "Upload chronos-console-<version>.tgz to Cloud Shell first (menu ⋮ → Upload)."; exit 1; }

printf '\n◆ 1/2 executor key and cloud engine (project %s)\n' "$PROJECT"
bash "$HERE/gcp-setup.sh" "$PROJECT"

printf '\n◆ 2/2 portal\n'
if [ -f "$HOME/chronos-portal.tgz" ]; then
  (cd "$HOME" && tar xzf chronos-portal.tgz && cd chronos-portal && sh deploy.sh "$PROJECT")
  echo "  Open the Hosting URL above, sign in with your email; tell Claude that email once so it is marked as the owner."
else
  echo "  skipped: chronos-portal.tgz was not uploaded (upload it and run this again to deploy the portal)."
fi
printf '\n◆ Back on your phone: chronos mainnet   (paste the executor address and KMS key name printed in step 1)\n'
