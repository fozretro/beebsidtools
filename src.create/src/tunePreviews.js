/**
 * Mini tune preview WAVs after pack (FastSID clips next to the menu PNG).
 *
 * Core knob is `preview.audio` / `preview.tunePreviews` on createSsd and
 * previewSsdStage. Disc Creator default is on; CLI is off unless
 * `--tune-previews` / `--record-audio`.
 *
 * @param {{ audio?: boolean, tunePreviews?: boolean }} [opts]
 */
export function wantTunePreviews(opts = {}) {
  if (opts.tunePreviews != null) return !!opts.tunePreviews;
  if (opts.audio != null) return !!opts.audio;
  return true;
}
