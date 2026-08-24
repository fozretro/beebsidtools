# robocop3 — RoboCop 3 SID replica (BeebAsm)

Byte-identical rebuild of HVSC `RoboCop_3.sid`. Song 0’s player is listed at
its runtime address `$B000` (copied from file `$2150`, `$1900` bytes). The
header stub and later packed songs are `INCBIN` blobs.

```text
original/RoboCop_3.sid    HVSC original (compare target)
src/player.asm            song 0 player (org $B000)
src/stub.bin              payload $1FC0–$214F (SID init/play + copy)
src/tail.bin              packed songs after the song 0 image
src/sid.asm               stub + player + tail → payload
bin/build.sh              assemble and cmp against original
out/                      build products (gitignored)
```

Probe/ctl scratch is not in this tree (`.tmp/robocop3/dis/`).

## Build

```bash
BEEBASM=/path/to/beebasm src.sids/robocop3/bin/build.sh
```

`beebasm` must be on `PATH`, or set `BEEBASM`. Success prints two `OK` lines:
`out/player.bin` matches the `$1900` slice at file `$2150`, and
`out/RoboCop_3.sid` matches `original/RoboCop_3.sid`.
