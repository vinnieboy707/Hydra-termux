#!/bin/sh
# One workspace on every device: ~/workspaces/chronos-master-workspace (your .env, docs, notes, code you work on) is
# kept identical on your laptop and both phones by Syncthing, device to device, encrypted, with no cloud copy.
# A change on one device reaches the others in seconds; the engine on each device notices a changed .env, checks it
# and restarts itself with the new settings (lib/settingswatch.cjs).
# Never synced (each device keeps its own): the device signing key (~/.chronos/device.key), the engine's data folder
# with your encrypted owner keystore, node_modules, logs, backups.
#   sh sync/workspace-sync.sh                 install + start Syncthing, share the workspace, print this device's ID
#   sh sync/workspace-sync.sh pair <ID>       share the workspace with another of your devices (run on both sides)
#   sh sync/workspace-sync.sh status          devices, folder state, last change
set -e
WS="${CHRONOS_WORKSPACE:-$HOME/workspaces/chronos-master-workspace}"
FID="chronos-workspace"
say() { printf '%s\n' "$*"; }

install_syncthing() {
  command -v syncthing >/dev/null 2>&1 && return 0
  if [ -n "$PREFIX" ] && command -v pkg >/dev/null 2>&1; then pkg install -y syncthing
  elif command -v apt-get >/dev/null 2>&1; then sudo apt-get update -qq && sudo apt-get install -y syncthing
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y syncthing
  elif command -v brew >/dev/null 2>&1; then brew install syncthing
  else say "✗ install Syncthing from https://syncthing.net/downloads/ then run this again"; exit 1; fi
}

start_syncthing() {
  if command -v systemctl >/dev/null 2>&1 && [ -z "$PREFIX" ]; then
    systemctl --user enable --now syncthing.service >/dev/null 2>&1 || true
    loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || say "  (to keep it running while logged out: sudo loginctl enable-linger $(id -un))"
  elif [ -n "$PREFIX" ]; then
    # Termux: keep it alive with the engine's wake lock; start it again at boot with Termux:Boot
    mkdir -p "$HOME/.termux/boot"
    printf '#!/data/data/com.termux/files/usr/bin/sh\ntermux-wake-lock\nsyncthing serve --no-browser >/dev/null 2>&1 &\n' > "$HOME/.termux/boot/syncthing"
    chmod 700 "$HOME/.termux/boot/syncthing"
    pgrep -f "syncthing serve" >/dev/null 2>&1 || (nohup syncthing serve --no-browser >/dev/null 2>&1 &)
  else
    pgrep -f "syncthing serve" >/dev/null 2>&1 || (nohup syncthing serve --no-browser >/dev/null 2>&1 &)
  fi
  i=0; until syncthing cli show system >/dev/null 2>&1; do i=$((i + 1)); [ $i -gt 30 ] && { say "✗ Syncthing did not start"; exit 1; }; sleep 1; done
}

ignore_list() {
  cat > "$WS/.stignore" <<'EOF'
// Chronos: never synced; each device keeps its own
(?d).DS_Store
node_modules
data
logs
*.log
.env.bak*
*.tmp
.chronos
device.key
keystore
EOF
}

case "${1:-setup}" in
  setup)
    install_syncthing; mkdir -p "$WS"; ignore_list; start_syncthing
    syncthing cli config folders list 2>/dev/null | grep -qx "$FID" || syncthing cli config folders add --id "$FID" --label "Chronos workspace" --path "$WS"
    syncthing cli config folders "$FID" fs-watcher-enabled set true >/dev/null 2>&1 || true
    syncthing cli config folders "$FID" ignore-perms set false >/dev/null 2>&1 || true
    [ -f "$WS/.env" ] && chmod 600 "$WS/.env"
    ID=$(syncthing cli show system | sed -n 's/.*"myID": *"\([^"]*\)".*/\1/p')
    say "✓ Syncthing running · sharing $WS"
    say "  this device's ID:  $ID"
    say "  on each other device run:   sh sync/workspace-sync.sh pair $ID"
    say "  and here, with that device's ID:   sh sync/workspace-sync.sh pair <its ID>"
    ;;
  pair)
    [ -n "$2" ] || { say "usage: sh sync/workspace-sync.sh pair <DEVICE-ID>"; exit 2; }
    start_syncthing
    syncthing cli config devices list 2>/dev/null | grep -qx "$2" || syncthing cli config devices add --device-id "$2" --name "chronos-$(printf %s "$2" | cut -c1-7)"
    syncthing cli config folders "$FID" devices add --device-id "$2" >/dev/null 2>&1 || true
    say "✓ the workspace is shared with $2 · it syncs as soon as both sides have paired"
    ;;
  status)
    start_syncthing
    say "devices:"; syncthing cli config devices list
    say "folder $FID:"; syncthing cli show folder-status "$FID" 2>/dev/null || syncthing cli config folders "$FID" path get
    ;;
  *) say "usage: sh sync/workspace-sync.sh [setup | pair <ID> | status]"; exit 2 ;;
esac
