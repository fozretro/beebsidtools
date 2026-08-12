---
name: run-beebsidtools
description: >-
  Run and test BeebSID Tools from the CLI (./create, goldens) and the React
  Disc Creator (Vite). Use when starting the app, converting SIDs, packing
  SSDs, running npm test, updating goldens, syncing player/jsbeeb assets,
  or debugging create/preview failures.
---

# Run & test BeebSID Tools

Work from this repo root. Node ≥22.12. Player build needs BeebAsm on `PATH` or `BEEBASM=…`.

## Quick decision

| Goal | Command |
|------|---------|
| Unit/integration tests | `npm test` or `npm run test:fast` |
| Convert one SID | `./create convert path/to/tune.sid -o /tmp/out` |
| Pack SSD + menu PNG | `./create ssd path/to/*.sid -o /tmp/x.ssd --title=NAME` |
| React UI | `npm run build:player && npm run dev:app` → http://localhost:5173 |
| Refresh fixtures | `npm run update:golden-*` (see below) |

Inputs are **explicit `.sid` paths** (no default input dir). Sample library: `sids/` (e.g. `sids/Head_Over_Heels.sid`). Test fixtures stay under `src.create/test/golden/`.

## Setup

```bash
npm install --prefix src.create
npm install --prefix src.app          # UI only
npm run build:player                  # → src.player/out/sidpl.o
```

Rebuild the player after player source changes, before SSD CLI or app sync.

## CLI create

```bash
./create convert sids/Head_Over_Heels.sid -o /tmp/hoh
./create convert sids/Head_Over_Heels.sid --no-patch -o /tmp/hoh-nopatch
./create ssd sids/Head_Over_Heels.sid sids/Cybernoid.sid \
  -o /tmp/two.ssd --title=TWO
./create ssd sids/Cybernoid.sid -o /tmp/cyber.ssd --no-preview
./create ssd sids/Cybernoid.sid -o /tmp/cyber.ssd --record-audio
./create patches
```

- SSD create runs headless preview by default (`menu.png`; optional WAVs with `--record-audio`).
- Preview host for CLI: `preview/node` (injected inside CLI via `createSsd`).
- Equivalent: `npm run create -- convert …`

## React Disc Creator

```bash
npm run build:player
npm run dev:app          # sync:player + sync:jsbeeb, then Vite
# http://localhost:5173
npm run build:app        # static dist/
```

App must import `beebsidtools-src-create/preview/browser` (never `preview/node`).

Function keys (BBC chrome): f1 Create, f2 Download, f3 Test Disc, f9 Credits, f0 Help (versions).

## Tests

```bash
npm test                 # create + player
npm run test:fast        # skip slow reloc / optional player modules
npm run test:create
npm run test:player
```

### Update goldens (only when intentional)

```bash
npm run update:golden-reloc
npm run build:player && npm run update:golden-ssd
npm run update:golden-audio
npm run update:golden-player
```

Fixtures live under `src.create/test/golden/` and `src.player/test/golden/` (not a parent-repo `archive/`).

## Failure checklist

1. Missing `sidpl.o` → `npm run build:player` (+ app will sync on `dev:app`).
2. Vite/`MachineSession` fs errors → wrong preview host import.
3. `*FREE` fails → model must be `B1770`, not `B-DFS1.2`.
4. App ROMs/sounds missing → `npm run sync --prefix src.app`.
5. Patch unexpected → check `./create patches` / `--no-patch` / SID hash.

## More context

- Package boundaries: `../rules/package-boundaries.mdc`
- Preview hosts: `../rules/preview-hosts.mdc`
- Lineage: `../ARCHITECTURE.md`
