#!/usr/bin/env bash
# Assemble RoboCop 3 from BeebAsm and byte-compare the original SID.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
OUT="$ROOT/out"
ORIG="$ROOT/original/RoboCop_3.sid"
BEEBASM="${BEEBASM:-beebasm}"

if ! command -v "$BEEBASM" >/dev/null 2>&1 && [[ ! -x "$BEEBASM" ]]; then
  echo "beebasm not found ($BEEBASM)" >&2
  echo "Install BeebAsm (https://github.com/stardot/beebasm), put it on PATH," >&2
  echo "or set BEEBASM=/path/to/beebasm" >&2
  exit 1
fi

mkdir -p "$OUT"
cd "$SRC"

echo "assembling player.asm…"
"$BEEBASM" -i player.asm -v >"$OUT/player.lst" 2>&1 || {
  echo "FAIL: beebasm player.asm" >&2
  tail -n 40 "$OUT/player.lst" >&2
  exit 1
}

echo "assembling sid.asm…"
"$BEEBASM" -i sid.asm -v >"$OUT/sid.lst" 2>&1 || {
  echo "FAIL: beebasm sid.asm" >&2
  tail -n 40 "$OUT/sid.lst" >&2
  exit 1
}

# PSID: copy header + the file's own load-address word + assembled payload.
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const orig = readFileSync(process.argv[1]);
const payload = readFileSync(process.argv[2]);
const outSid = process.argv[3];
const dataoffs = (orig[0x06] << 8) | orig[0x07];
const header = orig.subarray(0, dataoffs);
const loadWord = orig.subarray(dataoffs, dataoffs + 2);
writeFileSync(outSid, Buffer.concat([header, loadWord, payload]));
' "$ORIG" "$OUT/payload.bin" "$OUT/RoboCop_3.sid"

# Song 0 player: file $2150, payload offset $2150-$1FC0 = $190, size $1900.
node --input-type=module -e '
import { readFileSync } from "node:fs";
const orig = readFileSync(process.argv[1]);
const player = readFileSync(process.argv[2]);
const dataoffs = (orig[0x06] << 8) | orig[0x07];
const payload = orig.subarray(dataoffs + 2);
const off = 0x2150 - 0x1fc0;
const expect = payload.subarray(off, off + 0x1900);
if (player.length !== expect.length || !player.equals(expect)) {
  console.error("FAIL: out/player.bin != song 0 player slice in original SID");
  process.exit(1);
}
console.log("OK: out/player.bin matches original player image ($1900 @ $2150)");
' "$ORIG" "$OUT/player.bin"

if cmp -s "$OUT/RoboCop_3.sid" "$ORIG"; then
  echo "OK: out/RoboCop_3.sid matches original/RoboCop_3.sid (byte-identical)"
else
  echo "FAIL: out/RoboCop_3.sid differs from original/RoboCop_3.sid" >&2
  wc -c "$OUT/RoboCop_3.sid" "$ORIG" >&2
  exit 1
fi
