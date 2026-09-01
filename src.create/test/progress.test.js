import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertProgressUpdate,
  convertTunesStage,
  createContext,
  createSsd,
  packProgressUpdate,
  previewProgressUpdate,
  previewStepCount,
  progressTotal,
  reportProgress,
  runPipeline,
} from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SIDPLAY = join(HERE, "../../src.player/out/sidpl.o");

const GARBAGE = {
  sid: Buffer.from("not a sid"),
  baseName: "Garbage",
};

test("progressTotal is tunes plus pack plus extras", () => {
  // Given two SIDs and reserved preview steps
  // When progressTotal counts the run
  // Then pack is included and preview sits at the end
  assert.equal(previewStepCount(2), 3);
  assert.equal(progressTotal(2, previewStepCount(2)), 6);
  assert.equal(progressTotal(0), 1);
});

test("convert / pack / preview steps share one total", () => {
  // Given two inputs and menu + two WAV preview steps
  const ctx = {
    inputs: [{}, {}],
    progressTotal: 6,
    previewSteps: 3,
  };
  // When each phase asks for its update
  // Then convert is 1-based, pack follows the last tune, preview is not already done
  assert.deepEqual(convertProgressUpdate(ctx, 0, "Cybernoid"), {
    phase: "convert",
    current: 1,
    total: 6,
    label: "Cybernoid",
  });
  assert.deepEqual(packProgressUpdate(ctx), {
    phase: "pack",
    current: 3,
    total: 6,
    label: "pack",
  });
  assert.deepEqual(previewProgressUpdate(ctx, { step: 0, label: "menu" }), {
    phase: "preview",
    current: 4,
    total: 6,
    label: "menu",
  });
  assert.deepEqual(previewProgressUpdate(ctx, { step: 2, label: "Tune" }), {
    phase: "preview",
    current: 6,
    total: 6,
    label: "Tune",
  });
  assert.deepEqual(previewProgressUpdate(ctx, { done: true }), {
    phase: "preview",
    current: 6,
    total: 6,
    label: "preview",
    done: true,
  });
});

test("reportProgress forwards a snapshot to onProgress", () => {
  // Given a context with an onProgress listener
  const seen = [];
  const ctx = {
    onProgress: (p) => seen.push(p),
  };
  // When reportProgress is called
  reportProgress(ctx, {
    phase: "convert",
    current: 1,
    total: 3,
    label: "Head_Over_Heels",
  });
  // Then the listener receives phase, current, total, and label
  assert.deepEqual(seen, [
    {
      phase: "convert",
      current: 1,
      total: 3,
      label: "Head_Over_Heels",
    },
  ]);
});

test("reportProgress ignores a throwing listener", () => {
  // Given an onProgress that throws
  const ctx = {
    onProgress: () => {
      throw new Error("listener boom");
    },
  };
  // When reportProgress is called
  // Then it does not throw
  reportProgress(ctx, { phase: "pack", current: 1, total: 1, label: "pack" });
});

test("convert-tunes reports one progress event per input", async () => {
  // Given two garbage SIDs and skip-on-error
  const events = [];
  // When convert-tunes runs
  await assert.rejects(
    () =>
      runPipeline(
        [convertTunesStage({ onError: "skip" })],
        createContext({
          inputs: [GARBAGE, { ...GARBAGE, baseName: "Junk2" }],
          onProgress: (p) => events.push(p),
        }),
      ),
    /No tunes converted/,
  );
  // Then onProgress fired convert 1/3 and 2/3 before pack is reached
  assert.deepEqual(events, [
    { phase: "convert", current: 1, total: 3, label: "Garbage" },
    { phase: "convert", current: 2, total: 3, label: "Junk2" },
  ]);
});

test("createSsd reports convert progress before an empty pack fails", async () => {
  // Given only a garbage input
  assert.ok(existsSync(SIDPLAY), `missing ${SIDPLAY}`);
  const events = [];
  // When createSsd packs
  await assert.rejects(
    () =>
      createSsd([GARBAGE], {
        assets: { sidplay: readFileSync(SIDPLAY) },
        onProgress: (p) => events.push(p),
      }),
    /No tunes converted/,
  );
  // Then convert was reported as 1 of tunes+pack
  assert.deepEqual(events, [
    { phase: "convert", current: 1, total: 2, label: "Garbage" },
  ]);
});
