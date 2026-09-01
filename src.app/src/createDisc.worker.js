/**
 * Convert + pack only. Do not import preview/browser or preview/node.
 */

import { Buffer } from "buffer";
import { createSsd, previewStepCount } from "beebsidtools-src-create";
import { cloneWorkerResult } from "./createWorkerResult.js";

function toBuffer(bytes) {
  if (!bytes) return undefined;
  return Buffer.from(bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes));
}

function transferableOf(bytes) {
  if (!bytes) return null;
  if (bytes instanceof ArrayBuffer) {
    return bytes.slice(0);
  }
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

self.onmessage = async (event) => {
  const { inputs, assets, title, progressExtra } = event.data ?? {};
  try {
    const out = await createSsd(
      (inputs ?? []).map((inp) => ({
        sid: toBuffer(inp.sid),
        baseName: inp.baseName,
        playSeconds: inp.playSeconds,
      })),
      {
        assets: {
          sidplay: toBuffer(assets?.sidplay),
          ...(assets?.hex ? { hex: toBuffer(assets.hex) } : {}),
          ...(assets?.sidpelk ? { sidpelk: toBuffer(assets.sidpelk) } : {}),
        },
        title: title ?? "BEEBSID",
        progressExtra: progressExtra ?? previewStepCount((inputs ?? []).length),
        onLog: (line) => self.postMessage({ type: "log", line }),
        onProgress: (p) =>
          self.postMessage({
            type: "progress",
            phase: p.phase,
            current: p.current,
            total: p.total,
            label: p.label ?? "",
            ...(p.done ? { done: true } : {}),
          }),
      },
    );

    const ssd = transferableOf(out.ssd);
    self.postMessage(
      {
        type: "done",
        ssd,
        ...cloneWorkerResult(out),
      },
      ssd ? [ssd] : [],
    );
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err?.message || String(err),
    });
  }
};
