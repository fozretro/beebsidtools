/**
 * CLI flags for SSD preview (menu PNG + optional tune-preview WAVs).
 */

/**
 * @param {Set<string>} flags
 * @param {string} arg
 * @returns {boolean} true if the arg was a preview flag
 */
export function applyPreviewFlag(flags, arg) {
  if (arg === "--no-preview") {
    flags.add("no-preview");
    return true;
  }
  if (arg === "--record-audio" || arg === "--tune-previews") {
    flags.add("tune-previews");
    flags.delete("no-tune-previews");
    return true;
  }
  if (arg === "--no-tune-previews") {
    flags.add("no-tune-previews");
    flags.delete("tune-previews");
    return true;
  }
  return false;
}

/**
 * @param {Set<string>} flags
 * @param {number} [secondsPerTune]
 * @returns {false|{ audio: boolean, tunePreviews: boolean, secondsPerTune: number }}
 */
export function previewOptsFromFlags(flags, secondsPerTune) {
  const wantMenu = !flags.has("no-preview");
  const wantAudio =
    flags.has("tune-previews") && !flags.has("no-tune-previews");
  if (!wantMenu && !wantAudio) return false;
  return {
    audio: wantAudio,
    tunePreviews: wantAudio,
    secondsPerTune,
  };
}
