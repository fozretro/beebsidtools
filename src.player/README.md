# src.player — SIDPLAY / SIDPELK (BeebAsm)

Source of truth for the BeebSID player (BeebAsm port of the classic SIDPLAY).

```text
src/
  lib/mul.asm                 shared multiply
  platform/
    bbc/                      SIDPLAY (Mode 7)
      player.asm
      resources/frame.bin, menu.bin
    elk/                      SIDPELK (Mode 5)
      player.asm
      resources/hexdigs.*     hex digit sprites
bin/build.sh                  entry → bin/build/build.js
bin/build/                    Node build infra
test/                         Golden compares (out/*.o + optional ca65 modules)
out/                          build products (gitignored)
```

## Build / test

```bash
npm run build          # BeebAsm → out/sidpl.o, out/sidpelk.o
npm test               # golden-player (+ optional ca65 module compare)
npm run test:fast      # sidpl.o / sidpelk.o goldens only
npm run update:golden-player
```

1. RLE-encodes BBC Mode 7 dumps → `out/play_screen.asm`, `out/menu_screen.asm`
2. Assembles → `out/sidpl.o`, `out/sidpelk.o`
3. Tests byte-compare against `test/golden/`

**BeebAsm:** put `beebasm` on `PATH` or set `BEEBASM=/path/to/beebasm`.  
Optional module golden: `SIDPLAYER_GOLDEN=/path/to/sidplayer` plus `ca65`/`ld65`.

## Layout notes

| Path | Role |
|------|------|
| `src/lib/` | Shared assembly |
| `src/platform/bbc/` | BBC SIDPLAY sources + Mode 7 dumps |
| `src/platform/elk/` | Electron SIDPELK sources + hex sprites |
| `test/golden/` | Committed `sidpl.o` / `sidpelk.o` |
| `out/*.asm` | Generated Mode 7 RLE (not source) |
| `out/*.o` | Linked player images |
| `out/obj/` | Transient module-compare scaffolding |

Link order matches the old ld65 line:

- **sidpl**: body → play_screen → menu_screen → mul @ `$6000`, pad `$1C00`
- **sidpelk**: body → mul @ `$4800`, pad `$1000`
