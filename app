#!/usr/bin/env bash
# Open the BeebSID Disc Creator in a browser. Vite reloads on save.
# --clean wipes generated installs/dist then bootstraps again.
# --preview serves the static dist build (no live reload).
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
if [[ "$LAUNCHER_PREVIEW" -eq 1 ]]; then
  ensure_app_dist
  exec npm run preview --prefix "$ROOT/src.app" -- --host 127.0.0.1 --port "$PORT" --open
fi
exec npm run dev --prefix "$ROOT/src.app" -- --host 127.0.0.1 --port "$PORT" --open
