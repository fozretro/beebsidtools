/**
 * Structured-clone a createSsd result so a worker can postMessage it.
 * `ctx.log` has a custom push from attachLogSink and cannot be cloned.
 * @param {{ log?: unknown[], meta?: object, tunes?: Array<{ baseName?: string, title?: string }> }} out
 */
export function cloneWorkerResult(out) {
  return {
    log: [...(out.log ?? [])],
    meta: JSON.parse(JSON.stringify(out.meta ?? {})),
    tunes: (out.tunes ?? []).map((t) => ({
      baseName: t.baseName,
      title: t.title,
    })),
  };
}
