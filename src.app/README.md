# BeebSID Disc Creator

React UI over the create engine. Drag-drop SIDs → **in-browser** `createSsd`
with turbo preview from `beebsidtools-src-create/preview/browser`.

CLI uses `preview/node` (`MachineSession` + `sharp`).

```bash
# from beebsidtools/
npm install --prefix src.create
npm install --prefix src.app
npm run build:player
npm run dev:app          # syncs player + jsbeeb ROMs, then Vite
# → http://localhost:5173
```

Static build (no Node create API required at runtime):

```bash
npm run build:app
# serve src.app/dist/ (e.g. github.io)
```

## Status

- [x] Drag-drop / multi SID → SSD (in-browser)
- [x] Turbo menu image + per-tune audio (`preview/browser`)
- [x] Download `.ssd`
- [x] Live Preview modal (jsbeeb + BeebSID audio)
- [x] Sync `sidpl.o` + jsbeeb ROMs into `public/`
- [x] Node preview host unchanged for CLI
