# BeebSID Tools — Architecture & Lineage

Standalone C64 SID → BeebSID toolchain. Tests and goldens live **in this repo**.

## How we got here

This repo is a port of Dominic Beesley’s Stardot SIDPlayer convert/player tools into a 100% Node/JS toolchain: same relocate → rip → pack → play sequence, but in-memory so the CLI and the Disc Creator share one engine. The numbered steps are the order we got here; the table below is who the pieces came from.

1. **Shell/C path** — Stardot SIDPlayer tools: relocate with C sidreloc, patch with Python, rip, pack with dfs, play in b-em / real BeebSID hardware.
2. **JS create engine** — Port sidreloc (+ rip/pack/patches) to Node so convert is in-memory and shareable with a browser app. Goldens moved into `src.create/test/golden/`.
3. **BeebAsm player** — Port ca65 SIDPLAY to BeebAsm as `src.player`; freeze goldens against known-good images.
4. **Disc Creator app** — Vite UI over the same create API; browser preview host (no Node `MachineSession`/sharp); later BBC Micro chrome UI, `*CAT`/`*FREE` on model **B1770**, Test Disc modal.

### Who helped us get here

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

## Tools

BeebSID Tools consist of the following.

```text
./create               run the convert CLI
./app                  run the Disc Creator in a browser
sids/                  sample SIDs for manual CLI
src.create/            convert + SSD pack + preview hosts
src.player/            BeebAsm SIDPLAY / SIDPELK
src.app/               BeebSID Disc Creator (Vite/React)
```

### create

In-memory stages: `pre-patch → relocate → post-patch → rip`, then `pack-ssd`, optional `preview-ssd`.

- **API:** `convertSid` / `convertSids` / `createSsd` / `runPipeline`
- **CLI:** only filesystem boundary (read `.sid`, write convert outputs — see below)
- **Patches:** hash-selected modules under `src/patches/`; `--no-patch` skips them but still relocates + rips
- **Exports:** `.` browser-safe; `./preview/node` vs `./preview/browser` must not be cross-imported

### player

BeebAsm port of classic SIDPLAY (BBC Mode 7) and SIDPELK (Electron). Build produces `out/sidpl.o` (+ `sidpelk.o`). Goldens byte-compare under `test/golden/`. Create/app **consume** the binary; they never assemble it.

### app

Thin UI: drag-drop SIDs → `createSsd` + `preview/browser` → download SSD, screenshots, tune WAVs, Test Disc (live jsbeeb). Sync scripts copy player binaries and jsbeeb ROMs/sounds into `public/`.

## Create Tool Output

Default directory: `out/<stem>/` (or `-o dir`). The in-memory API returns the same blobs; the CLI is what writes them.

| File | From | Use by | Contents |
|------|------|--------|----------|
| `<stem>.patched.sid` | pre- or post-patch | Relocate (pre) or rip (post); goldens | Original SID after a hash-selected patch (omitted if `--no-patch` / no match) |
| `<stem>.rel.sid` | sidreloc | Rip; goldens | Relocated PSID (load `$1A00`, SID pokes `$FC20`) |
| `<stem>.brk` | sidreloc | Rip; goldens | `----DOM:BRK:<offset>:<opcode>` list of SID **store** sites; ripsid turns these into dual-write / GATE_PULSE trampolines |
| `<stem>.err` | sidreloc stderr | Humans (debug) | Analysis + **verify**: original `$D400` vs relocated `$FC20` SID shadow. `force: true` logs mismatches instead of aborting. Pitch/pulse-width diffs are counted; filter/volume/control diffs print `Wrong SID state!`. The address in that line is **dest page + register index** (C64 `$d418` style), not `$FC20+index` — register `$18` (mode/volume) is `$FC38` on BeebSID, printed as `$fc18`. Huge `.err` files (e.g. RoboCop subtunes 6–7) are usually one volume off-by-one repeated every play frame. |
| `<stem>.bbcsid` | ripsid | Pack SSD / SIDPLAY | BBC load image — see **`.bbcsid` layout** below |
| `<stem>.vars` | ripsid | Humans (debug) | Text log of trampoline layout / addresses |

`./create ssd` also writes those per tune, plus `<name>.ssd`, and by default `menu.png` (SIDPLAY Mode 7). `--record-audio` adds per-tune WAVs.

### `.bbcsid` layout

ripsid (`src.create/src/lib/ripsid.js`) strips the PSID/RSID header and emits a BBC load image. DFS catalogue: **load `$19F8`**, **exec `$1A00`**. SIDPLAY reads the 8-byte prefix, then `JSR (TUNE_INIT)` / `JMP (TUNE_PLAY)`.

```text
$19F8  init      word (LE)     C64 init after relocate
$19FA  play      word (LE)     C64 play (0 = IRQ/NMI vector)
$19FC  songs     byte
$19FD  defsong   byte          1-based default
$19FE  brktab    word (LE)     first byte after the last trampoline
$1A00  payload                 relocated tune; optional pad if load was $1Axx with xx≠0
       trampolines             one stub per .brk store, appended after payload
       trailer                 MODE 7 title/author/release + NUL
```

Each `.brk` site in the payload is rewritten from a SID **store** (`STA/STX/STY abs` or indexed) into `JSR <stub>`. A normal stub (8 bytes) does:

1. same store to **shadow** `$0720 + (addr − $FC20)`
2. same store to **BeebSID** `$FCxx`
3. `RTS`

Stores to the three **gate/control** registers (`$FC24`, `$FC2B`, `$FC32` = SID `$D404`/`$D40B`/`$D412`) get a 22-byte stub: the dual write, then if the stored value has bit 0 clear, set `GATE_PULSE+$voice` at `$0740` so SIDPLAY can force a rising gate edge on the next play tick.

Load address must stay on page `$1A`. The `.vars` file is the ripsid log (`SID_LOAD`, `SID_INIT`, `BRK_…`).

## How jsbeeb is used

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

### Imports

We import these jsbeeb entry points (never the website `src/main.js`). The methods column is the surface we actually call.

| Import | Used by | Depend on |
|--------|---------|-----------|
| `jsbeeb/machine-session` (`MachineSession`) | Node `preview/node` | `new MachineSession(model, { discImage })`, `initialise`, `boot`, `type`, `keyDown`/`keyUp`, `reset`, `runFor`, `readMemory`, `screenshotActive`, `destroy`. FastSID also uses `session._machine.processor` (`debugWrite.add`, `cycleSeconds`, `currentCycles`). |
| `jsbeeb/src/utils.js` | both hosts | `keyCodes` (`SHIFT`, `DOWN`, `ENTER`); `setBaseUrl` (browser ROM base) |
| `jsbeeb/tests/test-machine.js` (`TestMachine`) | browser `preview/browser` | `new TestMachine(model, { video, soundChip })`, `initialise`, `runUntilInput`, `type`, `runFor`, `readbyte`. `.processor`: `sysvia.keyDown`/`keyUp`, `reset`, `execute`, `fdc.loadDisc`, `debugWrite`, `cycleSeconds`/`currentCycles`, `ddNoise` |
| `jsbeeb/src/models.js` (`findModel`) | browser session | `isMaster`, `isAtom` |
| `jsbeeb/src/video.js` (`Video`) | browser session | constructor (framebuffer + paint callback); `leftBorder`/`topBorder`/`rightBorder`/`bottomBorder` |
| `jsbeeb/src/soundchip.js` | browser session | `InstrumentedSoundChip` / `FakeSoundChip` constructors (passed into `TestMachine`; SN76489, not BeebSID) |
| `jsbeeb/src/fdc.js` (`discFor`) | browser session | `discFor(fdc, name, bytes)` |
| `jsbeeb/src/keyboard.js` (`Keyboard`) | live Test Disc | constructor, `setRunning`, `keyDown`/`keyPress`/`keyUp` |
| `jsbeeb/src/ddnoise.js` (`DdNoise`) | live Test Disc | `spinUp`/`spinDown`/`seek`/`mute`/`unmute`; `.sounds` filled after our `fetch` load |

## Do not regress

- Mixing `preview/node` into the Vite app
- Teaching create stages about filesystem paths
- Duplicating relocate/rip in React
- Pointing create tests anywhere except `src.create/test/golden/`
- Treating jsbeeb’s hosted app as an embed (iframe bbc.xania.org) or expecting its SN76489 path to play BeebSID
