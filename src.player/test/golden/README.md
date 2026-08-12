# Player golden binaries

Committed `sidpl.o` / `sidpelk.o` from a known-good BeebAsm build
(byte-identical to the archive ca65 SIDPlayer images at the time of capture).

```bash
npm run build
npm test
# after intentional player changes:
npm run update:golden-player
```
