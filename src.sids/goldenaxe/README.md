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
