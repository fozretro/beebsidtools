# Shared first-run setup for ./create and ./app.
# Callers set ROOT to the repo root, then: source "$ROOT/scripts/ensure.sh"

ensure_node() {
  if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
    echo "BeebSID Tools needs Node.js 24.15 or newer (includes npm)." >&2
    echo "Install from https://nodejs.org/ then try again." >&2
    exit 1
  fi
  if ! node -e 'const [M,m]=process.versions.node.split(".").map(Number); process.exit(M>24||(M===24&&m>=15)?0:1)'; then
    echo "BeebSID Tools needs Node.js 24.15 or newer (found $(node -v))." >&2
    echo "Install from https://nodejs.org/ then try again." >&2
    exit 1
  fi
}

# Sets LAUNCHER_CLEAN, LAUNCHER_PREVIEW, and LAUNCHER_ARGS.
parse_launcher_args() {
  LAUNCHER_CLEAN=0
  LAUNCHER_PREVIEW=0
  LAUNCHER_ARGS=()
  for arg in "$@"; do
    case "$arg" in
      --clean) LAUNCHER_CLEAN=1 ;;
      --preview) LAUNCHER_PREVIEW=1 ;;
      *) LAUNCHER_ARGS+=("$arg") ;;
    esac
  done
}

# Wipe first-run artifacts so the next ensure_pkg / build bootstraps again.
ensure_clean() {
  echo "Cleaning generated files…"
  rm -rf \
    "$ROOT/src.create/node_modules" \
    "$ROOT/src.app/node_modules" \
    "$ROOT/node_modules" \
    "$ROOT/src.player/out" \
    "$ROOT/src.app/dist" \
    "$ROOT/src.app/public/jsbeeb" \
    "$ROOT/logs"
  if [[ -d "$ROOT/src.app/public/player" ]]; then
    find "$ROOT/src.app/public/player" -type f ! -name .gitkeep -delete
  fi
  echo "Cleaned."
}

# Run a command with stdout/stderr in logs/<name>. Short tty: doing → success, or one error.
run_logged() {
  local name="$1"
  local doing="$2"
  local ok="$3"
  shift 3
  local log="$ROOT/logs/$name"
  mkdir -p "$ROOT/logs"
  echo "$doing"
  {
    echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) $* ==="
    "$@"
  } >"$log" 2>&1 && echo "$ok" && return 0
  echo "Failed: $doing" >&2
  echo "See $log" >&2
  exit 1
}

ensure_pkg() {
  local dir="$1"
  if [[ ! -d "$ROOT/$dir/node_modules" ]]; then
    run_logged "install-${dir}.log" \
      "Building (first run, may take a minute)…" \
      "Build succeeded." \
      npm install --prefix "$ROOT/$dir"
  fi
}

_bootstrap_app() {
  if [[ ! -d "$ROOT/src.create/node_modules" ]]; then
    npm install --prefix "$ROOT/src.create"
  fi
  if [[ ! -d "$ROOT/src.app/node_modules" ]]; then
    npm install --prefix "$ROOT/src.app"
  fi
}

# One Building/success for ./app (create+app npm install). Vite syncs on start.
ensure_app_bootstrap() {
  if [[ -d "$ROOT/src.create/node_modules" && -d "$ROOT/src.app/node_modules" ]]; then
    return
  fi
  run_logged "build-app.log" \
    "Building (first run, may take a minute)…" \
    "Build succeeded." \
    _bootstrap_app
}

# Static `vite preview` needs dist (./app --preview).
ensure_app_dist() {
  if [[ -f "$ROOT/src.app/dist/index.html" ]]; then
    return
  fi
  run_logged "build-app.log" \
    "Building (first run, may take a minute)…" \
    "Build succeeded." \
    npm run build:app --prefix "$ROOT"
}

# Bundled goldens are enough to run; BeebAsm is only needed to rebuild the player.
ensure_player() {
  local out="$ROOT/src.player/out"
  local golden="$ROOT/src.player/test/golden"
  mkdir -p "$out"
  for name in sidpl.o sidpelk.o; do
    if [[ ! -f "$out/$name" ]]; then
      if [[ ! -f "$golden/$name" ]]; then
        echo "Missing bundled player $golden/$name" >&2
        exit 1
      fi
      cp "$golden/$name" "$out/$name"
    fi
  done
}
