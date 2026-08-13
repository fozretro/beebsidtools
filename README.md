# BeebSID Tools

Standalone 100% Node.js toolchain for C64 SID → BeebSID: a port of
Dominic Beesley's original convert/player tools. In-memory **create**
pipeline, BeebAsm **player**, and the **BeebSID Disc Creator** web UI.
You can listen to converted SIDs here through jsbeeb + FastSID emulation.
Playing on physical hardware needs a BeebSID on the BBC Micro's 1MHz bus,
or a Pi1MHz with BeebSID emulation enabled.

## Credits

The original BeebSID convert/player toolchain was shared by **Dominic Beesley**
on Stardot ([SID — an idiots guide?](https://stardot.org.uk/forums/viewtopic.php?p=145147#p145147)).

| Who | Role |
|-----|------|
| [Dominic Beesley](https://stardot.org.uk/forums/viewtopic.php?p=145147#p145147) | SIDPlayer, ripsid, dfs |
| Linus Akesson | sidreloc |
| Andrew Fawcett - !FOZ! | sidreloc JavaScript port; BeebSID Disc Creator / beebsidtools |
| Matt Godbolt | jsbeeb |
| jhohertz | jsSID FastSID |
| Ben Harris | Bedstead (MODE 7 font) |
| Ian Piumarta | 6502 CPU core (sidreloc) |
| Stardot / BeebAsm | BBC assembler toolchain |

## Get started

Install [Node.js](https://nodejs.org/) 24.15 or newer (once). After that, use the
two launchers — the first run installs the rest automatically.

### Disc Creator (browser)

```bash
./app
```

Opens a drag-and-drop UI to build a disc, hear a preview, and download an `.ssd`.
First run may take a minute.

Function keys: **f1** Create, **f2** Download, **f3** Test Disc, **f9** Credits, **f0** Help.

### Command line

Sample tunes are in `sids/`.

```bash
# One tune → a bootable disc (plus a menu preview image)
./create ssd sids/Head_Over_Heels.sid -o ~/Desktop/hoh.ssd

# Several tunes on one disc
./create ssd sids/Head_Over_Heels.sid sids/Cybernoid.sid \
  -o ~/Desktop/two.ssd --title=TWO

# Convert only (no disc) — writes BeebSID files next to -o
./create convert sids/Cybernoid.sid -o ~/Desktop/cyber
```

`./create` with no arguments lists every option. Useful flags:

| Flag | Meaning |
|------|---------|
| `--title=NAME` | Disc title in the catalogue |
| `--no-preview` | Skip the menu screenshot |
| `--record-audio` | Also write short preview WAVs |
| `--no-patch` | Skip built-in hardware patches |

## Contributing

Developers: see [`CONTRIBUTING.md`](CONTRIBUTING.md) for tests, layout, and the
create API.
