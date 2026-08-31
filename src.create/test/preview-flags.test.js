import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPreviewFlag,
  previewOptsFromFlags,
  previewStepCount,
  wantTunePreviews,
} from "../src/index.js";

test("wantTunePreviews treats audio and tunePreviews as the same knob", () => {
  // Given no preview options
  // When wantTunePreviews reads defaults
  // Then clips are on (Disc Creator / stage default)
  assert.equal(wantTunePreviews({}), true);
  // Given an explicit off flag
  // When either name is used
  // Then clips are off
  assert.equal(wantTunePreviews({ audio: false }), false);
  assert.equal(wantTunePreviews({ tunePreviews: false }), false);
  // Given both, tunePreviews wins
  assert.equal(wantTunePreviews({ audio: true, tunePreviews: false }), false);
});

test("previewStepCount drops WAV steps when tune previews are off", () => {
  // Given two packed tunes
  // When previewStepCount counts with clips off
  // Then only the menu shot remains
  assert.equal(previewStepCount(2, { tunePreviews: true }), 3);
  assert.equal(previewStepCount(2, { tunePreviews: false }), 1);
});

test("CLI --tune-previews enables WAV clips", () => {
  // Given --tune-previews (or the older --record-audio name)
  const flags = new Set();
  // When the flag is applied
  assert.equal(applyPreviewFlag(flags, "--tune-previews"), true);
  // Then preview runs with audio
  assert.deepEqual(previewOptsFromFlags(flags, 15), {
    audio: true,
    tunePreviews: true,
    secondsPerTune: 15,
  });
  const alias = new Set();
  applyPreviewFlag(alias, "--record-audio");
  assert.equal(previewOptsFromFlags(alias, 15).audio, true);
});

test("CLI --no-tune-previews keeps the menu shot without WAVs", () => {
  // Given a later --no-tune-previews after --record-audio
  const flags = new Set();
  applyPreviewFlag(flags, "--record-audio");
  applyPreviewFlag(flags, "--no-tune-previews");
  // When preview options are resolved
  const opts = previewOptsFromFlags(flags, 15);
  // Then menu preview still runs and clips are off
  assert.deepEqual(opts, {
    audio: false,
    tunePreviews: false,
    secondsPerTune: 15,
  });
});

test("CLI --no-preview with no clips skips the preview stage", () => {
  // Given only --no-preview
  const flags = new Set();
  applyPreviewFlag(flags, "--no-preview");
  // When preview options are resolved
  // Then createSsd gets preview: false
  assert.equal(previewOptsFromFlags(flags, 15), false);
});
