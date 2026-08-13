#!/usr/bin/env bash
# Open the BeebSID Disc Creator in a browser. First run installs and builds if needed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
INDEX="$ROOT/src.app/dist/index.html"
PORT="${PORT:-4173}"
# shellcheck source=scripts/ensure.sh
source "$ROOT/scripts/ensure.sh"
ensure_node
ensure_pkg src.create
ensure_pkg src.app
ensure_player
if [[ ! -f "$INDEX" ]]; then
  echo "Building Disc Creator (first run, may take a minute)…"
  npm run build:app --prefix "$ROOT"
fi
exec npm run preview --prefix "$ROOT/src.app" -- --host 127.0.0.1 --port "$PORT" --open
