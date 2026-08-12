/**
 * Node turbo preview pipeline stage.
 */

/**
 * @param {object} [opts]
 * @param {boolean} [opts.audio=true]
 * @param {number} [opts.secondsPerTune]
 * @param {(opts: object) => Promise<object>} [opts.capture]
 */
export function previewSsdStage(opts = {}) {
  const audio = opts.audio !== false;
  const secondsPerTune = opts.secondsPerTune;
  const captureFn = opts.capture;

  return {
    name: "preview-ssd",
    async run(ctx) {
      if (!ctx.ssd?.length) throw new Error("preview-ssd: ctx.ssd required");

      const { captureSsdPreview, UI_SECONDS_PER_TUNE } = await import(
        "./capture.js"
      );
      const secs = secondsPerTune ?? UI_SECONDS_PER_TUNE;
      const capture = captureFn ?? captureSsdPreview;

      const tuneNames = (ctx.tunes ?? []).map(
        (t) => t.title || t.baseName || "tune",
      );
      const tuneCount = Math.max(1, tuneNames.length || 1);

      ctx.log.push(
        `  preview (node): menu PNG` +
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
