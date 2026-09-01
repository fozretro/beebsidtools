import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyWorkerMessage,
  buildCreateJob,
  cloneWorkerResult,
  toTransferableBuffer,
} from "../src/createInWorker.js";
import { formatCreateProgress } from "../src/createProgress.js";

test("formatCreateProgress shows convert name and percent", () => {
  // Given a convert step for the first of four
  // When formatCreateProgress labels it
  const shown = formatCreateProgress({
    phase: "convert",
    current: 1,
    total: 4,
    label: "Cybernoid",
  });
  // Then the bar is still empty (this step has not finished) and the label names the tune
  assert.equal(shown.percent, 0);
  assert.equal(shown.text, "Cybernoid  1/4");
});

test("formatCreateProgress uses Pack / Preview heads and does not hit 100% mid-preview", () => {
  // Given pack then an in-progress last preview step
  // When each is formatted
  // Then the phase name is used, and preview is not already 100%
  assert.equal(
    formatCreateProgress({
      phase: "pack",
      current: 3,
      total: 4,
      label: "pack",
    }).text,
    "Pack  3/4",
  );
  const previewing = formatCreateProgress({
    phase: "preview",
    current: 4,
    total: 4,
    label: "Golden Axe",
  });
  assert.equal(previewing.text, "Golden Axe  4/4");
  assert.equal(previewing.percent, 75);
  assert.equal(
    formatCreateProgress({
      phase: "preview",
      current: 4,
      total: 4,
      label: "preview",
      done: true,
    }).percent,
    100,
  );
});

test("toTransferableBuffer copies so the source is not detached", () => {
  // Given a Uint8Array view
  const src = new Uint8Array([1, 2, 3]);
  // When a transferable copy is made
  const copy = toTransferableBuffer(src);
  src[0] = 9;
  // Then the copy is a standalone ArrayBuffer with the original bytes
  assert.ok(copy instanceof ArrayBuffer);
  assert.deepEqual([...new Uint8Array(copy)], [1, 2, 3]);
});

test("buildCreateJob transfers SID and player buffers", () => {
  // Given one SID and sidpl.o bytes
  const sid = new Uint8Array([0x50, 0x53]);
  const sidplay = new Uint8Array([0xaa]);
  // When the worker job is built
  const { message, transfer } = buildCreateJob({
    inputs: [{ sid, baseName: "Tune", playSeconds: 90 }],
    assets: { sidplay },
    title: "BEEBSID",
  });
  // Then SID + player are transferable and menu + one WAV are reserved
  assert.equal(message.progressExtra, 2);
  assert.equal(message.inputs[0].baseName, "Tune");
  assert.equal(message.inputs[0].playSeconds, 90);
  assert.equal(transfer.length, 2);
  for (const buf of transfer) assert.ok(buf instanceof ArrayBuffer);
  const noClips = buildCreateJob({
    inputs: [{ sid, baseName: "Tune" }],
    assets: { sidplay },
    tunePreviews: false,
  });
  assert.equal(noClips.message.progressExtra, 1);
});

test("cloneWorkerResult drops the custom log.push so postMessage can clone it", () => {
  // Given a log array with attachLogSink's push
  const log = ["→ pack-ssd"];
  log.push = () => {
    throw new Error("should not clone this");
  };
  // When the worker result is copied
  const cloned = cloneWorkerResult({
    log,
    meta: { tuneCount: 1 },
    tunes: [{ baseName: "Head_Over_Heels", title: "Head Over Heels", bbcSid: {} }],
  });
  // Then log is a plain array and tunes keep only names
  assert.deepEqual(cloned.log, ["→ pack-ssd"]);
  assert.equal(cloned.log.push, Array.prototype.push);
  assert.deepEqual(cloned.tunes, [
    { baseName: "Head_Over_Heels", title: "Head Over Heels" },
  ]);
  assert.doesNotThrow(() => structuredClone(cloned));
});

test("applyWorkerMessage fans log, progress, done, and error out", () => {
  // Given UI handlers
  const log = [];
  const progress = [];
  let done = null;
  let error = null;
  const handlers = {
    onLog: (line) => log.push(line),
    onProgress: (p) => progress.push(p),
    onDone: (msg) => {
      done = msg;
    },
    onError: (err) => {
      error = err;
    },
  };
  // When worker messages arrive
  assert.equal(applyWorkerMessage({ type: "log", line: "→ pack-ssd" }, handlers), "log");
  assert.equal(
    applyWorkerMessage(
      { type: "progress", phase: "pack", current: 2, total: 3, label: "pack" },
      handlers,
    ),
    "progress",
  );
  assert.equal(applyWorkerMessage({ type: "done", ssd: new ArrayBuffer(2) }, handlers), "done");
  assert.equal(applyWorkerMessage({ type: "error", message: "no tunes" }, handlers), "error");
  // Then each handler saw its payload
  assert.deepEqual(log, ["→ pack-ssd"]);
  assert.deepEqual(progress, [
    { phase: "pack", current: 2, total: 3, label: "pack" },
  ]);
  assert.ok(done?.ssd);
  assert.equal(error.message, "no tunes");
});
