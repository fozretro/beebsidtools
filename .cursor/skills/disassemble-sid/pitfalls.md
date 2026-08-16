# SID BeebDis / PSID pitfalls (any tune)

## Layout — decide from the probe

- Many SIDs **run at the load address**. Others **copy** a player under I/O or
  BASIC. A third group relocates in place. Do not start from another tune’s
  dest or a fixed 4K size.
- One file can contain **several** packed images (later subtunes). Start with
  the image song 0 actually copies or runs. Leftover `JMP`s into another page
  at the end of a blob are often the *next* image, not this song’s code.
- `$01` banking and `$D400` SID writes are C64 facts. BeebSID I/O (`$FC20`)
  and BBC-safe work RAM belong in a later `.bbcsid` build, not in the HVSC
  compare.

## BeebDis / BeebAsm drift

- **Relative branches at ±128.** One extra EQUB before a max-range `BEQ`/`BNE`
  fails BeebAsm (`branch distance −129`). That means a split instruction, not
  a wrong target name.
- **BYTE on an operand.** A hole that starts on an immediate or address byte
  emits the opcode *and* EQUB of the same byte. Labels after that slide.
- **BRK is 2 bytes.** A `$00` pad between a JMP table and init is eaten as
  the signature; the next opcode becomes leftover EQUB. Isolate the pad with
  `BYTE <addr> 1`.
- **Exec-only holes.** A short probe of one subtune will not execute every
  path (stop/silence, other instruments). Those bytes can still be code.
  Walk from ENTRYs; do not BYTE from `!exec`.
- **Junk ENTRYs.** Promoting every BeebDis `Lxxxx` turns data tables into
  fake code. Only walked flow targets.
- **Missing abs labels.** BeebDis emits `Lxxxx` for SID/CIA/data; add
  `Lxxxx = $XXXX` before `org` if BeebAsm needs them. Do not insert `.Lxxxx`
  after a Bxx (wrong place).
- **`SAVE` name.** BeebDis writes `SAVE "player.bin"`. Rewrite to the rebuilt
  blob path before assembling.

## PSID wrap

`parsePsid`: if the header load field is 0, the payload starts with the load
address (2 bytes, little-endian). Rebuild:

```
header[0 : dataoffs] + loadaddr_le + assembled_payload
```

Forgetting `loadInData` yields `rebuilt.length === original.length - 2`.

The player slice (when there is a copy) is
`payload[copy.src - loadaddr : copy.src - loadaddr + copy.size]`.

## Tables

Name data from **this** listing’s `LDA label,X/Y` / pointer words. Freq
tables, 8-byte instruments, and `$FE`/`$FF` track bytes are common in some
players and absent in others. Do not copy another tune’s table map.
