#!/bin/sh
# Chronos in one command, on any device you approve:
#   sh -c "$(curl -fsSL https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/release)"
# 1. this device makes its own key and asks to join; you approve its pairing code in your portal → Devices
# 2. downloads the newest private release (a newer chronos-console*.tgz in Downloads is used, and published if this
#    device may publish), checks its sha256
# 3. installs or upgrades it (keeps your data), starts the engine
# 4. chronos mainnet: settings, real checks, contract v2 and executor, only what is still missing; nothing sent until YES
# 5. opens the dashboard
# Safe to run again; it is also how you update.
set -eu
BASE="${CHRONOS_RELEASE_BASE:-https://qpjbikkfkpzywyzanrgv.supabase.co/functions/v1/release}"
WS="${CHRONOS_WS:-$HOME/workspaces/chronos-master-workspace}"
TMP="${TMPDIR:-$HOME/.cache}/chronos-go"; mkdir -p "$TMP" "$WS"
say() { printf '\n◆ %s\n' "$*"; }
need() { command -v "$1" >/dev/null 2>&1 || { if command -v pkg >/dev/null 2>&1; then pkg install -y "$2"; else echo "Install $2 first (Node.js 18 or newer for node)."; exit 1; fi; }; }
need curl curl; need node nodejs; need tar tar
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || { echo "Node.js 18 or newer is needed (pkg upgrade nodejs)."; exit 1; }

say "1/5 this device"
DEV="$TMP/device.cjs"
LOCAL=$(ls -t /sdcard/Download/chronos-console*.tgz "$HOME"/storage/downloads/chronos-console*.tgz "$HOME"/Downloads/chronos-console*.tgz 2>/dev/null | head -1 || true)
# the device helper: from your installed copy, else from the archive in Downloads (first device: nothing is published
# yet), else from the newest published release
if [ -f "$WS/chronos-console/lib/device.cjs" ]; then cp "$WS/chronos-console/lib/device.cjs" "$DEV"
elif [ -n "$LOCAL" ] && tar -xzOf "$LOCAL" chronos-console/lib/device.cjs > "$DEV" 2>/dev/null && [ -s "$DEV" ]; then :
else curl -fsSL --retry 3 -o "$DEV" "$BASE?f=device.cjs" || { echo "  nothing is published yet and no chronos-console*.tgz is in Downloads: put it there and run this again."; exit 1; }; fi
D() { CHRONOS_RELEASE_BASE="$BASE" node "$DEV" "$@"; }
NAME="${CHRONOS_DEVICE_NAME:-$(uname -n 2>/dev/null || echo device)}"
# every phone is "localhost": the portal shows each one by the start of its own pairing code instead
if [ "$NAME" = "localhost" ]; then N2=$(D name 2>/dev/null) && [ -n "$N2" ] && NAME="$N2"; fi
D wait "$NAME"

say "2/5 newest release"
CUR=$( [ -f "$WS/chronos-console/package.json" ] && node -p "require('$WS/chronos-console/package.json').version" || echo 0.0.0 )
CLOUD=$(D latest "$CUR")
CV=$(printf '%s' "$CLOUD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).version||"")}catch(_){console.log("")}})')
LV=""; [ -n "$LOCAL" ] && LV=$(node -e "try{console.log(require('$DEV').archiveVersion(process.argv[1]))}catch(_){console.log('')}" "$LOCAL")
newer() { node -e "process.exit(require('$DEV').cmp(process.argv[1]||'0.0.0',process.argv[2]||'0.0.0')>0?0:1)" "$1" "$2"; }
F=""
if [ -n "$LV" ] && newer "$LV" "${CV:-0.0.0}"; then
  F="$LOCAL"; echo "  using $LOCAL (v$LV, newer than published ${CV:-none})"
  if D status | grep -q '"can_publish":true'; then D publish "$LOCAL" "published from $(uname -n 2>/dev/null || echo device)" >/dev/null && echo "  ✓ published v$LV for your other devices"; fi
elif [ -n "$CV" ]; then
  if newer "$CV" "$CUR" || [ ! -f "$WS/chronos-console/package.json" ]; then
    D download "$CV" "$TMP/chronos-console.tgz" >/dev/null; F="$TMP/chronos-console.tgz"; echo "  ✓ v$CV downloaded and sha256-verified"
  else echo "  v$CUR is the newest; nothing to download"; fi
else
  echo "  nothing published yet and no chronos-console*.tgz in Downloads."
  [ -f "$WS/chronos-console/package.json" ] || exit 1
fi

say "3/5 install"
if [ -n "$F" ]; then tar xzf "$F" -C "$WS" && (cd "$WS/chronos-console" && sh install.sh); else echo "  already installed: v$CUR"; fi
CHRONOS="node $WS/chronos-console/bin/chronos.cjs"

say "4/5 to mainnet: settings, real checks, contract v2, executor (costs shown first; nothing is sent unless you type YES)"
if [ -t 0 ]; then $CHRONOS mainnet || echo "  not finished yet (see what is left above). Run it again any time: chronos mainnet"
else echo "  no keyboard attached to this run: type  chronos mainnet  in Termux"; fi

say "5/5 dashboard"
if [ -t 0 ] && [ -t 1 ]; then echo "  q quits the dashboard; the engine keeps running in the background"; exec $CHRONOS
else echo "  open it any time: chronos"; fi
