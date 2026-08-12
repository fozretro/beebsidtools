#!/usr/bin/env bash
# Thin wrapper — implementation lives in bin/build/ (Node).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/bin/build/build.js" "$@"
