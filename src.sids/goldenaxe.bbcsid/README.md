# goldenaxe.bbcsid — Golden Axe assembled for SIDPLAY

Listing-built `.bbcsid` for song 0. Convert ships this image when the HVSC
hash matches (`src.create/src/patches/golden-axe.js`).

`from-listing.mjs` retargets [`../goldenaxe/src/player.asm`](../goldenaxe/src/player.asm):
`org $4000`, `SID = $FC20`. `reloc-data.mjs` rewrites **only** known
pointer high bytes (`$9x` → `$4x`). A word scan must not run: it treated
`L996B` pitch `$95,$9B` as address `$9B95` and the 60 s lists diverged.

SID stores in the 4K become JSR trampolines after the image (`$2A30`) so
SIDPLAY’s `$0720` shadow (bars / poke line) stays in sync with `$FC20`.

The 4K is assembled for `$4000` but stored at `$1A30`. Init at `$1A00`
copies it to `$4000` (OSFILE does not load a DFS file through `$4000`),
then `LDA #$01 / JMP $4000` — the HVSC stub calls the player with
`$10A4` (song 0 = `$01`). Play is `$4003`.

```bash
BEEBASM=/path/to/beebasm src.sids/goldenaxe.bbcsid/bin/build.sh
```

Writes `out/Golden_Axe.bbcsid` and refreshes the create patch + convert
golden. Pack a disc with `./create ssd` on the HVSC `.sid`.

```bash
node src.sids/goldenaxe/bin/trace-c64.mjs --seconds 60 --no-wav
node src.sids/goldenaxe/bin/trace-beeb.mjs --seconds 60 --no-wav
node src.sids/goldenaxe/bin/compare-pokes.mjs
```
