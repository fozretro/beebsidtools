import { useEffect, useMemo, useRef, useState } from "react";
import { clearLibrary, loadLibrary, saveLibrary } from "./hvsc/idb.js";
import {
  canPickDirectory,
  ensureDirectoryPermission,
  indexDirectory,
  indexDroppedFiles,
  pickHvscDirectory,
  readHvscFile,
} from "./hvsc/scan.js";
import { playSidBytes, stopSid, warmupSidPlayer } from "./hvsc/playSid.js";

const LIST_CAP = 250;

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
  const [titleQ, setTitleQ] = useState("");
  const [authorQ, setAuthorQ] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [playingPath, setPlayingPath] = useState("");
  const folderInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      stopSid();
      setPlayingPath("");
      return;
    }
    warmupSidPlayer().catch(() => {});
    let cancelled = false;
    (async () => {
      try {
        const lib = await loadLibrary();
        if (cancelled) return;
        setMeta(lib.meta);
        setHandle(lib.handle);
        setTunes(lib.tunes);
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const t = titleQ.trim().toLowerCase();
    const a = authorQ.trim().toLowerCase();
    if (!t && !a) return tunes;
    return tunes.filter((row) => {
      const title = `${row.title} ${row.name} ${row.path}`.toLowerCase();
      const author = String(row.author || "").toLowerCase();
      if (t && !title.includes(t)) return false;
      if (a && !author.includes(a)) return false;
      return true;
    });
  }, [tunes, titleQ, authorQ]);

  const shown = filtered.slice(0, LIST_CAP);

  async function persist(nextMeta, nextHandle, nextTunes) {
    setMeta(nextMeta);
    setHandle(nextHandle);
    setTunes(nextTunes);
    await saveLibrary({
      meta: nextMeta,
      handle: nextHandle,
      tunes: nextTunes.map(({ file, ...row }) => row),
    });
  }

  async function runIndex(root, label) {
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
    void label;
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
      setPlayingPath(row.path);
    } catch (err) {
      setError(err.message || String(err));
      setPlayingPath("");
    }
  }

  function onStop() {
    stopSid();
    setPlayingPath("");
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
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal chrome-panel hvsc-modal"
        role="dialog"
        aria-label="HVSC library"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-shell panel-inner">
          <header className="modal-header">
            <h2 className="modal-title">HVSC library</h2>
            <p className="hvsc-status">
              {busy ||
                (meta
                  ? `${meta.count} tunes · ${meta.rootName}`
                  : "Point at your High Voltage SID Collection")}
            </p>
            {error ? <p className="modal-status err">{error}</p> : null}
            <button type="button" className="modal-close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="hvsc-toolbar">
            {canPickDirectory() ? (
              <button type="button" className="file-btn" disabled={!!busy} onClick={onChooseFolder}>
                Choose HVSC folder
              </button>
            ) : (
              <label className={`file-btn ${busy ? "file-btn--disabled" : ""}`}>
                Choose HVSC folder
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
            <button type="button" className="file-btn" disabled={!!busy || !handle} onClick={onReindex}>
              Re-index
            </button>
            <button type="button" className="file-btn" disabled={!!busy || !tunes.length} onClick={onForget}>
              Forget
            </button>
            {playingPath ? (
              <button type="button" className="file-btn" onClick={onStop}>
                Stop
              </button>
            ) : null}
          </div>

          <div className="hvsc-filters">
            <label>
              Title
              <input
                value={titleQ}
                onChange={(e) => setTitleQ(e.target.value)}
                placeholder="Commando"
              />
            </label>
            <label>
              Author
              <input
                value={authorQ}
                onChange={(e) => setAuthorQ(e.target.value)}
                placeholder="Hubbard"
              />
            </label>
          </div>

          <div className="hvsc-list mode7" role="listbox" aria-label="HVSC tunes">
            {shown.length === 0 ? (
              <div className="file-listing__empty">
                {tunes.length ? "No matches" : "No index yet"}
              </div>
            ) : (
              shown.map((row) => (
                <div
                  key={row.path}
                  className={`hvsc-row ${playingPath === row.path ? "playing" : ""}`}
                >
                  <div className="hvsc-row__text">
                    <span className="hvsc-row__title">{row.title}</span>
                    <span className="hvsc-row__author">{row.author}</span>
                    <span className="hvsc-row__path">{row.path}</span>
                  </div>
                  <div className="hvsc-row__actions">
                    <button type="button" onClick={() => onPlay(row)}>
                      Play
                    </button>
                    <button type="button" onClick={() => onAdd(row)}>
                      Add
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {filtered.length > LIST_CAP ? (
            <p className="hvsc-cap">
              Showing {LIST_CAP} of {filtered.length} matches — narrow the filter.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
