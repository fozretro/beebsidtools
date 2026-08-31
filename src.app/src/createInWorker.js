/**
 * Post convert+pack to a module worker. Preview stays on the UI thread.
 */

import { previewStepCount } from "beebsidtools-src-create";

export { cloneWorkerResult } from "./createWorkerResult.js";

/**
 * Copy bytes into a standalone ArrayBuffer so postMessage can transfer it.
 * @param {ArrayBuffer|ArrayBufferView|number[]} bytes
 * @returns {ArrayBuffer}
 */
export function toTransferableBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes.slice(0);
  const view =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

/**
 * @param {{
 *   inputs: Array<{ sid: ArrayBuffer|ArrayBufferView, baseName?: string, playSeconds?: number }>,
 *   assets: { sidplay: ArrayBuffer|ArrayBufferView, hex?: ArrayBuffer|ArrayBufferView, sidpelk?: ArrayBuffer|ArrayBufferView },
 *   title?: string,
 * }} job
 */
export function buildCreateJob({ inputs, assets, title = "BEEBSID" }) {
  const sidBuffers = inputs.map((inp) => toTransferableBuffer(inp.sid));
  const sidplay = toTransferableBuffer(assets.sidplay);
  const hex = assets.hex ? toTransferableBuffer(assets.hex) : null;
  const sidpelk = assets.sidpelk ? toTransferableBuffer(assets.sidpelk) : null;
  const transfer = [...sidBuffers, sidplay];
  if (hex) transfer.push(hex);
  if (sidpelk) transfer.push(sidpelk);
  return {
    message: {
      title,
      progressExtra: previewStepCount(inputs.length),
      inputs: inputs.map((inp, i) => ({
        sid: sidBuffers[i],
        baseName: inp.baseName,
        playSeconds: inp.playSeconds,
      })),
      assets: { sidplay, hex, sidpelk },
    },
    transfer,
  };
}

/**
 * @param {object} msg
 * @param {{
 *   onLog?: (line: string) => void,
 *   onProgress?: (info: { phase: string, current: number, total: number, label: string }) => void,
 *   onDone?: (msg: object) => void,
 *   onError?: (err: Error) => void,
 * }} handlers
 * @returns {"log"|"progress"|"done"|"error"|null}
 */
export function applyWorkerMessage(msg, handlers = {}) {
  switch (msg?.type) {
    case "log":
      handlers.onLog?.(msg.line);
      return "log";
    case "progress":
      handlers.onProgress?.({
        phase: msg.phase,
        current: msg.current,
        total: msg.total,
        label: msg.label ?? "",
        ...(msg.done ? { done: true } : {}),
      });
      return "progress";
    case "done":
      handlers.onDone?.(msg);
      return "done";
    case "error":
      handlers.onError?.(new Error(msg.message || "create worker failed"));
      return "error";
    default:
      return null;
  }
}

/**
 * @param {{
 *   inputs: Array<{ sid: ArrayBuffer|ArrayBufferView, baseName?: string, playSeconds?: number }>,
 *   assets: { sidplay: ArrayBuffer|ArrayBufferView, hex?: ArrayBuffer|ArrayBufferView, sidpelk?: ArrayBuffer|ArrayBufferView },
 *   title?: string,
 *   onLog?: (line: string) => void,
 *   onProgress?: (info: object) => void,
 * }} opts
 */
export function createDiscInWorker({
  inputs,
  assets,
  title = "BEEBSID",
  onLog,
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./createDisc.worker.js", import.meta.url), {
      type: "module",
    });
    const { message, transfer } = buildCreateJob({ inputs, assets, title });
    let settled = false;

    function finish(fn, value) {
      if (settled) return;
      settled = true;
      worker.terminate();
      fn(value);
    }

    worker.onmessage = (event) => {
      applyWorkerMessage(event.data, {
        onLog,
        onProgress,
        onDone: (msg) =>
          finish(resolve, {
            ssd: new Uint8Array(msg.ssd),
            log: msg.log,
            meta: msg.meta,
            tunes: msg.tunes,
          }),
        onError: (err) => finish(reject, err),
      });
    };
    worker.onerror = (event) => {
      finish(reject, new Error(event.message || "create worker failed"));
    };
    worker.onmessageerror = () => {
      finish(reject, new Error("create worker message error"));
    };

    worker.postMessage(message, transfer);
  });
}
