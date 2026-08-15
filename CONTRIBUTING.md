# Contributing

Thanks for helping with BeebSID Tools. End-user run instructions live in
[`README.md`](README.md) (`./create` / `./app`, or `.\create.cmd` / `.\app.cmd`
on Windows). Architecture and lineage:
[`ARCHITECTURE.md`](ARCHITECTURE.md). This file is for changing
the code.

## Pull requests

- Branch from `main` and open a PR with a short description of *why*.
- Keep `src.create`, `src.player`, and `src.app` responsibilities separate (see
  below).
- Don’t commit `node_modules/`, `dist/`, `src.player/out/`, or `.tmp/`.
- Run `npm test` (or `npm run test:fast`) before you push.
- Only update goldens when the change is intentional (`npm run update:golden-*`).

## Releases

One product version (root `package.json`). Create, player, and app stay on the
same number (`npm run sync-versions`). Notes in `releases/<version>.md` are
the GitHub Release body **and** Disc Creator Help (f0).

```bash
# after writing releases/X.Y.Z.md and bumping root version
npm run sync-versions
# commit, push
npm run publish-release    # gh release create vX.Y.Z --notes-file …
```

First release is `0.1.0`. Stay on `0.x` until a disc from this tree is the
compatibility promise. See `.cursor/rules/versioning.mdc`.

## Layout

```text
create / create.cmd    convert SIDs / pack a disc (bootstraps on first run)
app / app.cmd          Disc Creator in a browser (bootstraps on first run)
sids/                  sample SIDs for manual runs
src.create/            convert + SSD pack + preview hosts
src.player/            BeebAsm SIDPLAY / SIDPELK
src.app/               BeebSID Disc Creator (Vite + React)
scripts/ensure.sh      first-run install for the Unix launchers
scripts/ensure.cmd     first-run install for the Windows launchers
```

```text
.sid
  │  pre-patch (optional, by hash)
  ▼
relocate → .rel.sid + .brk
  │  post-patch (optional, by hash)
  ▼
rip → .bbcsid ─────────────────┐
                               ├── pack-ssd → .ssd → jsbeeb preview (menu.png)
                    sidpl.o ─┘
```

| Tree | Role |
|------|------|
| [`src.create/`](src.create/) | Convert + SSD pack; goldens in [`src.create/test/`](src.create/test/) |
| [`src.player/`](src.player/) | SIDPLAY / SIDPELK; goldens in [`src.player/test/`](src.player/test/) |
| [`src.app/`](src.app/) | Thin UI over the create API |

Architecture and lineage: [`ARCHITECTURE.md`](ARCHITECTURE.md).
Relocate is a JS port of [Linus Akesson’s sidreloc](https://www.linusakesson.net/software/sidreloc/index.php)
(same flags; BeebSID defaults are page `$1A`, SID `$FC20`, force, keep-zp).

## Package boundaries

| Package | Owns | Does not own |
|---------|------|--------------|
| `src.create` | SID→`.bbcsid`→SSD pipeline, patches, preview hosts | Player build, React UI |
| `src.player` | BeebAsm player, goldens, `out/*.o` | Relocate/rip/pack, app chrome |
| `src.app` | Disc Creator UI | Pipeline logic, assembling the player |

- Create stages are buffer-only. Paths belong in `cli.js` or the app.
- The player is an injected asset (`assets.sidplay`). Create never builds it.
- App imports `beebsidtools-src-create/preview/browser` — never `preview/node`.

Details: [`.cursor/rules/package-boundaries.mdc`](.cursor/rules/package-boundaries.mdc),
[`.cursor/rules/preview-hosts.mdc`](.cursor/rules/preview-hosts.mdc).

## Tests

```bash
npm test                 # create + player
npm run test:fast        # skip slow reloc / optional player modules
npm run test:create
npm run test:player
```

Launchers copy bundled player goldens into `src.player/out/` on first run.
Rebuild from BeebAsm only if you change player source:

```bash
# BeebAsm on PATH, or BEEBASM=/path/to/beebasm
npm run build:player
npm run test:player
npm run update:golden-player   # after intentional player changes
```

See [`src.player/README.md`](src.player/README.md).

### Goldens (only when intentional)

```bash
npm run update:golden-reloc
npm run build:player && npm run update:golden-ssd
npm run update:golden-audio
npm run update:golden-player
```

Fixtures: `src.create/test/golden/` and `src.player/test/golden/`.

## Developer app server

`./app` serves the static build. For Vite HMR while editing the UI:

```bash
npm run dev:app          # http://localhost:5173
```

## Create API

CLI is the filesystem edge. Stages take buffers in / out. SSD create injects
headless jsbeeb via `createSsd({ preview })` (`menu.png`; WAVs with
`--record-audio`). `createSsd` skips a tune that fails convert (including
unpatched RSID) and packs the rest; `convertSid` / `convertSids` still throw.

```js
import { createSsd } from "beebsidtools-src-create";
import { previewSsdStage } from "beebsidtools-src-create/preview/node";
// App: import { previewSsdStage } from "…/preview/browser";

const { ssd, preview } = await createSsd(inputs, {
  assets: { sidplay },
  preview: {
    stage: previewSsdStage({ audio: true }),
  },
  onLog: (line) => console.error(line),
});
```

```js
import { convertSid, createSsd } from "beebsidtools-src-create";

const { bbcSid } = await convertSid(sidBytes);
const { ssd, tunes } = await createSsd([sidA, sidB], {
  assets: { sidplay, hex },
  title: "MORESIDS",
});
```

### `convert` outputs

| File | When |
|------|------|
| `<base>.rel.sid` | always |
| `<base>.brk` / `<base>.err` | always |
| `<base>.patched.sid` | if a patch applied |
| `<base>.bbcsid` | always |
| `<base>.vars` | always |

Patches may run pre-relocate (e.g. RoboCop play-address) and/or post-relocate
(HOH / RoboCop 3 hardware fixes). List them with `./create patches`.
