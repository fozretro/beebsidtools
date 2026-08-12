# BeebSid Tools

Standalone toolchain for C64 SID → BeebSID: in-memory **create** pipeline,
BeebAsm **player**, and the **BeebSID Disc Creator** web UI. Tests and goldens live
inside this tree — no dependency on the parent project’s `archive/`.

```text
src.create                              src.player
.sid
  │  pre-patch (optional, by hash)
  ▼
relocate → .rel.sid + .brk
  │  post-patch (optional, by hash)
  ▼
rip → .bbcsid ─────────────────┐
                               ├── pack-ssd → .ssd → jsbeeb preview (menu.png)
                    sidpl.o ─┘

src.app = BeebSID Disc Creator (UI over create + player)
```

| Tree | Role |
|------|------|
| [`src.create/`](src.create/) | Convert + SSD pack; goldens in [`src.create/test/`](src.create/test/) |
| [`src.player/`](src.player/) | SIDPLAY / SIDPELK; goldens in [`src.player/test/`](src.player/test/) |
| [`src.app/`](src.app/) | BeebSID Disc Creator (React UI over create + player) |

## Prerequisites

- Node ≥22.12 (jsbeeb headless preview)
- [BeebAsm](https://github.com/stardot/beebasm) on `PATH`, or `BEEBASM=/path/to/beebasm` (player build only)

## Create pipeline

Create stages are in-memory (buffers in / out). [`cli.js`](src.create/src/cli.js)
handles paths and calls `createSsd({ preview })` so headless jsbeeb runs as a
pipeline stage (`menu.png`, optional audio) unless `--no-preview`.

```bash
npm install --prefix src.create
npm run build:player
npm test                 # create + player suites
npm run test:fast        # skip slow reloc / optional player modules

# Inputs are the .sid paths you pass (sample library: sids/).
./create convert sids/Head_Over_Heels.sid -o /tmp/hoh
./create convert sids/Cybernoid.sid -o /tmp/cyber
./create ssd sids/Head_Over_Heels.sid sids/Cybernoid.sid \
  -o /tmp/two.ssd --title=TWO
./create patches
# Skip hash-selected BeebSID patches (still relocates + rips):
./create convert sids/Head_Over_Heels.sid --no-patch -o /tmp/hoh-nopatch
./create ssd sids/Cybernoid.sid -o /tmp/cyber.ssd --no-preview
./create ssd sids/Cybernoid.sid -o /tmp/cyber.ssd --record-audio
```

After packing an SSD, **headless jsbeeb** (faster than realtime) captures
`menu.png` and, with `--record-audio`, short FastSID WAVs per tune
(`audio-00.wav`, …, plus `audio.wav` for the first). Use `--no-preview` to skip
the menu image. BeebSID `$FC20` → Node FastSID (vendored jsSID).

```js
import { createSsd } from "beebsidtools-src-create";
import { previewSsdStage } from "beebsidtools-src-create/preview/node";
// App: import { previewSsdStage } from "…/preview/browser";

const { ssd, preview } = await createSsd(inputs, {
  assets: { sidplay },
  preview: {
    stage: previewSsdStage({ audio: true }), // turbo menu + WAVs
  },
  onLog: (line) => console.error(line),
});
// preview.menuPng, preview.tunes[].wav
```

**BeebSID Disc Creator:** `npm run dev:app` — in-browser `createSsd` + `preview/browser`.
CLI uses `preview/node`. Static build: `npm run build:app`.

Patches may run **pre-relocate** (e.g. RoboCop play-address fix) and/or
**post-relocate** (HOH / RoboCop 3 hardware fixes).

### App API

```js
import { convertSid, createSsd } from "beebsidtools-src-create";

const { bbcSid } = await convertSid(sidBytes);

const { ssd, tunes } = await createSsd([sidA, sidB], {
  assets: { sidplay, hex },   // Buffer sidpl.o (+ optional F.HEX)
  title: "MORESIDS",
});
```

### convert CLI outputs

| File | When |
|------|------|
| `<base>.rel.sid` | always |
| `<base>.brk` / `<base>.err` | always |
| `<base>.patched.sid` | if a patch applied |
| `<base>.bbcsid` | always |
| `<base>.vars` | always |

### Refresh create goldens

```bash
npm run update:golden-reloc   # .rel.sid / .brk / .reloc.exit from JS sidreloc
npm run build:player && npm run update:golden-ssd
npm run update:golden-audio   # Head_Over_Heels.10s.wav via jsbeeb + FastSID
```

## Player

```bash
npm run build:player             # assemble → src.player/out/*.o
npm run test:player              # compare out/ to src.player/test/golden/
npm run update:golden-player     # after intentional player changes
```

See [`src.player/README.md`](src.player/README.md).

## BeebSID Disc Creator

```bash
npm run build:player
npm run sync:player --prefix src.app   # or: cd src.app && npm run sync:player
npm run dev:app                        # drag-drop SIDs → SSD + menu/audio preview
```

See [`src.app/README.md`](src.app/README.md).

## Layout

```text
beebsidtools
  create                   → src.create/src/cli.js
  sids/                    sample SIDs for manual CLI (parent repo: input/)
  src.create/
    src/                   in-memory API + cli.js
    test/golden/           SIDs, reloc/patch/rip fixtures, tunes.ssd
  src.player/
    src/                   BeebAsm SIDPLAY / SIDPELK
    test/golden/           sidpl.o, sidpelk.o
    out/                   build products (gitignored)
  src.app/                 BeebSID Disc Creator (Vite + React)
  .cursor/                 Agent rules, run/test skill, architecture notes
```

SSD packing is in-memory (`pack-ssd` / `createSsd`). Pass player binaries as
buffers (`assets.sidplay`); the CLI loads them from `src.player/out` by default.
