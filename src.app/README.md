# BeebSID Disc Creator

React UI over the create engine. Drag-drop SIDs → **in-browser** `createSsd`
with turbo preview from `beebsidtools-src-create/preview/browser`.

CLI uses `preview/node` (`MachineSession` + `sharp`).

```bash
./app
```

## Status

- [x] Drag-drop / multi SID → SSD (in-browser)
- [x] Turbo menu image + per-tune audio (`preview/browser`)
- [x] Download `.ssd`
- [x] Live Preview modal (jsbeeb + BeebSID audio)
- [x] Sync `sidpl.o` + jsbeeb ROMs into `public/`
- [x] Node preview host unchanged for CLI
