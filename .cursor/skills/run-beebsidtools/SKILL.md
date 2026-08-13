---
name: run-beebsidtools
description: >-
  Run and test BeebSID Tools from the CLI (./create, goldens) and the React
  Disc Creator (Vite). Use when starting the app, converting SIDs, packing
  SSDs, running npm test, updating goldens, syncing player/jsbeeb assets,
  or debugging create/preview failures.
---

# Run & test BeebSID Tools

Work from this repo root. End users: `./create` and `./app` (they install deps on first run). Node ≥24.15 (same floor as jsbeeb). Rebuilding the player from source needs BeebAsm on `PATH` or `BEEBASM=…`.

## Quick decision

| Goal | Command |
|------|---------|
| Unit/integration tests | `npm test` or `npm run test:fast` |
| Convert one SID | `./create convert path/to/tune.sid -o /tmp/out` |
| Pack SSD + menu PNG | `./create ssd path/to/*.sid -o /tmp/x.ssd --title=NAME` |
| Disc Creator UI | `./app` (`./app --clean` re-bootstraps) |
| Refresh fixtures | `npm run update:golden-*` (see below) |

Inputs are **explicit `.sid` paths** (no default input dir). Sample library: `sids/` (e.g. `sids/Head_Over_Heels.sid`). Test fixtures stay under `src.create/test/golden/`.

## Setup

`./create` and `./app` install Node packages and copy the bundled player on first run. `--clean` wipes those generated trees (and `logs/`) then bootstraps again. Rebuild the player from BeebAsm only after player source changes (`npm run build:player`).

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
./app                    # sync + Vite preview (builds dist on first run)
# http://127.0.0.1:4173
npm run dev:app          # Vite dev server (developers)
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

`./create` and `./app` log first-run work under `logs/` (gitignored). TTY only shows Building then success, or one error with the log path.

## Failure checklist

1. Missing `sidpl.o` → `./create` / `./app` copy goldens into `src.player/out/`.
2. Vite/`MachineSession` fs errors → wrong preview host import.
3. `*FREE` fails → model must be `B1770`, not `B-DFS1.2`.
4. App ROMs missing → `npm run sync --prefix src.app`.
5. Patch unexpected → check `./create patches` / `--no-patch` / SID hash.
6. First-run build failed → `logs/install-src.create.log` (`./create`) or `logs/build-app.log` (`./app`).

## More context

- End-user run: [`README.md`](../../README.md)
- Contributing (tests, goldens, API): [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
- Package boundaries: `../rules/package-boundaries.mdc`
- Preview hosts: `../rules/preview-hosts.mdc`
- Lineage: `../ARCHITECTURE.md`
