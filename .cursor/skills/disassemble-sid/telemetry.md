# Hermit telemetry → BeebDis ctl

Use the scripts in [scripts/](scripts/). Run them with `--sid` and `--out`;
do not depend on a previous `.tmp` tree. Edit `known.symbols` in `--out`
for this tune only.

## Engine patches (`jsSID.js` → string replace)

| Find | Replace with |
|------|----------------|
| `var memory = new Uint8Array(65536);` | same + `this._memory = memory;` |
| `var framecnt = 1, volume = 1.0, CPUtime = 0, pPC;` | same + `this._framecnt = function(){ return framecnt; };` |
| `function CPU() //the CPU emulation for SID/PRG playback` | `this._setOnCpu = function(fn){ onCpu = fn; }; var onCpu = null;\n function CPU() …` |
| `IR = memory[PC];` | `if (onCpu) onCpu(PC, memory[PC]);\n IR = memory[PC];` |
| `function play() {` | `this._play = play;\n function play() {` |

Fail if `_memory`, `_play`, or `_setOnCpu` is missing after construct.

## Hook order

```text
player = loadJsSid(sidBytes)
player._setOnCpu((pc, ir) => { …record… })
player.loadinit(filename, subtune)     // 0-based
discover runtime window from RAM + PCs
for f in 0 .. seconds*50:
    drive _play until _framecnt advances
write trace.json + bins
```

**Copy discovery (if any):** after play, match each RAM page’s first 16 bytes
against the payload. Group pages that share the same `dest − src` delta.
Then walk **backward** a page when the file still looks like a JMP table
(`$4C … $4C`) and the probe JSR/JMP’d that page — workspace often dirties
the first 16 RAM bytes so the prefix scan misses the vector page. Deprioritize
delta-0 leftover payload still sitting at the load image. Pick the cluster
with the most play PCs. If play stays in the load range, `dest = src = loadaddr`.
Remap exec bits after the window is final.

Map `pc` → file address only after that window is known:

```text
if pc in [loadaddr, loadaddr+payloadLen):     file = pc
if pc in [copy.dest, copy.dest+copy.size):    file = copy.src + (pc - copy.dest)
```

JSR `$20` / JMP `$4C`: `target = mem[pc+1] | (mem[pc+2] << 8)`.
JMP `($6C)`: read the vector, then the target.

## `trace.json` fields

Always include `loadaddr`, `initaddr`, `playaddr`, `jsr[]`, `jmp[]` (addr +
count, decimal), exec bitmaps, and `copy` (`null` or `{src, dest, size}`).

Example **shape** (numbers are one packed tune — do not reuse them):

```json
{
  "loadaddr": 4096,
  "initaddr": 4328,
  "playaddr": 4212,
  "copy": { "src": 4336, "dest": 36864, "size": 4096 },
  "jsr": [{ "addr": 36867, "count": 750 }],
  "jmp": [{ "addr": 37135, "count": 1 }],
  "execBitsB64": "…",
  "execRuntimeB64": "…"
}
```

Also write: `header.bin`, `payload.bin`, `player_src.bin` (the extracted
image at `copy.src` for `copy.size` bytes, or the whole payload).

## `known.symbols` → first ENTRYs

Hand file. Evidence comments from **this** probe. Name init/play where the
probe actually JSRs (header trampoline and/or copied `$org+0` / `$org+3`).
Do not invent `$org+6` stop. If those addresses are **below** `LOAD`, the
copy window is short — fix `probe.mjs` / `trace.copy`, do not EQU them away.

## `from-traces.mjs` → `player.ctl`

```text
LOAD <runtime org> player_src.bin
SYMBOLS sid.symbols                 ; $D400… if this player pokes SID
SYMBOLS sampled.symbols
BYTE  <walk misses>
ENTRY <known + in-window jsr/jmp + walked block starts>
```

Walk: official 6502 sizes; stop on BRK/RTI/RTS/JMP abs/JMP (); JSR does not
stop; queue in-window flow targets. BRK is **2 bytes** — a `$00` pad after a
JMP table needs a 1-byte `BYTE` or BeebDis consumes the next opcode.

**Exec bitmaps:** confirm the hook saw init and play. Do **not** generate
`BYTE` from `!exec`.

## Cadence

| Change | Run |
|--------|-----|
| Hook, seconds, subtune, copy search | `probe.mjs` then `from-traces.mjs` |
| `known.symbols` or walk/ctl generator | `from-traces.mjs` only |
| Player window complete + SID `cmp` green | Promote to `src.sids/<tune>/` (see SKILL.md). Do not commit `.tmp`. |
