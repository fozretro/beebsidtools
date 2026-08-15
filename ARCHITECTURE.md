# BeebSID Tools — Architecture & Lineage

Standalone C64 SID → BeebSID toolchain. Tests and goldens live **in this repo**.

- [How this repo got here](#how-this-repo-got-here)
  - [Who helped](#who-helped)
- [Tools](#tools)
  - [create](#create)
  - [player](#player)
  - [app](#app)
- [Create Tool Output](#create-tool-output)
  - [`.bbcsid` layout](#bbcsid-layout)
  - [Relocation parameters](#relocation-parameters)
- [How jsbeeb is used](#how-jsbeeb-is-used)
  - [Hosts](#hosts)
  - [Adding BeebSID Emulation](#adding-beebsid-emulation)
  - [Two run speeds](#two-run-speeds)
  - [Imports](#imports)
- [Do not regress](#do-not-regress)

## How this repo got here

This repo is a port of Dominic Beesley’s Stardot SIDPlayer convert/player tools into a 100% Node/JS toolchain: same relocate → rip → pack → play sequence, but in-memory so the CLI and the Disc Creator share one engine. The numbered steps are the order those pieces landed; the table below is who they came from.

1. **Shell/C path** — Stardot SIDPlayer tools: relocate with C sidreloc, patch with Python, rip, pack with dfs, play in b-em / real BeebSID hardware.
2. **JS create engine** — Port sidreloc (+ rip/pack/patches) to Node so convert is in-memory and shareable with a browser app. Goldens moved into `src.create/test/golden/`.
3. **BeebAsm player** — Port ca65 SIDPLAY to BeebAsm as `src.player`; freeze goldens against known-good images.
4. **Disc Creator app** — Vite UI over the same create API; browser preview host (no Node `MachineSession`/sharp); later BBC Micro chrome UI, `*CAT`/`*FREE` on model **B1770**, Test Disc modal.

### Who helped

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

`./create convert` runs the in-memory convert stages and writes each blob next to `-o` (default `out/<stem>/`). `convertSid` / `convertSids` return the same bytes and never touch the filesystem.

```text
pre-patch → relocate → post-patch → rip
```

A hash-selected patch may run **before** relocate (mutate the original SID; may set `relocOpts`) or **after** (mutate the relocated SID). `--no-patch` skips both but still relocates and rips. Relocate writes `.rel.sid`, `.brk`, and `.err`. Rip writes `.bbcsid` and `.vars`. `.patched.sid` appears only when a patch actually ran.

`./create ssd` / `createSsd` does that per tune, then **pack-ssd** (player + catalogue → `.ssd`) and optional **preview-ssd** (`menu.png`; WAVs with `--record-audio`).

| File | From | Use by | Contents |
|------|------|--------|----------|
| `<stem>.patched.sid` | pre- or post-patch | Relocate (pre) or rip (post); goldens | Original SID after a hash-selected patch (omitted if `--no-patch` / no match) |
| `<stem>.rel.sid` | sidreloc | Rip; goldens | Relocated PSID (load `$1A00`, SID pokes `$FC20`) |
| `<stem>.brk` | sidreloc | Rip; goldens | `----DOM:BRK:<offset>:<opcode>` list of SID **store** sites; ripsid turns these into dual-write / GATE_PULSE trampolines |
| `<stem>.err` | sidreloc stderr | Humans (debug) | Analysis + **verify**: original `$D400` vs relocated `$FC20` SID shadow. `force: true` logs mismatches instead of aborting. Pitch/pulse-width diffs are counted; filter/volume/control diffs print `Wrong SID state!`. The address in that line is **dest page + register index** (C64 `$d418` style), not `$FC20+index` — register `$18` (mode/volume) is `$FC38` on BeebSID, printed as `$fc18`. Huge `.err` files (e.g. RoboCop subtunes 6–7) are usually one volume off-by-one repeated every play frame. |
| `<stem>.bbcsid` | ripsid | Pack SSD / SIDPLAY | BBC load image — see **`.bbcsid` layout** below |
| `<stem>.vars` | ripsid | Humans (debug) | Text log of trampoline layout / addresses |

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

### Relocation parameters

`relocateStage` always calls `relocateSid` with `DEFAULT_RELOC_OPTS` (`src.create/src/stages/relocate.js`). Patches may merge extra `relocOpts` (e.g. RoboCop raises `initCycles`). Equivalent C sidreloc flags: `-f -k --page 1A --sid-dest FC20`.

| Option | Default | sidreloc flag | Meaning |
|--------|---------|---------------|---------|
| `page` | `$1A` | `--page` | First destination page for the tune (load `$1A00`) |
| `sidDest` | `$FC20` | `--sid-dest-address` | BeebSID registers (was C64 `$D400`) |
| `force` | `true` | `-f` | Log verify mismatches (pitch/volume) instead of aborting — see `.err` above |
| `keepZp` | `true` | `-k` / `--no-zp-reloc` | Leave zero-page addresses as the SID wrote them |

Zero-page is **not** remapped (`-z` / `zpFirst`–`zpLast` are unused). SIDPLAY already swaps the MOS and tune ZP around each SID call: it saves `$70`–`$FF` (`TUNE_ZP_BASE` / `TUNE_ZP_LEN` in `src.player/src/platform/bbc/player.asm`), restores the MOS copy before OS work, and keeps the tune’s own ZP live between `init` / `play` ticks. Reassigning ZP in sidreloc would fight that and break tunes that stash voice state in MOS ZP (Head Over Heels is the comment in the player).

`./create convert` (SID → `.bbcsid`, no disc) uses those same defaults. For a manual experiment you can override them; the API is `convertSid` / `convertSids({ reloc })`. A `.bbcsid` with a different `page` or `sidDest` will not run in the bundled SIDPLAY — keep the defaults for `./create ssd` and the Disc Creator.

```bash
./create convert tune.sid -o out/exp
./create convert tune.sid -o out/exp --no-keep-zp --zp=80-ff
./create convert tune.sid -o out/exp --page=1C --no-force
```

| Flag | Sets |
|------|------|
| `--page=HH` | `page` |
| `--sid-dest=HHHH` | `sidDest` |
| `--force` / `--no-force` | `force` (default on) |
| `--keep-zp` / `--no-keep-zp` | `keepZp` (default on) |
| `--zp=LO-HI` | `zpFirst`–`zpLast` (hex); only used with `--no-keep-zp` |

## How jsbeeb is used

[jsbeeb](https://github.com/mattgodbolt/jsbeeb) (Matt Godbolt) is a BBC Micro **emulator library** (`Cpu6502`, video, FDC, keyboard, sound chip, …). The same repo also ships a website ([bbc.xania.org](https://bbc.xania.org), wired in `src/main.js`) and an Electron shell — not a drop-in “BBC on a canvas” widget. This toolchain imports the library, not that website. Node ≥**24.15** matches jsbeeb 1.17.x (which already ships a patched `sharp`). Optional Electron packages are stubbed so first-run `npm install` does not pull Chromium.

The subsections below are the whole story. **Hosts** is why there are two preview machines: Node `MachineSession` for the CLI, and a browser-safe copy over `TestMachine` for the Disc Creator — same session surface, never cross-imported. **Adding BeebSID Emulation** is the SID path jsbeeb does not have: `$FC20` writes are watched, FastSID runs beside jsbeeb, and that PCM is played or recorded (not through the SN76489). **Two run speeds** is turbo `runFor` for screenshots/WAVs versus realtime Test Disc. **Imports** is the jsbeeb entry points the hosts actually call.

### Hosts

Create and the Disc Creator both need a running BBC to screenshot the SIDPLAY menu, run `*CAT`/`*FREE`, and record BeebSID audio. jsbeeb’s own `MachineSession` does that in Node (disc as a filesystem path, screenshots via sharp). The Vite app cannot import it — `fs` / sharp / the Node session leak into the browser bundle — so `preview/browser` is a second host with the same session surface: `TestMachine`, disc bytes in memory, canvas → PNG. Callers pick one (`preview/node` vs `preview/browser`) and must not cross-import.

| | Node `preview/node` | Browser `preview/browser` |
|--|---------------------|---------------------------|
| Who | CLI, create goldens/tests | Disc Creator capture + Test Disc |
| Session | `jsbeeb/machine-session` | Local `MachineSession` over `TestMachine` (no `fs` / sharp) |
| Disc | Path (buffer → temp SSD) | In-memory `Uint8Array` |
| ROMs | jsbeeb package defaults | `/jsbeeb/` via `sync:jsbeeb` |

Shared: `beebMenu.js`. Default model **`B1770`** (Acorn 1770 DFS) so `*FREE` works.

### Adding BeebSID Emulation

jsbeeb emulates the BBC SN76489 (and Music 5000). It does not emulate BeebSID. Hardware SID registers live at `$FC20`–`$FC3F` (relocated `$D400`); SIDPLAY and ripsid trampolines store there, and those writes are invisible to jsbeeb’s sound chip. FastSID is added beside jsbeeb.

**In** (from jsbeeb — CPU only):

1. Hook `processor.debugWrite.add` and keep running (`return false`). `MachineSession.addBreakpoint("write")` cannot do this — a hit calls `cpu.stop()`.
2. On `$FC20`–`$FC3F`, `poke(addr − $FC20, val)` into vendored FastSID (jsSID / VICE MOS6581 PAL) in `src.create/vendor/jsSID`.
3. Convert CPU cycle deltas (`cycleSeconds * BBC_CPU_HZ + currentCycles`, 2 MHz) into FastSID PCM samples.

**Out** (not back into jsbeeb): FastSID PCM never enters jsbeeb’s `AudioHandler` or `InstrumentedSoundChip` (that chip is still constructed so `TestMachine` will boot; it is SN76489, unused for BeebSID). Turbo capture (`recordAudio.js`) concatenates the PCM and wraps a WAV. Live Test Disc queues the same samples into a Web Audio `ScriptProcessor` connected to `audioCtx.destination` (`livePreview.js`). `createFastSid` lives in `src.create/src/preview/fastsid.js`.

### Two run speeds

- **Turbo capture** — accelerated `runFor` for menu/`*CAT`/`*FREE` PNGs and per-tune WAVs (`recordAudio.js`).
- **Live Test Disc** — same browser session, then realtime: `requestAnimationFrame` + canvas paint + keyboard (`src.app/src/livePreview.js`).

Live looks like extra plumbing because the test/headless machine is reused instead of jsbeeb’s website wiring (`AudioHandler` + canvas in `main.js`). Keys go through the session `keyDown`/`keyUp` (browser `keyCode`), not jsbeeb’s `Keyboard`. Drive samples are left as `TestMachine`’s `FakeDdNoise`. FastSID is a live variant of the same `$FC20` hook used for WAV capture. The app must not import jsbeeb — only `preview/browser`.

An iframe of bbc.xania.org would not take an in-memory SSD just built, would not map BeebSID `$FC20`, and would not honour the `B1770` preview contract.

### Imports

These jsbeeb entry points are imported from the preview hosts only (never the website `src/main.js`, never `src.app`). `SHIFT`/`DOWN`/`ENTER` live in `preview/keyCodes.js`. The methods column is the surface those hosts call.

| Import | Depend on | Used by |
|--------|-----------|---------|
| `jsbeeb/machine-session` (`MachineSession`) | <ul style="white-space:nowrap"><li>`new MachineSession(model, { discImage })`</li><li>`initialise`</li><li>`boot`</li><li>`type`</li><li>`keyDown` / `keyUp`</li><li>`reset`</li><li>`runFor`</li><li>`readMemory`</li><li>`screenshotActive`</li><li>`destroy`</li><li>`_machine.processor.debugWrite.add` (FastSID)</li><li>`_machine.processor.cycleSeconds` / `currentCycles` (FastSID)</li></ul> | Node `preview/node` |
| `jsbeeb/src/utils.js` (`setBaseUrl`) | <ul style="white-space:nowrap"><li>`setBaseUrl` (ROM fetch base `/jsbeeb/`)</li></ul> | browser session |
| `jsbeeb/tests/test-machine.js` (`TestMachine`) | <ul style="white-space:nowrap"><li>`new TestMachine(model, { video, soundChip })`</li><li>`initialise`</li><li>`runUntilInput`</li><li>`type`</li><li>`runFor`</li><li>`readbyte`</li><li>`.processor.sysvia.keyDown` / `keyUp`</li><li>`.processor.reset`</li><li>`.processor.execute`</li><li>`.processor.fdc.loadDisc`</li><li>`.processor.debugWrite`</li><li>`.processor.cycleSeconds` / `currentCycles`</li></ul> | browser `preview/browser` |
| `jsbeeb/src/models.js` (`findModel`) | <ul style="white-space:nowrap"><li>`findModel`</li><li>`.isMaster`</li><li>`.isAtom`</li></ul> | browser session |
| `jsbeeb/src/video.js` (`Video`) | <ul style="white-space:nowrap"><li>`new Video(…)` (framebuffer + paint callback)</li><li>`leftBorder`</li><li>`topBorder`</li><li>`rightBorder`</li><li>`bottomBorder`</li></ul> | browser session |
| `jsbeeb/src/soundchip.js` | <ul style="white-space:nowrap"><li>`new InstrumentedSoundChip()`</li><li>`new FakeSoundChip()` (passed into `TestMachine`; SN76489, not BeebSID)</li></ul> | browser session |
| `jsbeeb/src/fdc.js` (`discFor`) | <ul style="white-space:nowrap"><li>`discFor(fdc, name, bytes)`</li></ul> | browser session |

## Do not regress

- Mixing `preview/node` into the Vite app
- Teaching create stages about filesystem paths
- Duplicating relocate/rip in React
- Pointing create tests anywhere except `src.create/test/golden/`
- Treating jsbeeb’s hosted app as an embed (iframe bbc.xania.org) or expecting its SN76489 path to play BeebSID
- Importing jsbeeb from `src.app` (app uses `preview/browser` only)
