import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clearLibrary, loadLibrary, saveLibrary } from "./hvsc/idb.js";
import {
  breadcrumbParts,
  defaultExpanded,
  FIELD_LABELS,
  SEARCH_FIELDS,
  visibleRows,
} from "./hvsc/libraryView.js";
import {
  canPickDirectory,
  ensureDirectoryPermission,
  indexDirectory,
  indexDroppedFiles,
  pickHvscDirectory,
  readHvscFile,
} from "./hvsc/scan.js";
import {
  getSidWaveform,
  pauseSid,
  playSidBytes,
  resumeSid,
  setSidVolume,
  stopSid,
  warmupSidPlayer,
} from "./hvsc/playSid.js";

const LIST_CAP = 400;

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onAddFiles: (files: File[]) => void,
 *   onLog: (line: string) => void,
 * }} props
 */
export default function HvscBrowser({ open, onClose, onAddFiles, onLog }) {
  const [meta, setMeta] = useState(null);
  const [handle, setHandle] = useState(null);
  const [tunes, setTunes] = useState([]);
  const [query, setQuery] = useState("");
  const [field, setField] = useState("title");
  const [fieldOpen, setFieldOpen] = useState(false);
  const [folder, setFolder] = useState("");
  const [scope, setScope] = useState("all");
  const [sortKey, setSortKey] = useState("title");
  const [sortDir, setSortDir] = useState("asc");
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [playingPath, setPlayingPath] = useState("");
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(1);
  const [selectedPath, setSelectedPath] = useState("");
  const folderInputRef = useRef(null);
  const searchRef = useRef(null);
  const tableWrapRef = useRef(null);
  const loadedRef = useRef(false);
  const scrollRef = useRef(0);

  function rememberScroll() {
    if (tableWrapRef.current) scrollRef.current = tableWrapRef.current.scrollTop;
  }

  function close() {
    rememberScroll();
    onClose();
  }

  useEffect(() => {
    if (!open) {
      stopSid();
      setPlayingPath("");
      setPaused(false);
      setFieldOpen(false);
      return;
    }
    warmupSidPlayer().catch(() => {});
    if (loadedRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const lib = await loadLibrary();
        if (cancelled) return;
        setMeta(lib.meta);
        setHandle(lib.handle);
        setTunes(lib.tunes);
        setExpanded(defaultExpanded(lib.tunes));
        loadedRef.current = true;
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !tableWrapRef.current) return;
    tableWrapRef.current.scrollTop = scrollRef.current;
  }, [open]);

  useEffect(() => {
    setSidVolume(volume);
  }, [volume, playingPath]);

  useEffect(() => {
    if (!fieldOpen) return undefined;
    function onDoc(e) {
      if (!searchRef.current?.contains(e.target)) setFieldOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fieldOpen]);

  const searching = Boolean(query.trim());
  const scopeFolder = scope === "folder" ? folder : "";

  const rows = useMemo(
    () =>
      visibleRows(tunes, expanded, {
        query,
        field,
        folder: scopeFolder,
        sortKey,
        sortDir,
      }),
    [tunes, expanded, query, field, scopeFolder, sortKey, sortDir],
  );

  const shown = searching ? rows.slice(0, LIST_CAP) : rows;
  const crumbs = useMemo(
    () => breadcrumbParts(meta?.rootName, folder),
    [meta, folder],
  );

  async function persist(nextMeta, nextHandle, nextTunes) {
    setMeta(nextMeta);
    setHandle(nextHandle);
    setTunes(nextTunes);
    setExpanded(defaultExpanded(nextTunes));
    setFolder("");
    await saveLibrary({
      meta: nextMeta,
      handle: nextHandle,
      tunes: nextTunes.map(({ file, ...row }) => row),
    });
  }

  async function runIndex(root) {
    setBusy("Indexing…");
    setError("");
    try {
      const { meta: nextMeta, tunes: nextTunes } = await indexDirectory(
        root,
        ({ done }) => setBusy(`Indexing… ${done}`),
      );
      await persist(nextMeta, root, nextTunes);
      onLog(`HVSC: indexed ${nextMeta.count} SIDs from ${nextMeta.rootName}`);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy("");
    }
  }

  async function onChooseFolder() {
    try {
      const root = await pickHvscDirectory();
      await runIndex(root);
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err.message || String(err));
    }
  }

  async function onReindex() {
    if (!handle) return;
    const ok = await ensureDirectoryPermission(handle);
    if (!ok) {
      setError("Folder access was denied. Choose the HVSC folder again.");
      return;
    }
    await runIndex(handle);
  }

  async function onFolderInput(list) {
    if (!list?.length) return;
    setBusy("Indexing…");
    setError("");
    try {
      const { meta: nextMeta, tunes: nextTunes } = await indexDroppedFiles(
        list,
        ({ done }) => setBusy(`Indexing… ${done}`),
      );
      await persist(nextMeta, null, nextTunes);
      onLog(`HVSC: indexed ${nextMeta.count} SIDs from ${nextMeta.rootName}`);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy("");
    }
  }

  async function fileForRow(row) {
    if (row.file) return row.file;
    if (!handle) {
      throw new Error("Choose the HVSC folder again to read this tune.");
    }
    const ok = await ensureDirectoryPermission(handle);
    if (!ok) throw new Error("Folder access was denied.");
    return readHvscFile(handle, row.path);
  }

  async function onPlay(row) {
    setError("");
    try {
      const file = await fileForRow(row);
      const bytes = new Uint8Array(await file.arrayBuffer());
      await playSidBytes(bytes, 0);
      setSidVolume(volume);
      setPlayingPath(row.path);
      setPaused(false);
      setSelectedPath(row.path);
    } catch (err) {
      setError(err.message || String(err));
      setPlayingPath("");
    }
  }

  function onStop() {
    stopSid();
    setPlayingPath("");
    setPaused(false);
  }

  function onTogglePlay() {
    if (!playingPath) {
      const row = shown.find((r) => r.kind === "tune" && r.path === selectedPath);
      if (row) void onPlay(row);
      return;
    }
    if (paused) {
      resumeSid();
      setPaused(false);
    } else {
      pauseSid();
      setPaused(true);
    }
  }

  async function onAdd(row) {
    try {
      const file = await fileForRow(row);
      onAddFiles([file]);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function onForget() {
    onStop();
    await clearLibrary();
    setMeta(null);
    setHandle(null);
    setTunes([]);
    setExpanded(new Set());
    setFolder("");
    loadedRef.current = true;
    scrollRef.current = 0;
  }

  function toggleFolder(path) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setFolder(path);
  }

  function goCrumb(path) {
    setFolder(path);
    setScope(path ? "folder" : "all");
    if (path) {
      setExpanded((prev) => new Set(prev).add(path));
    }
  }

  function onSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function onRowActivate(row) {
    if (row.kind === "folder") {
      toggleFolder(row.path);
      return;
    }
    setSelectedPath(row.path);
    void onPlay(row);
  }

  if (!open) return null;

  const playing = shown.find((r) => r.kind === "tune" && r.path === playingPath);
  const status =
    busy ||
    (meta
      ? `${meta.count} tunes · ${meta.rootName}`
      : "Point at your High Voltage SID Collection");

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div
        className="modal chrome-panel hvsc-modal"
        role="dialog"
        aria-label="HVSC library"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell panel-inner hvsc-shell">
          <header className="hvsc-top">
            <div className="hvsc-brand" aria-hidden="true">
              SIDPLAY
            </div>
            <SidViz active={Boolean(playingPath) && !paused} />
            <label className="hvsc-vol">
              <span aria-hidden="true">♪</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
              />
              <span aria-hidden="true">♪</span>
            </label>
            <div className="hvsc-search" ref={searchRef}>
              <span className="hvsc-search__icon" aria-hidden="true">
                ⌕
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFieldOpen(true)}
                placeholder={`${FIELD_LABELS[field]} Search`}
                aria-label="Search HVSC"
              />
              {fieldOpen ? (
                <ul className="hvsc-search__menu" role="listbox">
                  {SEARCH_FIELDS.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        className={field === id ? "on" : ""}
                        onClick={() => {
                          setField(id);
                          setFieldOpen(false);
                        }}
                      >
                        {field === id ? "✓ " : ""}
                        {FIELD_LABELS[id]}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button type="button" className="hvsc-x" onClick={close} aria-label="Close">
              ×
            </button>
          </header>

          <div className="hvsc-nav">
            <nav className="hvsc-crumbs" aria-label="Folder">
              {crumbs.map((c, i) => (
                <span key={c.path || "root"} className="hvsc-crumb">
                  {i > 0 ? <span className="hvsc-crumb__sep">›</span> : null}
                  <button type="button" onClick={() => goCrumb(c.path)}>
                    <span className="hvsc-folder-ico" aria-hidden="true" />
                    {c.name}
                  </button>
                </span>
              ))}
            </nav>
            <div className="hvsc-transport">
              <button
                type="button"
                className="hvsc-icon-btn"
                onClick={onTogglePlay}
                disabled={!playingPath && !selectedPath}
                aria-label={paused || !playingPath ? "Play" : "Pause"}
              >
                {paused || !playingPath ? "▶" : "❚❚"}
              </button>
              <button
                type="button"
                className="hvsc-icon-btn"
                onClick={onStop}
                disabled={!playingPath}
                aria-label="Stop"
              >
                ■
              </button>
            </div>
          </div>

          <div className="hvsc-bar">
            <div className="hvsc-scopes">
              <button
                type="button"
                className={scope === "all" ? "on" : ""}
                onClick={() => setScope("all")}
              >
                Full Collection
              </button>
              <button
                type="button"
                className={scope === "folder" ? "on" : ""}
                onClick={() => setScope("folder")}
              >
                Current Folder
              </button>
            </div>
            <p className="hvsc-now">
              {playing
                ? `${paused ? "Paused" : "Playing"} · ${playing.title}`
                : status}
            </p>
            <div className="hvsc-lib">
              {canPickDirectory() ? (
                <button type="button" disabled={!!busy} onClick={onChooseFolder}>
                  Folder…
                </button>
              ) : (
                <label className={busy ? "disabled" : ""}>
                  Folder…
                  <input
                    ref={folderInputRef}
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    disabled={!!busy}
                    onChange={(e) => {
                      onFolderInput(e.target.files ?? []);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <button type="button" disabled={!!busy || !handle} onClick={onReindex}>
                Re-index
              </button>
              <button type="button" disabled={!!busy || !tunes.length} onClick={onForget}>
                Forget
              </button>
            </div>
          </div>

          {error ? <p className="hvsc-err">{error}</p> : null}

          <div
            className="hvsc-table-wrap"
            ref={tableWrapRef}
            onClick={() => setFieldOpen(false)}
            onScroll={(e) => {
              scrollRef.current = e.currentTarget.scrollTop;
            }}
          >
            <div className="hvsc-table" role="table" aria-label="HVSC tunes">
              <div className="hvsc-thead" role="row">
                <SortHead
                  label="Title"
                  col="title"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <span className="hvsc-th">Time</span>
                <SortHead
                  label="Author"
                  col="author"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHead
                  label="Released"
                  col="released"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortHead
                  label="Path"
                  col="path"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <span className="hvsc-th hvsc-th--act" />
              </div>
              <div className="hvsc-tbody">
                {shown.length === 0 ? (
                  <div className="hvsc-empty">
                    {tunes.length ? "No matches" : "No index yet"}
                  </div>
                ) : (
                  shown.map((row) => {
                    const key = `${row.kind}:${row.path}`;
                    const isTune = row.kind === "tune";
                    const playingRow = isTune && playingPath === row.path;
                    const selected = isTune && selectedPath === row.path;
                    return (
                      <div
                        key={key}
                        role="row"
                        className={`hvsc-tr ${row.kind} ${playingRow ? "playing" : ""} ${
                          selected ? "selected" : ""
                        }`}
                        onClick={() => {
                          if (isTune) setSelectedPath(row.path);
                        }}
                        onDoubleClick={() => onRowActivate(row)}
                      >
                        <span
                          className="hvsc-td hvsc-td--title"
                          style={{ paddingLeft: `${0.35 + row.depth * 1.1}rem` }}
                        >
                          {row.kind === "folder" ? (
                            <button
                              type="button"
                              className="hvsc-twist"
                              aria-expanded={row.expanded}
                              onClick={() => toggleFolder(row.path)}
                            >
                              <span aria-hidden="true">{row.expanded ? "▾" : "▸"}</span>
                              <span className="hvsc-folder-ico" />
                              {row.name}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="hvsc-title-btn"
                              onClick={() => void onPlay(row)}
                            >
                              {row.title}
                            </button>
                          )}
                        </span>
                        <span className="hvsc-td hvsc-td--time">
                          {isTune ? "—" : ""}
                        </span>
                        <span className="hvsc-td">{isTune ? row.author : ""}</span>
                        <span className="hvsc-td">{isTune ? row.release : ""}</span>
                        <span className="hvsc-td hvsc-td--path" title={row.path}>
                          {row.path}
                        </span>
                        <span className="hvsc-td hvsc-td--act">
                          {isTune ? (
                            <button type="button" onClick={() => void onAdd(row)}>
                              Add
                            </button>
                          ) : null}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          {searching && rows.length > LIST_CAP ? (
            <p className="hvsc-cap">
              Showing {LIST_CAP} of {rows.length} matches — narrow the filter.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SortHead({ label, col, sortKey, sortDir, onSort }) {
  const on = sortKey === col;
  return (
    <button
      type="button"
      className={`hvsc-th hvsc-th--btn ${on ? "on" : ""}`}
      onClick={() => onSort(col)}
    >
      {label}
      {on ? <span className="hvsc-sort">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
    </button>
  );
}

function SidViz({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0c0c0c";
      ctx.fillRect(0, 0, w, h);
      const wave = active ? getSidWaveform() : null;
      ctx.beginPath();
      ctx.strokeStyle = "#c8c8c8";
      ctx.lineWidth = 1.25;
      if (wave) {
        const n = wave.length;
        let peak = 1;
        for (let i = 0; i < n; i++) {
          peak = Math.max(peak, Math.abs(wave[i] - 128));
        }
        const gain = Math.min(6, 110 / peak);
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * w;
          const sample = 128 + (wave[i] - 128) * gain;
          const y = (1 - sample / 255) * (h - 2) + 1;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="hvsc-viz"
      width={160}
      height={36}
      aria-hidden="true"
    />
  );
}
