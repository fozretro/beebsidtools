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

## jsbeeb

[jsbeeb](https://github.com/mattgodbolt/jsbeeb) (Matt Godbolt) is a BBC Micro **emulator library** (`Cpu6502`, video, FDC, keyboard, sound chip, …). The same repo also ships a website ([bbc.xania.org](https://bbc.xania.org), wired in `src/main.js`) and an Electron shell. npm `exports` expose those internals plus a Node `MachineSession` (headless/MCP) and `TestMachine` — not a drop-in “BBC on a canvas” widget.

We import the library pieces, not the website. Its emulated sound is the BBC SN76489 (plus Music 5000) — not BeebSID. Node ≥**24.15** matches jsbeeb 1.17.x (which already ships a patched `sharp`). We stub jsbeeb’s optional Electron packages so first-run `npm install` does not pull Chromium.

### Hosts

Create and the Disc Creator both need a running BBC to screenshot the SIDPLAY menu, run `*CAT`/`*FREE`, and record BeebSID audio. jsbeeb’s own `MachineSession` does that in Node (disc as a filesystem path, screenshots via sharp). The Vite app cannot import it — `fs` / sharp / the Node session leak into the browser bundle — so `preview/browser` is a second host with the same session surface: `TestMachine`, disc bytes in memory, canvas → PNG. Callers pick one (`preview/node` vs `preview/browser`) and must not cross-import.

| | Node `preview/node` | Browser `preview/browser` |
|--|---------------------|---------------------------|
| Who | CLI, create goldens/tests | Disc Creator capture + Test Disc |
| Session | `jsbeeb/machine-session` | Local `MachineSession` over `TestMachine` (no `fs` / sharp) |
| Disc | Path (buffer → temp SSD) | In-memory `Uint8Array` |
| ROMs | jsbeeb package defaults | `/jsbeeb/` via `sync:jsbeeb` |

Shared: `beebMenu.js`, FastSID poke of `$FC20`–`$FC3F` (vendored jsSID in `src.create/vendor/jsSID`). Default model **`B1770`** (Acorn 1770 DFS) so `*FREE` works.

### Two run speeds

- **Turbo capture** — accelerated `runFor` for menu/`*CAT`/`*FREE` PNGs and per-tune WAVs (`recordAudio.js`).
- **Live Test Disc** — same browser session, then realtime: `requestAnimationFrame` + canvas paint + keyboard (`src.app/src/livePreview.js`).

Live looks like extra plumbing because we reused the test/headless machine instead of jsbeeb’s website wiring (`AudioHandler` + canvas in `main.js`). `TestMachine` installs `FakeDdNoise`; jsbeeb’s sample loader uses XHR in a way that fails under Vite, so disc525 WAVs are `fetch` + `decodeAudioData` and patched onto the stub after turbo boot. FastSID is a live variant of the same `$FC20` hook used for WAV capture.

An iframe of bbc.xania.org would not take an in-memory SSD we just built, would not map BeebSID `$FC20`, and would not honour the `B1770` preview contract.

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
- Treating jsbeeb’s hosted app as an embed (iframe bbc.xania.org) or expecting its SN76489 path to play BeebSID
