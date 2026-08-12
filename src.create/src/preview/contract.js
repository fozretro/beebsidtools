/**
 * Shared turbo-preview contract for Node and browser hosts.
 *
 * captureSsdPreview(opts) →
 *   { menuPng, freePng, tune0, tunes: [{ index, name, wav }] }
 *
 *   preview/node/capture.js
 *   preview/browser/capture.js
 */

/** Default preview length per tune in the app UI */
export const UI_SECONDS_PER_TUNE = 15;

/** Golden audio recording length */
export const GOLDEN_SECONDS = 10;
