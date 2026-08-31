/**
 * Disc-create progress (convert / pack / preview).
 *
 * `current` is 1-based “step we are on”. `total` is tunes + pack, plus
 * preview substeps (menu shots, then one per WAV). `done` is set only
 * when the last step has actually finished, so the bar is not 100% while
 * jsbeeb is still capturing.
 *
 * @typedef {object} CreateProgress
 * @property {"convert"|"pack"|"preview"} phase
 * @property {number} current
 * @property {number} total
 * @property {string} [label]
 * @property {boolean} [done]
 */

/**
 * Preview is menu screenshots plus one WAV per packed tune (when audio).
 * @param {number} tuneCount
 * @param {{ audio?: boolean }} [opts]
 */
export function previewStepCount(tuneCount, { audio = true } = {}) {
  const n = Math.max(0, tuneCount);
  return 1 + (audio ? n : 0);
}

/**
 * @param {number} tuneCount
 * @param {number} [extra=0] steps after pack (usually preview)
 */
export function progressTotal(tuneCount, extra = 0) {
  return Math.max(0, tuneCount) + 1 + extra;
}

/**
 * @param {object} ctx
 * @param {number} [fallbackExtra=0]
 */
export function contextProgressTotal(ctx, fallbackExtra = 0) {
  if (ctx?.progressTotal > 0) return ctx.progressTotal;
  const n = ctx?.inputs?.length ?? ctx?.tunes?.length ?? 0;
  return progressTotal(n, fallbackExtra);
}

/**
 * @param {object} ctx
 * @param {number} index 0-based tune index
 * @param {string} [label]
 * @returns {CreateProgress}
 */
export function convertProgressUpdate(ctx, index, label = "") {
  return {
    phase: "convert",
    current: index + 1,
    total: contextProgressTotal(ctx, 0),
    label,
  };
}

/**
 * @param {object} ctx
 * @returns {CreateProgress}
 */
export function packProgressUpdate(ctx) {
  const n = ctx?.inputs?.length ?? ctx?.tunes?.length ?? 0;
  return {
    phase: "pack",
    current: n + 1,
    total: contextProgressTotal(ctx, 0),
    label: "pack",
  };
}

/**
 * @param {object} ctx
 * @param {{ step?: number, label?: string, done?: boolean }} [opts]
 *   step 0 = menu shots; 1+ = WAV index. `done` fills the last step.
 * @returns {CreateProgress}
 */
export function previewProgressUpdate(ctx, opts = {}) {
  const n = ctx?.inputs?.length ?? ctx?.tunes?.length ?? 0;
  const previewSteps =
    ctx?.previewSteps ??
    previewStepCount(ctx?.tunes?.length ?? n, {
      audio: ctx?.previewAudio !== false,
    });
  const total = contextProgressTotal(ctx, previewSteps);
  if (opts.done) {
    return {
      phase: "preview",
      current: total,
      total,
      label: opts.label ?? "preview",
      done: true,
    };
  }
  const step = Math.max(0, opts.step ?? 0);
  const current = Math.min(n + 2 + step, total);
  return {
    phase: "preview",
    current,
    total,
    label: opts.label ?? "preview",
  };
}

/**
 * @param {object} ctx
 * @param {CreateProgress} update
 */
export function reportProgress(ctx, update) {
  if (typeof ctx?.onProgress !== "function") return;
  try {
    ctx.onProgress({
      phase: update.phase,
      current: update.current,
      total: update.total,
      label: update.label ?? "",
      ...(update.done ? { done: true } : {}),
    });
  } catch {
    /* ignore listener errors */
  }
}
