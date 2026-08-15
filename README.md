# BeebSID Tools

Standalone 100% Node.js toolchain for C64 SID → BeebSID: a port of
Dominic Beesley's original convert/player tools. In-memory **create**
pipeline, BeebAsm **player**, and the **BeebSID Disc Creator** web UI.
You can listen to converted SIDs here through jsbeeb + FastSID emulation.
Playing on physical hardware needs a BeebSID on the BBC Micro's 1MHz bus,
or a Pi1MHz with BeebSID emulation enabled. How the tools fit together:
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Credits

The original BeebSID convert/player toolchain was shared by **Dominic Beesley**
on Stardot ([SID — an idiots guide?](https://stardot.org.uk/forums/viewtopic.php?p=145147#p145147)).

| Who | Role |
|-----|------|
| [Dominic Beesley](https://stardot.org.uk/forums/viewtopic.php?p=145147#p145147) | SIDPlayer, ripsid, dfs |
| [Linus Akesson](https://www.linusakesson.net/software/sidreloc/index.php) | sidreloc |
| Andrew Fawcett - !FOZ! | sidreloc JavaScript port; BeebSID Disc Creator / beebsidtools |
| Matt Godbolt | jsbeeb |
| jhohertz | jsSID FastSID |
| Ben Harris | Bedstead (MODE 7 font) |
| Ian Piumarta | 6502 CPU core (sidreloc) |
| Stardot / BeebAsm | BBC assembler toolchain |

## Get started

Install [Node.js](https://nodejs.org/) 24.15 or newer (once). After that, use the
two launchers — the first run installs the rest automatically.

From the repo root: `./app` and `./create` on macOS, Linux, or Git Bash;
`.\app.cmd` and `.\create.cmd` on Windows (PowerShell or cmd).

### Disc Creator (browser)

Hosted on GitHub Pages: <https://fozretro.github.io/beebsidtools/>

```bash
./app
./app --clean          # wipe installs/dist, then first-run bootstrap
```

```bat
.\app.cmd
.\app.cmd --clean
```

Opens a drag-and-drop UI to build a disc, hear a preview, and download an `.ssd`.
First run may take a minute. Pushes to `main` rebuild the Pages site (Actions).

Function keys: **f1** Create, **f2** Download, **f3** Test Disc, **f9** Credits, **f0** Help.

### Command line

Sample tunes are in `sids/`. On Windows, use `.\create.cmd` in place of `./create`.

```bash
# One tune → a bootable disc (plus a menu preview image)
./create ssd sids/Head_Over_Heels.sid -o ~/Desktop/hoh.ssd

# Several tunes on one disc
./create ssd sids/Head_Over_Heels.sid sids/Cybernoid.sid \
  -o ~/Desktop/two.ssd --title=TWO

# Convert only (no disc) — writes BeebSID files next to -o
./create convert sids/Cybernoid.sid -o ~/Desktop/cyber
```

```bat
.\create.cmd ssd sids\Head_Over_Heels.sid -o out\hoh.ssd
.\create.cmd convert sids\Cybernoid.sid -o out\cyber
```

`./create` / `.\create.cmd` with no arguments lists every option. `--clean` is a
launcher flag (not passed to convert/ssd): it wipes `node_modules` / player
copies / logs, then bootstraps and runs the rest of the command.

Useful flags:

| Flag | Meaning |
|------|---------|
| `--title=NAME` | Disc title in the catalogue |
| `--no-preview` | Skip the menu screenshot |
| `--record-audio` | Also write short preview WAVs |
| `--no-patch` | Skip built-in hardware patches |
| `--page=HH` / `--sid-dest=HHHH` | Relocate dest page / BeebSID address (convert experiments; defaults `$1A` / `$FC20`) |
| `--no-keep-zp` / `--zp=LO-HI` | Remap zero-page (default is keep; SIDPLAY saves/restores `$70`–`$FF`) |
| `--no-force` | Abort relocate on SID verify mismatch |

Relocate flag names match [Linus Akesson’s sidreloc](https://www.linusakesson.net/software/sidreloc/index.php).
BeebSID defaults differ from a stock `sidreloc` run: page `$1A`, SID `$FC20`,
`--force`, and `--keep-zp` (the player saves and restores `$70`–`$FF`). Stock
sidreloc uses page `$10`, remaps zero-page into `$80`–`$FF`, leaves the SID at
`$D400`, and does not force verify mismatches. See
[`ARCHITECTURE.md`](ARCHITECTURE.md#relocation-parameters).

## Contributing

Developers: see [`CONTRIBUTING.md`](CONTRIBUTING.md) for tests, layout, and the
create API.
