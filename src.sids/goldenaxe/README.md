# goldenaxe — Golden Axe SID replica (BeebAsm)

Byte-identical rebuild of HVSC `Golden_Axe.sid` (Jeroen Tel). The 4K player
is listed at its runtime address `$9000`; a short stub and the remaining
packed songs are `INCBIN` blobs.

```text
original/Golden_Axe.sid   HVSC original (compare target)
src/player.asm            player + song 0 data (org $9000)
src/stub.bin              payload $1000–$10EF (SID init/play + copy)
src/tail.bin              packed songs after the 4K image
src/sid.asm               stub + player + tail → payload
bin/build.sh              assemble and cmp against original
out/                      build products (gitignored)
```

## Build

```bash
# from repo root, or from this directory
BEEBASM=/path/to/beebasm src.sids/goldenaxe/bin/build.sh
```

`beebasm` must be on `PATH`, or set `BEEBASM`. Success prints two `OK` lines:
`out/player.bin` matches the 4K slice at file `$10F0`, and
`out/Golden_Axe.sid` matches `original/Golden_Axe.sid`.

## SID traces (C64 vs BeebSID)

50 Hz snapshots of the 25 SID registers, plus every store during each
`play()` (`$FC20+r` stored as the same register index as `$D400+r`).
Writes under `out/` (gitignored). Hermit plays the original; jsbeeb plays
the converted disc.

```bash
node src.sids/goldenaxe/bin/trace-c64.mjs --seconds 8
node src.sids/goldenaxe/bin/trace-beeb.mjs --seconds 8   # converts once → out/goldenaxe-beeb.ssd
node src.sids/goldenaxe/bin/compare-pokes.mjs            # per-play poke lists
node src.sids/goldenaxe/bin/compare.mjs                  # 50 Hz snapshots
```

`--skip=25` (default) ignores the first 0.5 s in the snapshot compare. Pass
`--rebuild` on the Beeb trace to convert again. WAV sidecars: `out/c64.wav`,
`out/beeb.wav`. Use `--no-wav` when you only need the poke JSON.

A listing-built SIDPLAY image (no convert/patcher) is
[`../goldenaxe.bbcsid/`](../goldenaxe.bbcsid/).
