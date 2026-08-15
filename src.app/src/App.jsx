import { useCallback, useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { createSsd } from "beebsidtools-src-create";
import {
  UI_SECONDS_PER_TUNE,
  previewSsdStage,
} from "beebsidtools-src-create/preview/browser";
import LivePreviewModal from "./LivePreviewModal.jsx";
import HvscBrowser from "./HvscBrowser.jsx";
import { publicUrl } from "./publicUrl.js";
import { TOOLS_VERSION } from "./versions.js";
import { formatReleaseNotes } from "./releaseNotes.js";

function formatColumns(rows, sep = " · ") {
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return rows.map((row) =>
    row.map((cell, i) => cell.padEnd(widths[i])).join(sep).trimEnd(),
  );
}

const HELP_TEXT = [
  "BeebSID Disc Creator",
  "",
  ...formatColumns([
    ["f1 Create Disc", "f2 Download Disc", "f3 Test Disc"],
    ["f5 Clear list", "f6/f7 Move selected", "f8 Remove selected"],
    ["f9 Credits", "f0 Help"],
  ]),
  "",
  "Drop .sid files, Choose files, or HVSC to browse a local collection.",
  "HVSC index is stored in this browser. Play listens with Hermit jsSID.",
  "",
  `BeebSID Tools v${TOOLS_VERSION}`,
  "",
  formatReleaseNotes(),
].join("\n");

const VERSION_BANNER = `BeebSID Tools\nv${TOOLS_VERSION}`;

const CREDITS_TEXT = [
  "Credits",
  "",
  "Dominic Beesley         SIDPlayer, ripsid, dfs",
  "  Stardot p=145147      original toolchain",
  "Linus Akesson           sidreloc",
  "Andrew Fawcett - !FOZ!  sidreloc JavaScript port",
  "Matt Godbolt            jsbeeb",
  "jhohertz                jsSID FastSID",
  "Mihaly Horvath (Hermit) jsSID C64 SID player",
  "Ben Harris              Bedstead (MODE 7 font)",
  "Ian Piumarta            6502 CPU core (sidreloc)",
  "Stardot / BeebAsm       BBC assembler toolchain",
  "Andrew Fawcett - !FOZ!  BeebSID Disc Creator / beebsidtools",
].join("\n");

function downloadBytes(bytes, filename, mime = "application/octet-stream") {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchAsset(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Missing ${path} — run npm run sync:player`);
  return Buffer.from(await res.arrayBuffer());
}

async function loadCreateAssets() {
  const sidplay = await fetchAsset(publicUrl("player/sidpl.o"));
  let hex;
  try {
    hex = await fetchAsset(publicUrl("player/hexdigs.bin"));
  } catch {
    /* optional */
  }
  return hex ? { sidplay, hex } : { sidplay };
}

function fileKey(f) {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

function formatFileDate(f) {
  const d = f.lastModified ? new Date(f.lastModified) : null;
  if (!d || Number.isNaN(d.getTime())) return "1980-00-00";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatListingName(name) {
  return String(name || "").toUpperCase();
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(CREDITS_TEXT);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [menuUrl, setMenuUrl] = useState(null);
  const [freeUrl, setFreeUrl] = useState(null);
  const [audioUrls, setAudioUrls] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveAudioCtx, setLiveAudioCtx] = useState(null);
  const [hvscOpen, setHvscOpen] = useState(false);
  const logRef = useRef(null);
  const fileInputRef = useRef(null);

  async function onLivePreview() {
    if (!result?.ssd) return;
    const ctx = new AudioContext();
    await ctx.resume();
    setLiveAudioCtx(ctx);
    setLiveOpen(true);
  }

  function onCloseLive() {
    setLiveOpen(false);
    setLiveAudioCtx((ctx) => {
      ctx?.close().catch(() => {});
      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (menuUrl) URL.revokeObjectURL(menuUrl);
      if (freeUrl) URL.revokeObjectURL(freeUrl);
      for (const a of audioUrls) URL.revokeObjectURL(a.url);
    };
  }, [menuUrl, freeUrl, audioUrls]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const onFiles = useCallback((list) => {
    const sids = [...list].filter((f) => /\.sid$/i.test(f.name));
    if (!sids.length) return;
    setFiles((prev) => {
      const seen = new Set(prev.map(fileKey));
      const next = [...prev];
      for (const f of sids) {
        const k = fileKey(f);
        if (!seen.has(k)) {
          seen.add(k);
          next.push(f);
        }
      }
      return next;
    });
    setSelected((i) => (i < 0 ? 0 : i));
  }, []);

  function clearList() {
    if (busy) return;
    setFiles([]);
    setSelected(-1);
  }

  function moveSelected(delta) {
    if (busy || selected < 0 || !files.length) return;
    const to = selected + delta;
    if (to < 0 || to >= files.length) return;
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(selected, 1);
      next.splice(to, 0, item);
      return next;
    });
    setSelected(to);
  }

  function removeSelected() {
    if (busy || selected < 0) return;
    const removeAt = selected;
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== removeAt);
      setSelected((i) => {
        if (next.length === 0) return -1;
        return Math.min(i, next.length - 1);
      });
      return next;
    });
  }

  function showHelp() {
    setLog(HELP_TEXT);
    setError("");
  }

  function showCredits() {
    setLog(CREDITS_TEXT);
    setError("");
  }

  async function onCreate() {
    if (!files.length) return;
    setBusy(true);
    setError("");
    setResult(null);
    setMenuUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setFreeUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setAudioUrls((prev) => {
      for (const a of prev) URL.revokeObjectURL(a.url);
      return [];
    });
    setLog("Loading player assets…");

    const appendLog = (line) => {
      setLog((prev) => (prev ? `${prev}\n${line}` : line));
    };

    try {
      const assets = await loadCreateAssets();
      appendLog("Reading SID files…");

      const inputs = [];
      for (const f of files) {
        const sid = Buffer.from(await f.arrayBuffer());
        const baseName = f.name.replace(/\.sid$/i, "") || "tune";
        inputs.push({ sid, baseName });
      }

      appendLog(`Creating SSD from ${inputs.length} SID(s) (in-browser)…`);

      const out = await createSsd(inputs, {
        assets,
        title: "BEEBSID",
        preview: {
          stage: previewSsdStage({
            audio: true,
            secondsPerTune: UI_SECONDS_PER_TUNE,
            romBaseUrl: publicUrl("jsbeeb/"),
          }),
        },
        onLog: appendLog,
      });

      setResult({
        ssd: out.ssd,
        preview: out.preview,
      });

      if (out.preview?.menuPng) {
        setMenuUrl(
          URL.createObjectURL(
            new Blob([out.preview.menuPng], { type: "image/png" }),
          ),
        );
      }
      if (out.preview?.freePng) {
        setFreeUrl(
          URL.createObjectURL(
            new Blob([out.preview.freePng], { type: "image/png" }),
          ),
        );
      }
      if (out.preview?.tunes?.length) {
        setAudioUrls(
          out.preview.tunes.map((t) => ({
            name: t.name,
            url: URL.createObjectURL(
              new Blob([t.wav], { type: "audio/wav" }),
            ),
          })),
        );
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  const fkeys = [
    { id: "f0", label: "Help", disabled: busy, run: showHelp },
    {
      id: "f1",
      label: "Create Disc",
      disabled: !files.length || busy,
      run: onCreate,
    },
    {
      id: "f2",
      label: "Download Disc",
      disabled: !result?.ssd || busy,
      run: () => downloadBytes(result.ssd, "beebsid.ssd"),
    },
    {
      id: "f3",
      label: "Test Disc",
      disabled: !result?.ssd || busy || liveOpen,
      run: onLivePreview,
    },
    {
      id: "f4",
      label: "Refresh List",
      disabled: busy,
      run: () => fileInputRef.current?.click(),
    },
    { id: "f5", label: "Clear List", disabled: busy || !files.length, run: clearList },
    {
      id: "f6",
      label: "Move Up",
      disabled: busy || selected <= 0,
      run: () => moveSelected(-1),
    },
    {
      id: "f7",
      label: "Move Down",
      disabled: busy || selected < 0 || selected >= files.length - 1,
      run: () => moveSelected(1),
    },
    {
      id: "f8",
      label: "Remove",
      disabled: busy || selected < 0,
      run: removeSelected,
    },
    { id: "f9", label: "Credits", disabled: busy, run: showCredits },
  ];

  useEffect(() => {
    if (liveOpen) return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Browser F1–F10 → BBC f0–f9
      const map = {
        F1: 0,
        F2: 1,
        F3: 2,
        F4: 3,
        F5: 4,
        F6: 5,
        F7: 6,
        F8: 7,
        F9: 8,
        F10: 9,
      };
      const idx = map[e.key];
      if (idx == null) return;
      const key = fkeys[idx];
      if (!key || key.disabled) return;
      e.preventDefault();
      key.run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app">
      <header className="machine-header" aria-label="BBC Micro inspired header">
        <div className="title-region mode7">
          <div className="title-copy">
            <h1 className="title-slot">BeebSID Disc Creator</h1>
            <p className="subtitle-slot">
              Drop SID music files to build a disc you can download and preview
              here.
            </p>
          </div>
          <pre className="version-slot" aria-label="BeebSID Tools version">
            {VERSION_BANNER}
          </pre>
        </div>

        <div className="function-strip" aria-hidden="true">
          {fkeys.map((k) => (
            <div
              key={k.id}
              className={`legend-card ${k.disabled ? "faded" : ""}`}
            >
              {k.label}
            </div>
          ))}
        </div>

        <div className="function-keys">
          {fkeys.map((k) => (
            <button
              key={k.id}
              type="button"
              className="fkey"
              disabled={k.disabled}
              title={k.label}
              onClick={() => k.run()}
            >
              {k.id}
            </button>
          ))}
        </div>
      </header>

      <div className="workspace">
        <section className="chrome-panel left-panel">
          <div
            className={`panel-inner drop ${dragOver ? "drop--over" : ""} ${busy ? "drop--busy" : ""}`}
            onDragOver={(e) => {
              if (busy) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (busy) return;
              onFiles(e.dataTransfer.files);
            }}
          >
            <p className="drop-line">
              <label className={`file-btn ${busy ? "file-btn--disabled" : ""}`}>
                Choose files
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sid,application/octet-stream"
                  multiple
                  disabled={busy}
                  onChange={(e) => {
                    onFiles(e.target.files ?? []);
                    e.target.value = "";
                  }}
                />
              </label>
              or drop <code>.sid</code> files here
              {" · "}
              <button
                type="button"
                className="file-btn"
                disabled={busy}
                onClick={() => setHvscOpen(true)}
              >
                HVSC
              </button>
            </p>
            <div className="file-listing mode7" role="listbox" aria-label="SID files">
              <div className="file-listing__prompt">&gt; *DOWNLOADS</div>
              {files.length ? (
                files.map((f, i) => (
                  <button
                    type="button"
                    key={fileKey(f)}
                    role="option"
                    aria-selected={i === selected}
                    className={`file-listing__row ${i === selected ? "selected" : ""}`}
                    onClick={() => setSelected(i)}
                  >
                    <span className="file-listing__date">{formatFileDate(f)}</span>
                    <span className="file-listing__size">{f.size}</span>
                    <span className="file-listing__name">
                      {formatListingName(f.name)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="file-listing__empty">No files</div>
              )}
            </div>
          </div>

          <div className="panel-inner log-panel">
            {error ? <p className="meta err">Error: {error}</p> : null}
            <pre className="log mode7" ref={logRef}>
              {log}
            </pre>
          </div>
        </section>

        <section className="chrome-panel right-panel">
          <div className="panel-inner preview-grid">
            <div className="preview-left">
              <figure className="beeb-shot">
                {menuUrl ? (
                  <img src={menuUrl} alt="SIDPLAY menu" />
                ) : (
                  <div className="beeb-shot__empty" aria-hidden="true" />
                )}
              </figure>
              <figure className="beeb-shot">
                {freeUrl ? (
                  <img src={freeUrl} alt="BBC *CAT and *FREE" />
                ) : (
                  <div className="beeb-shot__empty" aria-hidden="true" />
                )}
              </figure>
            </div>

            <div className="preview-tunes">
              <div className="tunes-log mode7" aria-label="Tune previews">
                <div className="tunes-log__prompt">&gt; *PREVIEW</div>
                {audioUrls.length ? (
                  audioUrls.map((a, i) => (
                    <div key={a.url} className="tunes-log__entry">
                      <div className="tunes-log__line">
                        <span className="tunes-log__idx">
                          {String(i).padStart(2, "0")}
                        </span>
                        <span className="tunes-log__name">{a.name}</span>
                      </div>
                      <audio
                        className="tunes-log__player"
                        controls
                        src={a.url}
                        preload="metadata"
                      />
                    </div>
                  ))
                ) : (
                  <div className="tunes-log__empty">
                    Create disc for tune previews
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <LivePreviewModal
        open={liveOpen}
        ssd={result?.ssd ?? null}
        audioCtx={liveAudioCtx}
        onClose={onCloseLive}
      />
      <HvscBrowser
        open={hvscOpen}
        onClose={() => setHvscOpen(false)}
        onAddFiles={onFiles}
        onLog={(line) => setLog((prev) => (prev ? `${prev}\n${line}` : line))}
      />
    </div>
  );
}
