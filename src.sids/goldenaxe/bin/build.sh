#!/usr/bin/env bash
# Assemble Golden Axe from BeebAsm and byte-compare the original SID.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
OUT="$ROOT/out"
ORIG="$ROOT/original/Golden_Axe.sid"
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

# PSID v2: header[0x06] is data offset; load address $1000 is stored in the data.
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const orig = readFileSync(process.argv[1]);
const payload = readFileSync(process.argv[2]);
const outSid = process.argv[3];
const dataoffs = (orig[0x06] << 8) | orig[0x07];
const header = orig.subarray(0, dataoffs);
const sid = Buffer.concat([header, Buffer.from([0x00, 0x10]), payload]);
writeFileSync(outSid, sid);
' "$ORIG" "$OUT/payload.bin" "$OUT/Golden_Axe.sid"

# Player image sits at file $10F0 → payload offset $00F0.
node --input-type=module -e '
import { readFileSync } from "node:fs";
const orig = readFileSync(process.argv[1]);
const player = readFileSync(process.argv[2]);
const dataoffs = (orig[0x06] << 8) | orig[0x07];
const payload = orig.subarray(dataoffs + 2);
const expect = payload.subarray(0x0f0, 0x0f0 + 0x1000);
if (player.length !== expect.length || !player.equals(expect)) {
  console.error("FAIL: out/player.bin != 4K player slice in original SID");
  process.exit(1);
}
console.log("OK: out/player.bin matches original player image (4K @ \$10F0)");
' "$ORIG" "$OUT/player.bin"

if cmp -s "$OUT/Golden_Axe.sid" "$ORIG"; then
  echo "OK: out/Golden_Axe.sid matches original/Golden_Axe.sid (byte-identical)"
else
  echo "FAIL: out/Golden_Axe.sid differs from original/Golden_Axe.sid" >&2
  wc -c "$OUT/Golden_Axe.sid" "$ORIG" >&2
  exit 1
fi
