#!/usr/bin/env bash
# Chronos on Google Cloud in one script. Run it in Google Cloud Shell (shell.cloud.google.com), which is already
# signed in to your account:
#   1. On your phone: chronos cloud-pack   (writes chronos-settings.env: your settings, no secrets)
#   2. Cloud Shell menu ⋮ → Upload → chronos-console.tgz and chronos-settings.env
#   3. tar xzf chronos-console.tgz && bash chronos-console/cloud/gcp-setup.sh [PROJECT_ID]
# It is safe to run again: everything is created only if missing.
#
# What it creates, and why it is the most secure way to hold the trading key:
#   • Cloud KMS key ring "chronos" + key "executor": secp256k1, protection level HSM. The private key is generated
#     inside Google's HSMs and can never be exported; every signature is recorded in Cloud Audit Logs.
#   • Service account "chronos-engine": may ONLY sign with that one key and read its own secrets. No other access.
#   • Secret Manager: your node urls and API keys, typed here (hidden), never written to the VM's disk: the engine
#     reads them at start into memory (/run is RAM).
#   • Network "chronos-net": no inbound traffic except SSH through Google's IAP proxy. Outbound only.
#   • VM "chronos-engine" (e2-small, Debian 12, Shielded VM, us-east4 = Northern Virginia, next to the major
#     Arbitrum RPC providers) running the engine under systemd: restarts on crash, stops on integrity/setup
#     problems (exit 78), automatic security updates.
# Billable: the VM, and the HSM key version (Google lists HSM key versions at $0.003424658 per hour, about $2.50 a
# month; signing operations are fractions of a cent). Nothing here can move your funds: the executor key can only
# call your contract as an operator; profits stay in the contract, which only your owner wallet can withdraw.
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
[ -n "$PROJECT" ] || { echo "usage: bash gcp-setup.sh PROJECT_ID   (or: gcloud config set project PROJECT_ID)"; exit 1; }
REGION=us-east4; ZONE=us-east4-a
KR=chronos; KEY=executor; SA=chronos-engine; VM=chronos-engine; NET=chronos-net
SA_EMAIL="$SA@$PROJECT.iam.gserviceaccount.com"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TGZ="${CHRONOS_TGZ:-$HOME/chronos-console.tgz}"
SETTINGS="${CHRONOS_SETTINGS:-$HOME/chronos-settings.env}"
BUCKET="gs://$PROJECT-chronos-release"
N=8; i=0
step() { i=$((i + 1)); b=""; k=1; while [ $k -le $N ]; do if [ $k -le $i ]; then b="$b━━━"; else b="$b───"; fi; k=$((k + 1)); done; printf '\n%s  [%d/%d] %s\n' "$b" "$i" "$N" "$1"; }
have() { "$@" >/dev/null 2>&1; }
[ -f "$TGZ" ] || { echo "Upload chronos-console.tgz to Cloud Shell first (menu ⋮ → Upload), or set CHRONOS_TGZ=/path/to/it"; exit 1; }
gcloud config set project "$PROJECT" >/dev/null
if [ -f "$SETTINGS" ]; then
  # the settings file must hold no secrets (chronos cloud-pack never writes any); refuse it if it does
  if grep -Ev '^\s*(#|$)' "$SETTINGS" | grep -Eiv '^CHRONOS_SYNC_URL=' | grep -Eiq '^[A-Z0-9_]*(PRIVATE|SECRET|API_KEY|RPC_URL|WSS_URL|WEBHOOK|TOKEN|PASSWORD|MNEMONIC)[A-Z0-9_]*='; then
    echo "$SETTINGS contains a secret-looking line. Make it with chronos cloud-pack (settings only) and upload that."; exit 1
  fi
  CONTRACT=$(grep -E '^CHRONOS_FLASH_ARB_ADDRESS=0x[0-9a-fA-F]{40}$' "$SETTINGS" | tail -1 | cut -d= -f2 || true)
else
  echo "  ! no chronos-settings.env next to the archive: the cloud engine will start with the suggested starting values."
  echo "    For YOUR settings: run chronos cloud-pack on the phone, upload chronos-settings.env, run this again."
  CONTRACT=""
fi

step "enabling the APIs (Compute, KMS, Secret Manager, Logging)"
gcloud services enable compute.googleapis.com cloudkms.googleapis.com secretmanager.googleapis.com logging.googleapis.com iap.googleapis.com

step "HSM signing key (secp256k1, cannot be exported)"
have gcloud kms keyrings describe "$KR" --location "$REGION" || gcloud kms keyrings create "$KR" --location "$REGION"
have gcloud kms keys describe "$KEY" --keyring "$KR" --location "$REGION" || \
  gcloud kms keys create "$KEY" --keyring "$KR" --location "$REGION" --purpose asymmetric-signing --default-algorithm ec-sign-secp256k1-sha256 --protection-level hsm
KEY_VERSION="projects/$PROJECT/locations/$REGION/keyRings/$KR/cryptoKeys/$KEY/cryptoKeyVersions/1"

step "service account that can only sign with that key and read its secrets"
have gcloud iam service-accounts describe "$SA_EMAIL" || gcloud iam service-accounts create "$SA" --display-name "Chronos engine: signs with one KMS key, reads its own secrets"
gcloud kms keys add-iam-policy-binding "$KEY" --keyring "$KR" --location "$REGION" --member "serviceAccount:$SA_EMAIL" --role roles/cloudkms.signerVerifier >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA_EMAIL" --role roles/logging.logWriter --condition=None >/dev/null

step "secrets (typed here, hidden; empty = keep the current one / skip)"
put_secret() {
  local name="chronos-$1" v
  read -rsp "  $1: " v; echo
  if [ -n "$v" ]; then
    have gcloud secrets describe "$name" || gcloud secrets create "$name" --replication-policy automatic >/dev/null
    printf '%s' "$v" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    echo "    ✓ stored $1"
  fi
  if have gcloud secrets describe "$name"; then gcloud secrets add-iam-policy-binding "$name" --member "serviceAccount:$SA_EMAIL" --role roles/secretmanager.secretAccessor >/dev/null; fi
}
echo "  ARB_RPC_URL: your main Arbitrum One node url. ARB_RPC_URL_2: a node from a DIFFERENT provider (verifies"
echo "  balances at the same block, broadcasts trades twice). OPENROUTER_API_KEY: for the AI agents."
echo "  CHRONOS_WEBHOOK_URL: https webhook (Discord, Slack, ntfy…) so the cloud engine can alert your phone."
for s in ARB_RPC_URL ARB_RPC_URL_2 OPENROUTER_API_KEY CHRONOS_WEBHOOK_URL; do put_secret "$s"; done

step "release bucket (private) with this exact archive"
have gcloud storage buckets describe "$BUCKET" || gcloud storage buckets create "$BUCKET" --location "$REGION" --uniform-bucket-level-access --public-access-prevention
gcloud storage cp "$TGZ" "$BUCKET/chronos-console.tgz" >/dev/null
if [ -f "$SETTINGS" ]; then gcloud storage cp "$SETTINGS" "$BUCKET/chronos-settings.env" >/dev/null; SSHA=$(sha256sum "$SETTINGS" | cut -d' ' -f1); else SSHA=none; fi
gcloud storage buckets add-iam-policy-binding "$BUCKET" --member "serviceAccount:$SA_EMAIL" --role roles/storage.objectViewer >/dev/null
SHA=$(sha256sum "$TGZ" | cut -d' ' -f1)

step "private network: no inbound except SSH through Google IAP"
have gcloud compute networks describe "$NET" || gcloud compute networks create "$NET" --subnet-mode custom
have gcloud compute networks subnets describe "$NET-$REGION" --region "$REGION" || gcloud compute networks subnets create "$NET-$REGION" --network "$NET" --region "$REGION" --range 10.42.0.0/24
have gcloud compute firewall-rules describe "$NET-iap-ssh" || gcloud compute firewall-rules create "$NET-iap-ssh" --network "$NET" --direction INGRESS --allow tcp:22 --source-ranges 35.235.240.0/20

step "engine VM (Shielded, us-east4) running Chronos under systemd"
STARTUP=$(mktemp)
cat > "$STARTUP" <<EOF2
#!/bin/bash
# runs at every boot as root
set -e
id chronos >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/chronos --shell /usr/sbin/nologin chronos
if ! command -v node >/dev/null; then apt-get update -q && DEBIAN_FRONTEND=noninteractive apt-get install -y -q nodejs unattended-upgrades; fi
W=/opt/chronos/workspace; mkdir -p \$W && chown chronos:chronos \$W && chmod 700 \$W
if [ ! -f /opt/chronos/release.sha256 ] || [ "\$(cat /opt/chronos/release.sha256)" != "$SHA" ]; then
  gcloud storage cp "$BUCKET/chronos-console.tgz" /opt/chronos/chronos-console.tgz
  echo "$SHA  /opt/chronos/chronos-console.tgz" | sha256sum -c -
  systemctl stop chronos 2>/dev/null || true
  sudo -u chronos tar xzf /opt/chronos/chronos-console.tgz -C \$W
  cd \$W/chronos-console && sudo -u chronos HOME=/opt/chronos sh install.sh --no-auto --no-service
  echo "$SHA" > /opt/chronos/release.sha256
fi
# your settings: copied only when you upload a new chronos-settings.env, so changes you approve later are kept
if [ "$SSHA" != none ] && { [ ! -f /opt/chronos/settings.sha256 ] || [ "\$(cat /opt/chronos/settings.sha256)" != "$SSHA" ]; }; then
  gcloud storage cp "$BUCKET/chronos-settings.env" /opt/chronos/workspace/.env
  echo "$SSHA  /opt/chronos/workspace/.env" | sha256sum -c -
  chown chronos:chronos /opt/chronos/workspace/.env && chmod 600 /opt/chronos/workspace/.env
  echo "$SSHA" > /opt/chronos/settings.sha256
fi
cat > /opt/chronos/fetch-secrets.sh <<'EOF3'
#!/bin/bash
# secrets go to RAM only (/run), readable by root; systemd hands them to the engine as environment variables
set -e; umask 077; mkdir -p /run/chronos; F=/run/chronos/secrets.env; : > \$F
for k in ARB_RPC_URL ARB_RPC_URL_2 OPENROUTER_API_KEY CHRONOS_WEBHOOK_URL; do
  v=\$(gcloud secrets versions access latest --secret "chronos-\$k" 2>/dev/null || true)
  [ -n "\$v" ] && printf '%s=%s\n' "\$k" "\$v" >> \$F
done
printf 'CHRONOS_EXECUTOR_KMS_KEY=%s\n' "$KEY_VERSION" >> \$F
[ -n "$CONTRACT" ] && printf 'CHRONOS_FLASH_ARB_ADDRESS=%s\n' "$CONTRACT" >> \$F
exit 0
EOF3
chmod 700 /opt/chronos/fetch-secrets.sh
cat > /etc/systemd/system/chronos.service <<'EOF3'
[Unit]
Description=Chronos engine (shadow test + automatic live execution, Arbitrum One)
Wants=network-online.target
After=network-online.target
[Service]
User=chronos
WorkingDirectory=/opt/chronos/workspace/chronos-console
ExecStartPre=+/opt/chronos/fetch-secrets.sh
EnvironmentFile=-/run/chronos/secrets.env
Environment=ENV_FILE=/opt/chronos/workspace/.env HOME=/opt/chronos CHRONOS_DEVICE_KEY=/opt/chronos/workspace/.chronos/device.key
ExecStartPre=-/usr/bin/node bin/chronos.cjs autopilot --no-service --no-drive --no-scan
ExecStart=/usr/bin/node bin/chronos.cjs daemon
Restart=always
RestartSec=5
RestartPreventExitStatus=78
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/opt/chronos/workspace
[Install]
WantedBy=multi-user.target
EOF3
systemctl daemon-reload && systemctl enable --now chronos
EOF2
if have gcloud compute instances describe "$VM" --zone "$ZONE"; then
  gcloud compute instances add-metadata "$VM" --zone "$ZONE" --metadata-from-file startup-script="$STARTUP" >/dev/null
  gcloud compute instances reset "$VM" --zone "$ZONE" >/dev/null
else
  gcloud compute instances create "$VM" --zone "$ZONE" --machine-type e2-small --network "$NET" --subnet "$NET-$REGION" \
    --image-family debian-12 --image-project debian-cloud --boot-disk-size 20GB --service-account "$SA_EMAIL" --scopes cloud-platform \
    --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring --metadata enable-oslogin=TRUE \
    --metadata-from-file startup-script="$STARTUP" >/dev/null
fi
rm -f "$STARTUP"

step "executor address (derived from the HSM public key)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
gcloud kms keys versions get-public-key 1 --key "$KEY" --keyring "$KR" --location "$REGION" --output-file "$T/pub.pem"
mkdir -p "$T/node_modules" && tar xzf "$HERE/vendor/deps.tgz" -C "$T/node_modules"
ADDR=$(cd "$T" && node -e "const {ethers}=require('ethers');const der=Buffer.from(require('fs').readFileSync('pub.pem','utf8').replace(/-----[A-Z ]+-----|\s/g,''),'base64');console.log(ethers.computeAddress('0x'+der.subarray(der.length-65).toString('hex')))")

if [ -n "$CONTRACT" ]; then CNOTE="Contract in your settings: $CONTRACT"; else CNOTE="No contract address in chronos-settings.env yet: chronos deploy creates it; then chronos cloud-pack, upload it, and run this script again."; fi
# the cloud engine's pairing code, so you can approve the right device in your portal without opening the VM
step "waiting for the cloud engine to ask to join your portal (up to 6 minutes; Ctrl-C skips)"
PAIR=""
for i in $(seq 1 24); do
  PAIR=$(timeout 40 gcloud compute ssh "$VM" --zone "$ZONE" --tunnel-through-iap --quiet --command "sudo journalctl -u chronos --no-pager 2>/dev/null | grep -o 'pairing code [A-Z0-9]\{4\}-[A-Z0-9]\{4\}' | tail -1" 2>/dev/null | tail -1 || true)
  [ -n "$PAIR" ] && break
  sleep 15
done
if [ -n "$PAIR" ]; then PNOTE="Its $PAIR: approve \"chronos-engine\" in your portal → Devices only if the code matches."; else PNOTE="Its pairing code is not in the VM log yet (it is still starting); it shows next to \"chronos-engine\" in your portal → Devices."; fi

# backup hand-off: the two values (neither is secret) as a file your phone can run, sent to your device's Downloads
printf 'chronos set CHRONOS_EXECUTOR_ADDRESS %s\nchronos set CHRONOS_EXECUTOR_KMS_KEY %s\n' "$ADDR" "$KEY_VERSION" > "$HOME/chronos-executor.sh"
command -v cloudshell >/dev/null 2>&1 && cloudshell download "$HOME/chronos-executor.sh" >/dev/null 2>&1 || true
cat <<EOF2

━━━━━━━━━━━━━━━━━━━━━━━━  done
  Executor address (Arbitrum One): $ADDR
  KMS key version:                 $KEY_VERSION
  Engine VM:                       $VM ($ZONE) · logs: gcloud compute ssh $VM --zone $ZONE --tunnel-through-iap -- journalctl -u chronos -f

  Next, nothing to copy:
  1. In your portal → Devices, approve the new device named "chronos-engine". $PNOTE
     Until then it runs but sends no data to your portal.
  2. The cloud engine then offers this executor to your phone; your phone shows "Your cloud executor is ready".
     Tap Save it (or run: chronos executor), then: chronos mainnet  (operator + gas: costs shown, sent only on YES).
  Backup: ~/chronos-executor.sh has both values as two chronos set lines (downloaded to your device if Cloud Shell
  allows); in Termux: bash ~/storage/downloads/chronos-executor.sh
  $CNOTE
  The engine starts in SHADOW and switches to LIVE by itself once the shadow test proves profit under your rules.
EOF2
