#!/bin/sh
# Laptop, all in one: install this Chronos build, keep the engine running all the time (starts at boot, restarts if it
# stops, keeps running while you are logged out), and join the synced workspace.
#   sh sync/laptop-setup.sh
set -e
DIR=$(cd "$(dirname "$0")/.." && pwd)
say() { printf '%s\n' "$*"; }

say "◆ 1/3 installing Chronos from $DIR"
sh "$DIR/install.sh" --no-auto

say "◆ 2/3 always on"
command -v pm2 >/dev/null 2>&1 || npm install -g pm2 --no-audit --no-fund --loglevel=error || sudo npm install -g pm2 --no-audit --no-fund --loglevel=error
chronos service install || true
pm2 save >/dev/null 2>&1 || true
PM2=$(command -v pm2)
if command -v systemctl >/dev/null 2>&1; then
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$HOME/.config/systemd/user/chronos.service" <<EOF
[Unit]
Description=Chronos engine (pm2 resurrect)
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
Environment=PATH=$(dirname "$(command -v node)"):/usr/local/bin:/usr/bin:/bin
ExecStart=$PM2 resurrect
ExecReload=$PM2 reload all
ExecStop=$PM2 kill
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable chronos.service >/dev/null 2>&1 && say "✓ starts at boot (systemd user service: chronos)"
  loginctl enable-linger "$(id -un)" >/dev/null 2>&1 && say "✓ keeps running while you are logged out" || say "! to keep it running while logged out, run once: sudo loginctl enable-linger $(id -un)"
else
  say "! no systemd here: pm2 keeps the engine running; run 'pm2 startup' once for boot start"
fi
say "  tip: in power settings, turn off sleep while plugged in, so the engine never pauses"

say "◆ 3/3 synced workspace"
sh "$DIR/sync/workspace-sync.sh" setup

say ""
say "✓ done. Check it any time with:  chronos service status"
