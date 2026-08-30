#!/usr/bin/env bash
# Assemble the $4000 / $FC20 Golden Axe player and wrap a SIDPLAY .bbcsid.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LISTING="$ROOT/../goldenaxe/src/player.asm"
OUT="$ROOT/out"
BEEBASM="${BEEBASM:-beebasm}"

if ! command -v "$BEEBASM" >/dev/null 2>&1 && [[ ! -x "$BEEBASM" ]]; then
  echo "beebasm not found ($BEEBASM)" >&2
  echo "Install BeebAsm, put it on PATH, or set BEEBASM=/path/to/beebasm" >&2
  exit 1
fi
if [[ ! -f "$LISTING" ]]; then
  echo "missing HVSC listing $LISTING" >&2
  exit 1
fi

mkdir -p "$OUT"
node "$ROOT/bin/from-listing.mjs" "$LISTING" "$OUT/player.asm"

echo "assembling player.asm…"
(
  cd "$OUT"
  "$BEEBASM" -i player.asm -v >player.lst 2>&1
) || {
  echo "FAIL: beebasm player.asm" >&2
  tail -n 40 "$OUT/player.lst" >&2
  exit 1
}

node "$ROOT/bin/reloc-data.mjs" "$OUT/player.bin"
node "$ROOT/bin/wrap.mjs" "$OUT/player.bin" "$OUT/Golden_Axe.bbcsid"
echo "OK: out/Golden_Axe.bbcsid (embedded in create)"
