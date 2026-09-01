/**
 * @param {{
 *   open: boolean,
 *   options: { tunePreviews: boolean, discNoises: boolean },
 *   onChange: (next: { tunePreviews: boolean, discNoises: boolean }) => void,
 *   onClose: () => void,
 * }} props
 */
export default function OptionsModal({ open, options, onChange, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal chrome-panel options-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="options-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-inner modal-shell options-shell">
          <header className="modal-header">
            <h2 id="options-title" className="modal-title">
              Options
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>
          <label className="options-row">
            <input
              type="checkbox"
              checked={options.tunePreviews}
              onChange={(e) =>
                onChange({ ...options, tunePreviews: e.target.checked })
              }
            />
            Generate Tune Previews
          </label>
          <p className="options-hint">
            Short SIDPLAY clips after Create. Off reduces time to create
            discs.
          </p>
          <label className="options-row">
            <input
              type="checkbox"
              checked={options.discNoises}
              onChange={(e) =>
                onChange({ ...options, discNoises: e.target.checked })
              }
            />
            Test Disc Noises
          </label>
          <p className="options-hint">
            Floppy motor and seek sounds while a disc loads in Test Disc.
          </p>
        </div>
      </div>
    </div>
  );
}
