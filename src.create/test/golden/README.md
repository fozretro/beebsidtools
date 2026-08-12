# Golden fixtures

Lean set for create tests (self-contained; no `archive/` dependency).

| File | Role |
|------|------|
| `Head_Over_Heels.sid` + `.rel.sid` / `.brk` / `.reloc.exit` / `.patched.sid` / `.bbcsid` | Post-patch, reloc, rip |
| `RoboCop.sid` / `.bbcsid` / `.reloc.exit` | RSID pre-patch; raw reloc fails (exit committed) |
| `RoboCop_3.sid` + `.rel.sid` / `.brk` / `.reloc.exit` / `.patched.sid` / `.bbcsid` | Post-patch on relocated hash |
| `Cybernoid.sid` + `.rel.sid` / `.brk` / `.reloc.exit` / `.bbcsid` | No-patch PSID |
| `tunes.ssd` | Pack-only golden (all four `.bbcsid` + current `sidpl.o`) |
| `Head_Over_Heels.10s.wav` | jsbeeb + FastSID recording (RETURN on first menu tune, 10s) |

Headless preview (create pipeline / app API) captures menu PNG + short WAVs per
tune faster than realtime via `createSsd({ preview })`.

```bash
# from beebsidtools/
npm run update:golden-reloc
npm run build:player && npm run update:golden-ssd
npm run update:golden-audio
```

Tune list for the SSD golden: `test/lib/golden-ssd.js`.

Broader SIDs remain under repo-root `input/` for manual use.
