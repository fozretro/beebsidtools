import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  describeBeebSidUpgrade,
  upgradeBeebSidSsd,
  upgradeNeeded,
} from "beebsidtools-src-create";
import { runLivePreview } from "./livePreview.js";
import { publicUrl } from "./publicUrl.js";

function isSsdName(name) {
  return /\.(ssd|dsd)$/i.test(name || "");
}

/**
 * @param {{
 *   open: boolean,
 *   ssd: Uint8Array|ArrayBuffer|null,
 *   audioCtx: AudioContext|null,
 *   onClose: () => void,
 * }} props
 */
export default function LivePreviewModal({ open, ssd, audioCtx, onClose }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("Opening…");
  const [statusErr, setStatusErr] = useState(false);
  const [disc, setDisc] = useState(null);
  const [discName, setDiscName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [canUpgrade, setCanUpgrade] = useState(false);
  const assetsRef = useRef(null);
  const handleRef = useRef(null);

  useEffect(() => {
    return () => {
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setDisc(null);
      setDiscName("");
      setStatus("Opening…");
      setStatusErr(false);
      setDragOver(false);
      setCanUpgrade(false);
      return;
    }
    if (ssd) {
      setDisc(ssd);
      setDiscName("");
    } else {
      setDisc(null);
      setDiscName("");
      setStatus("Load an .ssd to boot");
      setStatusErr(false);
    }
  }, [open, ssd]);

  async function loadFile(file) {
    if (!file || !isSsdName(file.name)) {
      setStatus("Choose an .ssd disc image");
      setStatusErr(true);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    setDisc(bytes);
    setDiscName(file.name);
    setStatusErr(false);
  }

  function saveName() {
    let name = (discName || "beebsid.ssd").replace(/ \(upgraded\)$/i, "");
    if (!/\.(ssd|dsd)$/i.test(name)) name += ".ssd";
    return name;
  }

  function onSave() {
    if (!disc) return;
    const blob = new Blob([disc], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = saveName();
    a.click();
    URL.revokeObjectURL(url);
  }

  async function fetchAsset(path) {
    const res = await fetch(publicUrl(path));
    if (!res.ok) throw new Error(`Missing ${path}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function loadUpgradeAssets() {
    if (assetsRef.current) return assetsRef.current;
    const sidplay = await fetchAsset("player/sidpl.o");
    let sidpelk;
    let hex;
    try {
      sidpelk = await fetchAsset("player/sidpelk.o");
    } catch {
      /* optional */
    }
    try {
      hex = await fetchAsset("player/hexdigs.bin");
    } catch {
      /* optional */
    }
    assetsRef.current = { sidplay, sidpelk, hex };
    return assetsRef.current;
  }

  useEffect(() => {
    if (!open || !disc) {
      setCanUpgrade(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const assets = await loadUpgradeAssets();
        const needed = upgradeNeeded(describeBeebSidUpgrade(disc, assets));
        if (!cancelled) setCanUpgrade(needed);
      } catch {
        if (!cancelled) setCanUpgrade(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, disc]);

  async function onUpgrade() {
    if (!disc || upgrading) return;
    setUpgrading(true);
    setStatusErr(false);
    setStatus("Upgrading player…");
    try {
      const assets = await loadUpgradeAssets();
      const { ssd, report } = upgradeBeebSidSsd(disc, assets);
      const bits = [];
      if (report.player) bits.push("player");
      if (report.sidpelk) bits.push("Electron player");
      if (report.menuTimes) bits.push("play times");
      if (report.menuFormat) bits.push("menu version");
      setDiscName((n) => {
        const base = (n || "Created disc").replace(/ \(upgraded\)$/i, "");
        return `${base} (upgraded)`;
      });
      setDisc(new Uint8Array(ssd));
      if (!bits.length) setStatus("Disc already current — rebooting");
    } catch (err) {
      setStatus(err?.message || String(err));
      setStatusErr(true);
    } finally {
      setUpgrading(false);
    }
  }

  useLayoutEffect(() => {
    if (!open || !disc || !audioCtx) {
      handleRef.current?.dispose();
      handleRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setStatus("Booting jsbeeb…");
    setStatusErr(false);

    (async () => {
      try {
        handleRef.current?.dispose();
        const handle = await runLivePreview({
          canvas,
          discBytes: disc,
          audioCtx,
          onStatus: (text, isError = false) => {
            if (cancelled) return;
            setStatus(text);
            setStatusErr(isError);
          },
        });
        if (cancelled) {
          handle.dispose();
          return;
        }
        handleRef.current = handle;
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setStatus(err?.message || String(err));
        setStatusErr(true);
      }
    })();

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [open, disc, audioCtx]);

  if (!open) return null;

  const label = discName || (disc ? "Created disc" : "No disc loaded");

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal chrome-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-preview-title"
      >
        <div className="panel-inner modal-shell">
          <header className="modal-header">
            <h2 id="live-preview-title" className="modal-title">
              Test Disc
            </h2>
            {statusErr ? (
              <p className="modal-status err">{status}</p>
            ) : null}
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="live-toolbar">
            <label className="file-btn">
              Load disc
              <input
                ref={fileInputRef}
                type="file"
                accept=".ssd,.dsd,application/octet-stream"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void loadFile(file);
                }}
              />
            </label>
            <button
              type="button"
              className="file-btn"
              disabled={!disc || upgrading || !canUpgrade}
              title={
                !disc
                  ? "Load a disc first"
                  : canUpgrade
                    ? "Replace the player with this version"
                    : "Already the current player"
              }
              onClick={() => void onUpgrade()}
            >
              {upgrading ? "Upgrading…" : "Upgrade"}
            </button>
            <button
              type="button"
              className="file-btn"
              disabled={!disc}
              title="Download this disc"
              onClick={onSave}
            >
              Save Disc
            </button>
            <span className="live-disc-name">{label}</span>
          </div>

          <div
            className={`modal-body ${dragOver ? "live-body--over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = [...e.dataTransfer.files].find((f) =>
                isSsdName(f.name),
              );
              if (file) void loadFile(file);
              else {
                setStatus("Drop an .ssd disc image");
                setStatusErr(true);
              }
            }}
          >
            {disc ? (
              <div className="live-screen-wrap">
                <canvas
                  ref={canvasRef}
                  className="live-screen"
                  tabIndex={0}
                  aria-label="BBC Micro screen"
                />
              </div>
            ) : (
              <button
                type="button"
                className="live-empty"
                onClick={() => fileInputRef.current?.click()}
              >
                Drop an .ssd here or choose Load disc
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
