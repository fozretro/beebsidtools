#!/usr/bin/env bash
# Open the BeebSID Disc Creator in a browser. First run installs and builds if needed.
# --clean wipes generated installs/dist then bootstraps again.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-4173}"
# shellcheck source=scripts/ensure.sh
source "$ROOT/scripts/ensure.sh"
parse_launcher_args "$@"
ensure_node
if [[ "$LAUNCHER_CLEAN" -eq 1 ]]; then
  ensure_clean
fi
ensure_player
ensure_app_bootstrap
exec npm run preview --prefix "$ROOT/src.app" -- --host 127.0.0.1 --port "$PORT" --open
