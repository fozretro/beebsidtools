# BeebSID Tools — architecture & lineage

Standalone C64 SID → BeebSID toolchain. Tests and goldens live **in this repo**; runtime code must not depend on the parent project’s `archive/` (not present here).

## Packages

```text
create                 → src.create/src/cli.js
app                    → Disc Creator in a browser (bootstraps on first run)
sids/                  sample SIDs for manual CLI
src.create/            convert + SSD pack + preview hosts
src.player/            BeebAsm SIDPLAY / SIDPELK
src.app/               BeebSID Disc Creator (Vite/React)
```

### src.create

In-memory stages: `pre-patch → relocate → post-patch → rip`, then `pack-ssd`, optional `preview-ssd`.

- **API:** `convertSid` / `convertSids` / `createSsd` / `runPipeline`
- **CLI:** only filesystem boundary (read `.sid`, write `.rel.sid`, `.bbcsid`, `.ssd`, `menu.png`, WAVs)
- **Patches:** hash-selected modules under `src/patches/`; `--no-patch` skips them but still relocates + rips
- **Exports:** `.` browser-safe; `./preview/node` vs `./preview/browser` must not be cross-imported

### src.player

BeebAsm port of classic SIDPLAY (BBC Mode 7) and SIDPELK (Electron). Build produces `out/sidpl.o` (+ `sidpelk.o`). Goldens byte-compare under `test/golden/`. Create/app **consume** the binary; they never assemble it.

### src.app

Thin UI: drag-drop SIDs → `createSsd` + `preview/browser` → download SSD, screenshots, tune WAVs, Test Disc (live jsbeeb). Sync scripts copy player binaries and jsbeeb ROMs/sounds into `public/`.

## How we got here

1. **Archive shell/C path** — Stardot SIDPlayer tools: relocate with C sidreloc, patch with Python, rip, pack with dfs, play in b-em / real BeebSID hardware. That tree lived in the parent repo’s `archive/` (not in this workspace).
2. **JS create engine** — Port sidreloc (+ rip/pack/patches) to Node so convert is in-memory and shareable with a browser app. Goldens moved into `src.create/test/golden/`.
3. **BeebAsm player** — Port ca65 SIDPLAY to BeebAsm as `src.player`; freeze goldens against known-good images.
4. **Disc Creator app** — Vite UI over the same create API; browser preview host (no Node `MachineSession`/sharp); later BBC Micro chrome UI, `*CAT`/`*FREE` on model **B1770**, Test Disc modal.

## Preview contract (both hosts)

`captureSsdPreview` → `{ menuPng, freePng, tune0, tunes: [{ index, name, wav }] }`.

- Menu: Shift+Break → SIDPLAY Mode 7
- Disc info: BASIC → `*CAT` → `*FREE` (needs 1770 DFS)
- Audio: BeebSID `$FC20` → FastSID (vendored jsSID)

## Related people / upstream (credits context)

| Who | Role |
|-----|------|
| [Dominic Beesley](https://stardot.org.uk/forums/viewtopic.php?p=145147#p145147) | SIDPlayer, ripsid, dfs |
| Linus Akesson | sidreloc |
| Andrew Fawcett - !FOZ! | sidreloc JS port, BeebAsm player, Disc Creator |
| Matt Godbolt | jsbeeb |
| jhohertz | jsSID FastSID |
| Ben Harris | Bedstead (MODE 7 font) |
| Ian Piumarta | 6502 CPU core (sidreloc) |
| Stardot / BeebAsm | BBC assembler toolchain |

## Do not regress

- Mixing `preview/node` into the Vite app
- Teaching create stages about filesystem paths
- Duplicating relocate/rip in React
- Pointing create tests at a parent-repo `archive/output` instead of `src.create/test/golden/`
