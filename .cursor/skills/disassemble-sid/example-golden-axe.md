# Worked example: Golden Axe (Jeroen Tel)

One packed HVSC player. **Do not reuse these addresses on another SID.**

Committed replica: `src.goldenaxe/` (BeebAsm only). Re-probe with the skill
scripts if you need traces again:

```bash
node .cursor/skills/disassemble-sid/scripts/probe.mjs \
  --sid src.goldenaxe/original/Golden_Axe.sid --out .tmp/goldenaxe/dis
```

## What the probe found

| Item | This tune |
|------|-----------|
| PSID load / init / play | `$1000` / `$10E8` / `$1074` |
| Copy | `$10F0` → `$9000`, size 4K |
| Vectors | `$9000` init, `$9003` play, `$9006` stop → `$90F7` silence |
| Workspace (walk miss → BYTE) | `$9063–$90F6` |
| Tables (walk miss → BYTE) | `$9849–$9FFF` |
| Other packed images | later songs at `$A000` / `$A100` (leftover `JMP $A1xx` at end of the 4K) |

`findCopy` matched 16 bytes at `$9000` after `loadinit`. Play JSR target
`$9003`. Song 0 pointers stay in `$9xxx`.

Init `ASL ASL ASL / ADC #$01` indexes *this* song table. Tables here: freq
lo/hi at `$9849`/`$98A8`; 8-byte instruments at `$9AC5`; `$FE`/`$FF` tracks.
Named from `LDA label,Y` in *this* listing.

## What went wrong before the walk

- File-org BeebDis at `$1000` (operands are `$90xx` / `$D4xx`).
- `BYTE` from 15s of song-0 exec: silence and the `$FF` path became data;
  `LDA #$00` split; `BEQ` to silence went to −129.
- BRK at `$9009` ate `LDY #$00` at `$900A`.
- Harvesting every `Lxxxx` turned `$99xx` tables into ~143 junk ENTRYs.

## BeebSID note (after the replica is green)

The listenable convert patch (`src.create/src/patches/golden-axe.js`) NOPs
`$01` banking and copies the 4K to `$4000` (BBC NMI at `$0D00`; small gap
before SIDPLAY). That is a **this-tune** RAM budget, not a default dest.
A later leftover-`$90xx` reloc sounded worse and was dropped. Next change
belongs in the listing / `.bbcsid` conditionals.
