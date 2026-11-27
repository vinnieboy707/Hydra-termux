#!/bin/sh
# Chronos console installer for Termux (also works on Linux/macOS). Offline: the one runtime library (ethers and
# its dependencies) ships inside this archive as vendor/deps.tgz and is checked against the seal before it is
# unpacked, so no network and no npm are needed. Your .env is only changed by autopilot/setup, with a backup first
# and permissions 600. Nothing here signs or sends a transaction.
#   sh install.sh              install, then run the autopilot (does everything that does not need you)
#   sh install.sh --no-auto    install only
#   sh install.sh --no-service do not start the background engine
#   sh install.sh --autostart  also open the dashboard whenever a new Termux session starts
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
T0=$(date +%s)
N=5
bar() { b=""; i=1; while [ $i -le $N ]; do if [ $i -le "$1" ]; then b="$b━━━━"; else b="$b────"; fi; i=$((i + 1)); done; printf '%s' "$b"; }
step() { printf '\n%s  [%d/%d] %s   %ss\n' "$(bar "$1")" "$1" "$N" "$2" "$(( $(date +%s) - T0 ))"; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required. On Termux: pkg install nodejs-lts"; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] || { echo "Node.js 18 or newer is required (found $(node -v)). On Termux: pkg install nodejs-lts"; exit 1; }
echo "◆ CHRONOS · installing into $DIR"
cd "$DIR"

step 1 "checking every file against the seal it shipped with"
if [ -f SEAL.json ]; then
  if node bin/chronos.cjs verify --install; then echo "✓ archive matches its seal"; else
    echo "✗ these files differ from the shipped seal. Re-extract the original archive before installing."; exit 1; fi
fi

step 2 "unpacking the runtime library (offline)"
if [ -f vendor/deps.tgz ]; then
  rm -rf node_modules.new && mkdir node_modules.new && tar xzf vendor/deps.tgz -C node_modules.new
  rm -rf node_modules && mv node_modules.new node_modules
  echo "✓ ethers $(node -p 'require("./node_modules/ethers/package.json").version') and its dependencies unpacked from the sealed bundle · no network used"
else
  if [ -f package-lock.json ]; then npm ci --omit=dev --prefer-offline --no-audit --no-fund --loglevel=error --no-update-notifier; else npm install --omit=dev --prefer-offline --no-audit --no-fund --loglevel=error --no-update-notifier; fi
  echo "✓ dependency installed from the lockfile (npm checks every package against its recorded hash)"
fi

step 3 "installing the chronos command"
BIN="${PREFIX:-$HOME/.local}/bin"
SH=$(command -v sh)
mkdir -p "$BIN"
printf '#!%s\nexec node "%s/bin/chronos.cjs" "$@"\n' "$SH" "$DIR" > "$BIN/chronos"
chmod 755 "$BIN/chronos"
echo "✓ command installed: $BIN/chronos"
if [ -n "$TERMUX_VERSION" ] || [ -d "$HOME/.shortcuts" ]; then
  mkdir -p "$HOME/.shortcuts"
  printf '#!%s\nexec node "%s/bin/chronos.cjs"\n' "$SH" "$DIR" > "$HOME/.shortcuts/Chronos"
  chmod 755 "$HOME/.shortcuts/Chronos"
  echo "✓ Termux:Widget shortcut: Chronos (add the Termux:Widget to your home screen to launch with one tap)"
fi
case " $* " in
  *" --autostart "*)
    if ! grep -q 'CHRONOS_AUTOSTART' "$HOME/.bashrc" 2>/dev/null; then
      printf '\n# CHRONOS_AUTOSTART: open the dashboard in new interactive sessions (quit with q to get your shell)\nif [ -t 1 ] && [ -z "$CHRONOS_SHELL" ]; then CHRONOS_SHELL=1 chronos; fi\n' >> "$HOME/.bashrc"
      echo "✓ autostart added to ~/.bashrc (remove the CHRONOS_AUTOSTART lines to undo)"
    fi ;;
esac
case ":$PATH:" in *":$BIN:"*) ;; *) echo "! add $BIN to your PATH, or run: $BIN/chronos" ;; esac

step 4 "sealing the code and the library, locking it read-only"
chmod u+w SEAL.json 2>/dev/null || true
node bin/chronos.cjs seal --yes
echo "✓ to change code on purpose: chronos unlock → edit → chronos test → chronos seal"

case " $* " in
  *" --no-auto "*) step 5 "installed (autopilot skipped)"; node bin/chronos.cjs doctor || true; echo "Next: chronos autopilot   (or chronos setup)" ;;
  *) step 5 "autopilot: keys, settings, engine, first scan"
     AUTO_ARGS=""; case " $* " in *" --no-service "*) AUTO_ARGS="--no-service" ;; esac
     node bin/chronos.cjs autopilot $AUTO_ARGS ;;
esac
