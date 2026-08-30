# src.sids — BeebAsm SID replicas

One subdirectory per tune. Each rebuilds a byte-identical HVSC `.sid` from
a BeebDis listing plus stub/tail blobs. Probe/ctl scratch stays in
`.tmp/<tune>/dis/`.

| Dir | Tune |
|-----|------|
| [goldenaxe/](goldenaxe/) | `Golden_Axe.sid` (HVSC replica) |
| [goldenaxe.bbcsid/](goldenaxe.bbcsid/) | Golden Axe song 0 `.bbcsid` (`$4000` / `$FC20`); convert substitute |
| [robocop3/](robocop3/) | `RoboCop_3.sid` |

```bash
BEEBASM=/path/to/beebasm src.sids/<tune>/bin/build.sh
```
