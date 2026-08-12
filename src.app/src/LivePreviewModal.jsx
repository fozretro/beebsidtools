import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { runLivePreview } from "./livePreview.js";

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
  const [status, setStatus] = useState("Opening…");
  const [statusErr, setStatusErr] = useState(false);
  const handleRef = useRef(null);

  useEffect(() => {
    return () => {
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !ssd || !audioCtx) {
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
          discBytes: ssd,
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
  }, [open, ssd, audioCtx]);

  if (!open) return null;

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

          <div className="modal-body">
            <div className="live-screen-wrap">
              <canvas
                ref={canvasRef}
                className="live-screen"
                tabIndex={0}
                aria-label="BBC Micro screen"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
