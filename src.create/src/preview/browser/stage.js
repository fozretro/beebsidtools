/**
 * Browser turbo preview pipeline stage.
 *
 * Static import (not `import()`) so Vite does not emit a separate capture-*.js
 * chunk. A hashed extra file 404s on GitHub Pages when a tab still runs an
 * older main bundle after a deploy.
 */

import { captureSsdPreview, UI_SECONDS_PER_TUNE } from "./capture.js";

/**
 * @param {object} [opts]
 * @param {boolean} [opts.audio=true]
 * @param {number} [opts.secondsPerTune]
 * @param {string} [opts.romBaseUrl]
 * @param {(opts: object) => Promise<object>} [opts.capture]
 */
export function previewSsdStage(opts = {}) {
  const audio = opts.audio !== false;
  const secondsPerTune = opts.secondsPerTune;
  const romBaseUrl = opts.romBaseUrl;
  const captureFn = opts.capture;

  return {
    name: "preview-ssd",
    async run(ctx) {
      if (!ctx.ssd?.length) throw new Error("preview-ssd: ctx.ssd required");

      const secs = secondsPerTune ?? UI_SECONDS_PER_TUNE;
      const capture = captureFn ?? captureSsdPreview;

      const tuneNames = (ctx.tunes ?? []).map(
        (t) => t.title || t.baseName || "tune",
      );
      const tuneCount = Math.max(1, tuneNames.length || 1);

      ctx.log.push(
        `  preview (browser): menu PNG` +
          (audio
            ? ` + ${tuneCount}×${secs}s audio (turbo)`
            : " (no audio)"),
      );

      const preview = await capture({
        ssd: ctx.ssd,
        tuneCount,
        tuneNames,
        secondsPerTune: secs,
        audio,
        romBaseUrl,
        onLog: (line) => ctx.log.push(line),
      });

      ctx.log.push(
        `  preview: ${preview.menuPng.length} byte PNG` +
          (preview.tunes?.length
            ? `, ${preview.tunes.length} WAV clip(s)`
            : ""),
      );

      return {
        ...ctx,
        preview: {
          menuPng: preview.menuPng,
          freePng: preview.freePng,
          tune0: preview.tune0,
          tunes: preview.tunes,
        },
      };
    },
  };
}
