---
name: test-beebsidtools
description: >-
  Write and run BeebSID Tools tests (Given/When/Then, goldens, jsbeeb
  SIDPLAY). Use when adding or editing *.test.js, running npm test or
  test:fast, updating goldens, or asking where player behaviour is tested.
---

# Test BeebSID Tools

Work from the repo root. Node ≥24.15. Player rebuilds need BeebAsm on
`PATH` or `BEEBASM=…`.

## Quick decision

| Goal | Command |
|------|---------|
| Default CI-shaped run | `npm test` (create + player + app) |
| Skip slow reloc / jsbeeb / optional modules | `npm run test:fast` |
| One package | `npm run test:create` / `test:player` / `test:app` |
| One file | `node --test --test-timeout=180000 src.create/test/upgrade-ssd.test.js` |
| One name | `node --test --test-timeout=180000 --test-name-pattern='Down does not' src.create/test/autoplay-preview.test.js` |
| Windows first-run `create.cmd` | `.github/workflows/windows-create.yml` (`windows-latest`, `shell: cmd`) |

`test:fast` is create unit/golden-ssd + player binary goldens only. It does
**not** boot jsbeeb (`autoplay-preview`, `golden-preview`, `golden-audio`)
and does **not** run reloc goldens.

## Where tests live

| Tree | What they prove | Engine |
|------|-----------------|--------|
| `src.create/test/*.test.js` | Convert, pack, upgrade, HVSC times, rip, reloc, jsbeeb SIDPLAY | `node --test`; jsbeeb `MachineSession` + `bootToMenu` |
| `src.player/test/` | Built `sidpl.o` / `sidpelk.o` match goldens | Byte compare. Optional ca65 modules if `SIDPLAYER_GOLDEN` is set |
| `src.app/test/` | Gallery index, HVSC list helpers, SID song counts | `node --test` (no browser) |

Player **behaviour** (keys, auto-play, menu cursor) is in
`src.create/test/autoplay-preview.test.js`, not `src.player`. Player
`test:fast` only answers “did the binary change?”.

Fixtures: `src.create/test/golden/` and `src.player/test/golden/`. Sample
discs in `discs/` are not the test SSD — that is `tunes.ssd`.

## Given / When / Then

Every `test` / `it` body comments the scenario. Same rule:
`.cursor/rules/test-given-when-then.mdc`.

```js
// Given <precondition>
// When <action>
// Then <observable result>
```

Put each comment immediately above the code it describes. Repeat When /
Then for a longer scenario. Do not skip the comments because the test
name already reads that way.

Existing preview goldens (`golden-preview.test.js`, `golden-audio.test.js`,
`golden-preview-pipeline.test.js`) are the style to copy.

## jsbeeb SIDPLAY tests

`autoplay-preview.test.js` boots `test/golden/tunes.ssd` (`B1770`),
`bootToMenu`, then `session.keyDown` / `runFor`.

| Constant | Meaning |
|----------|---------|
| `HINT_ADDR` | Mode 7 “A AUTO” (`$7C00 + 40 + 20`) |
| `TIMER_ADDR` | `AUTO MM:SS` digits (`$7C00 + 24 * 40 + 25`) |
| `AUTOPLAY_ADDR` | SIDPLAY `.autoplay` (`$606D` — from `sidpl.lst`, ORG `$6000`) |
| `LAST_MENU_ADDR` | `.last_menu_run` (`$6072`) |

Those BSS addresses stay put only if you do **not** insert labels *before*
them in `player.asm`. After a player layout change, grep the listing /
`sidpl.o` and update the constants. `keyCodes.js` is browser `keyCode`
values (`DOWN: 40`, `ENTER: 13`, …).

Not in `test:fast`. Timeouts are 90s+; use `--test-timeout=180000`.

## Goldens (only when the change is intentional)

```text
player.asm  →  npm run build:player  →  out/sidpl.o
        │
        ├─ npm run update:golden-player   →  src.player/test/golden/*.o
        └─ npm run update:golden-ssd      →  src.create/test/golden/tunes.ssd
```

```bash
npm run update:golden-reloc
npm run build:player && npm run update:golden-ssd
npm run update:golden-audio
npm run update:golden-player
```

Do not refresh a golden to silence a failure you do not understand.
After a player byte change, `tunes.ssd` and `discs/*.ssd` are a separate
step (release skill: upgrade + Gallery shots).

## Writing a new test

1. Put it in the package that owns the code (`src.create` for pipeline
   and SIDPLAY keys, `src.app` for UI helpers, `src.player` only for
   assemble-and-compare).
2. Import from that package’s `src/` (or `src.create/src/index.js`
   public API). App tests must not import `preview/node`.
3. Comment Given / When / Then before you assert.
4. Keep jsbeeb boots out of `src.create` `test:fast` (that script lists
   files explicitly).
5. Prefer the golden `tunes.ssd` (4 SIDs) over packing a throwaway disc
   unless the case needs a different catalogue.

## More context

- Run / Vite / convert: `../run-beebsidtools/SKILL.md`
- Release goldens + Gallery: `../release-beebsidtools/SKILL.md`
- Comment rule: `../../rules/test-given-when-then.mdc`
- Human summary: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (Tests)
