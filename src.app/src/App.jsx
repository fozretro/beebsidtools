import { useCallback, useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import {
  createContext,
  previewStepCount,
  progressTotal,
} from "beebsidtools-src-create";
import {
  UI_SECONDS_PER_TUNE,
  previewSsdStage,
} from "beebsidtools-src-create/preview/browser";
import LivePreviewModal from "./LivePreviewModal.jsx";
import HvscBrowser from "./HvscBrowser.jsx";
import { publicUrl } from "./publicUrl.js";
import { TOOLS_VERSION } from "./versions.js";
import { formatReleaseNotes } from "./releaseNotes.js";
import { createDiscInWorker } from "./createInWorker.js";
import { formatCreateProgress } from "./createProgress.js";
import {
  loadCreateOptions,
  saveCreateOptions,
} from "./createOptions.js";
import OptionsModal from "./OptionsModal.jsx";

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
    ["f1 Create Disc", "f2 Download Disc", "f3 Test Disc (or load .ssd)"],
    ["f5 Clear list", "f6/f7 Move selected", "f8 Remove selected"],
    ["f9 Credits", "f0 Help"],
  ]),
  "",
  "Drop .sid files, Choose files, or HVSC to browse a local collection.",
  "HVSC: folder tree, search by title/author/released/filename, Play, Add.",
  "Play starts the SID default song; , / . or ‹ › step through songs.",
  "SIDPLAY: Return plays, A auto-plays each default song then the next",
  "(MM:SS countdown on the play screen),",
  "Return while playing skips, Escape returns to the menu.",
  ", / . or ‹ › change song and leave auto-play.",
  "Create converts in the background; the bar above the log shows progress.",
  "Options under the SID list turns tune preview clips and Test Disc noises on or off; kept in this browser.",
  "f3 Test Disc boots the disc you just created, or Load disc / drop an .ssd.",
  "Floppy sounds play while that disc loads so the menu is not mistaken for a crash (Options can silence them).",
  "Gallery shows sample discs; click a screenshot to boot it. Save Disc downloads the loaded .ssd.",
  "Upgrade puts the current player on that disc and adds play times if missing, then reboots.",
  "Upgrade is off when the disc is already current.",
  "Index stays in this browser. Play listens with Hermit jsSID.",
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
  const [progress, setProgress] = useState(null);
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [createOptions, setCreateOptions] = useState(loadCreateOptions);
  const logRef = useRef(null);
  const fileInputRef = useRef(null);

  async function onLivePreview() {
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

  function fileMatchesHvsc(f, row) {
    if (f.hvscPath && f.hvscPath === row.path) return true;
    return f.name === row.name && f.size === row.size;
  }

  function onRemoveHvsc(row) {
    if (busy) return;
    setFiles((prev) => {
      const next = prev.filter((f) => !fileMatchesHvsc(f, row));
      setSelected((i) => {
        if (next.length === 0) return -1;
        return Math.min(i, next.length - 1);
      });
      return next;
    });
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
    const tunePreviews = createOptions.tunePreviews;
    setProgress({
      phase: "load",
      current: 0,
      total: progressTotal(
        files.length,
        previewStepCount(files.length, { tunePreviews }),
      ),
      label: "assets",
    });
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
        inputs.push({
          sid,
          baseName,
          playSeconds: f.playSeconds,
        });
      }

      appendLog(`Creating SSD from ${inputs.length} SID(s) (in-browser)…`);

      const packed = await createDiscInWorker({
        inputs,
        assets,
        title: "BEEBSID",
        tunePreviews,
        onLog: appendLog,
        onProgress: setProgress,
      });

      const previewed = await previewSsdStage({
        audio: tunePreviews,
        tunePreviews,
        secondsPerTune: UI_SECONDS_PER_TUNE,
        romBaseUrl: publicUrl("jsbeeb/"),
      }).run(
        createContext({
          ssd: Buffer.from(packed.ssd),
          tunes: packed.tunes,
          inputs,
          progressTotal: progressTotal(
            inputs.length,
            previewStepCount(inputs.length, { tunePreviews }),
          ),
          previewSteps: previewStepCount(packed.tunes.length, {
            tunePreviews,
          }),
          previewAudio: tunePreviews,
          onLog: appendLog,
          onProgress: setProgress,
        }),
      );

      setResult({
        ssd: packed.ssd,
        preview: previewed.preview,
      });

      if (previewed.preview?.menuPng) {
        setMenuUrl(
          URL.createObjectURL(
            new Blob([previewed.preview.menuPng], { type: "image/png" }),
          ),
        );
      }
      if (previewed.preview?.freePng) {
        setFreeUrl(
          URL.createObjectURL(
            new Blob([previewed.preview.freePng], { type: "image/png" }),
          ),
        );
      }
      if (previewed.preview?.tunes?.length) {
        setAudioUrls(
          previewed.preview.tunes.map((t) => ({
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
      setProgress(null);
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
      disabled: busy || liveOpen,
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

  const shownProgress = formatCreateProgress(progress);

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
            <div className="drop-options">
              <button
                type="button"
                className="file-btn"
                disabled={busy}
                onClick={() => setHvscOpen(true)}
              >
                HVSC
              </button>
              <button
                type="button"
                className={`file-btn ${optionsOpen ? "file-btn--on" : ""}`}
                disabled={busy}
                onClick={() => setOptionsOpen(true)}
              >
                Options
              </button>
            </div>
          </div>

          <div className="panel-inner log-panel">
            {error ? <p className="meta err">Error: {error}</p> : null}
            {busy ? (
              <div className="create-progress">
                <div
                  className="create-progress__track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={shownProgress.percent}
                  aria-label={shownProgress.text || "Creating disc"}
                >
                  <div
                    className="create-progress__bar"
                    style={{ width: `${shownProgress.percent}%` }}
                  />
                </div>
                {shownProgress.text ? (
                  <div className="create-progress__label">
                    {shownProgress.text}
                  </div>
                ) : null}
              </div>
            ) : null}
            <pre className="log mode7" ref={logRef}>
              {log}
            </pre>
          </div>
        </section>

        <section className="chrome-panel right-panel">
          <div
            className={`panel-inner preview-grid${
              createOptions.tunePreviews ? "" : " preview-grid--shots-only"
            }`}
          >
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

            {createOptions.tunePreviews ? (
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
            ) : null}
          </div>
        </section>
      </div>

      <LivePreviewModal
        open={liveOpen}
        ssd={result?.ssd ?? null}
        audioCtx={liveAudioCtx}
        discNoises={createOptions.discNoises}
        onClose={onCloseLive}
      />
      <HvscBrowser
        open={hvscOpen}
        onClose={() => setHvscOpen(false)}
        discFiles={files}
        onAddFiles={onFiles}
        onRemoveFile={onRemoveHvsc}
        onLog={(line) => setLog((prev) => (prev ? `${prev}\n${line}` : line))}
      />
      <OptionsModal
        open={optionsOpen}
        options={createOptions}
        onChange={(next) => setCreateOptions(saveCreateOptions(next))}
        onClose={() => setOptionsOpen(false)}
      />
    </div>
  );
}
