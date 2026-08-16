---
name: disassemble-sid
description: >-
  Disassemble a C64 PSID/RSID by embedding CPU telemetry in Hermit jsSID,
  turning traces into a BeebDis control file, and BeebAsm-round-tripping a
  byte-identical .sid. Use when reverse-engineering any SID for BeebSID,
  writing probe.mjs / from-traces.mjs, growing a src.* replica, or emitting
  a .bbcsid from a listing.
---

# Disassemble a SID (telemetry → BeebDis → BeebAsm)

Goal: a **byte-identical** `.sid` from BeebAsm, then change maps / I/O in source
(later: `.bbcsid` via conditionals). Discover this tune’s layout from the probe.
Do not assume another SID’s org, copy dest, or image size.

Scripts (copy or run in place — do not reconstruct from `.tmp`):

| File | Role |
|------|------|
| [scripts/probe.mjs](scripts/probe.mjs) | Hermit hook → `trace.json` + player blob |
| [scripts/from-traces.mjs](scripts/from-traces.mjs) | traces → `player.ctl` → BeebDis → BeebAsm → cmp |
| [scripts/sid.symbols](scripts/sid.symbols) | `$D400` / CIA labels (copied into the work dir) |
| [scripts/known.symbols.example](scripts/known.symbols.example) | template for hand names |

```bash
node .cursor/skills/disassemble-sid/scripts/probe.mjs \
  --sid path/to/tune.sid --out .tmp/<tune>/dis
# edit .tmp/<tune>/dis/known.symbols from this probe, then:
node .cursor/skills/disassemble-sid/scripts/from-traces.mjs \
  --out .tmp/<tune>/dis --sid path/to/tune.sid
```

`--out` is the work dir (gitignored `.tmp/<tune>/dis/` is fine). Org and image
size come from `trace.copy`, not from another SID. BeebDis / BeebAsm: `PATH`
or `BEEBDIS=` / `BEEBASM=`.

One committed replica (packed, copied player): [`src.goldenaxe/`](../../../src.goldenaxe/).
Example only. Inject details: [telemetry.md](telemetry.md). Pitfalls:
[pitfalls.md](pitfalls.md). That one tune: [example-golden-axe.md](example-golden-axe.md).

## 1. Embed telemetry in Hermit

Engine: `src.app/vendor/hermit-jssid/jsSID.js`. Load it in Node `vm` with a
fake `AudioContext` and an `XMLHttpRequest` that returns the SID bytes.
`parsePsid`: `src.create/src/lib/psid.js`.

Patch the engine **before** `runInContext` so you can read RAM (`_memory`),
run one play frame (`_play`), read the frame counter (`_framecnt`), and
register `_setOnCpu(fn)` — `fn(pc, ir)` on every opcode fetch. Hook site:
immediately before `IR = memory[PC];` inside `CPU()`.

**Install the hook, then call `loadinit`.** Init (copy, bank, self-mod) is
otherwise invisible. Hermit subtunes are **0-based**. Drive `seconds * 50`
play frames (call `_play` until `_framecnt` advances).

On each fetch, record exec bits (file + runtime windows you care about),
JSR/JMP targets and hit counts, and — after `loadinit` — whether a player
image was **copied** to a new address.

**Discover the runtime org from the probe.** Two common shapes (there are others):

| What the probe shows | BeebDis `LOAD` org | Player blob |
|----------------------|--------------------|-------------|
| Play PCs stay in `[loadaddr, loadaddr+payload)` | PSID load address | Whole payload, or the executed span |
| Init copies a slice to another page, then play runs there | `copy.dest` | `payload[copy.src - loadaddr : + measured size]` |

Do not start from `$9000` or a 4K window unless this tune’s RAM dump says so.
Find a copy by matching payload bytes in RAM after init (scan, don’t only
try three dests). Measure image length from the match / exec span, not a
constant.

Write `trace.json`, `header.bin`, `payload.bin`, the player blob, and a RAM
dump of the window play actually used.

## 2. Feed traces into a BeebDis ctl

`LOAD` at the **runtime** org from step 1. If the file image was assembled
for that org, abs operands (`$D4xx`, player-page addrs) line up. Listing a
copied image at the PSID load address will mis-decode branches.

**Seeds (ENTRY starts)** — union of:

1. `known.symbols` — names you can defend from this probe (init/play at the
   PSID header addresses, plus any JMP table the dump shows)
2. `trace.jsr` / `trace.jmp` that land in the player window

A `+0` / `+3` / `+6` JMP table (init / play / stop) is common on packed
players and **not** universal. Name what this dump has.

**Do not** emit `BYTE` from exec bits alone. Code that this subtune / this
many seconds never reached is still code. BYTE-on-never-exec splits
immediates and blows relative branches.

**Do** walk official 6502 from the seeds (fall-through until BRK/RTI/RTS/JMP;
JSR continues; queue Bxx/JSR/JMP targets in-window). Then:

```text
ENTRY <seed and every walked block start>
BYTE  <every span the walk never marked>
```

`known.symbols` is the only hand-edited file. Re-run `from-traces.mjs` after
edits. Never hand-edit generated `player.asm`.

Exec bits in `trace.json` are a **check** (did init run? did play land in
the window?) — not the BYTE source.

## 3. Assemble and stay green

BeebDis → rewrite `SAVE` → BeebAsm → `cmp` rebuilt player to the extracted
blob. Rebuild the SID:

- If the player **is** the payload: wrap header + optional load word + blob.
- If the player is a **slice**: stub (bytes before the slice) + player + tail
  (bytes after), then the same wrap.

`loadInData` when the header load field is 0 (2-byte load address in the
data). `cmp` the full `.sid`.

INCBIN of the raw player blob is an allowed first green SID while the
listing is still broken.

## Hard rules

1. Never hand-edit generated asm.
2. Org = where this tune runs, from the probe — not another SID’s map.
3. Hook CPU before `loadinit`.
4. BYTE from the 6502 walk, not from “never executed”.
5. Do not harvest every BeebDis `Lxxxx` as ENTRY.
6. Rebuild PSID with the load word if `loadaddr === 0`.

## Incremental ladder

After each layer: regenerate and stay green.

| Step | Script | Into BeebDis / compare |
|-----:|--------|------------------------|
| 1 | `parsePsid` | load / init / play / `loadInData` |
| 2 | probe + RAM | runtime org; player blob bounds |
| 3 | JSR/JMP + `known.symbols` | first `ENTRY`s |
| 4 | 6502 walk | more `ENTRY`s + `BYTE` holes |
| 5 | Name tables from *this* listing’s uses | symbols only |
| 6 | Promote | `src.<tune>/` + `build.sh` cmp |
| 7 | (later) conditionals | `.bbcsid` (BeebSID I/O, load map) |

Once the listing is green, edit source. Do not pile reloc heuristics on a
tune you can assemble.

## Promote a compile tree

Copy what BeebAsm needs for **this** SID (whole payload, or stub + player +
tail). Keep probe + ctl generator in `.tmp/` until you choose to commit them.
