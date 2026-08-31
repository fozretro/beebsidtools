import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIDPLAY_LOAD,
  SIDPELK_LOAD,
  TUNE_LOAD,
  bbcSidMaxBytes,
  describeTuneRam,
  assertTuneFitsRam,
  formatTuneRam,
} from "../src/lib/tuneRam.js";

test("SIDPLAY budget is $6000-$19F8", () => {
  // Given SIDPLAY at $6000
  // When bbcSidMaxBytes measures the tune window
  // Then the budget is $4608 bytes
  assert.equal(bbcSidMaxBytes(SIDPLAY_LOAD), 0x4608);
  assert.equal(bbcSidMaxBytes(SIDPLAY_LOAD), 17928);
});

test("SIDPELK budget is tighter", () => {
  // Given SIDPELK at its Electron load address
  // When bbcSidMaxBytes measures both players
  // Then SIDPELK allows fewer bytes than SIDPLAY
  assert.equal(bbcSidMaxBytes(SIDPELK_LOAD), 0x2e08);
  assert.ok(bbcSidMaxBytes(SIDPELK_LOAD) < bbcSidMaxBytes(SIDPLAY_LOAD));
});

test("RoboCop-sized image fits SIDPLAY and misses SIDPELK", () => {
  // Given a 13326-byte image
  const robocop = { length: 13326 };
  // When describeTuneRam checks both load addresses
  // Then it fits SIDPLAY and overruns SIDPELK
  assert.equal(describeTuneRam(robocop, SIDPLAY_LOAD).over, false);
  assert.equal(describeTuneRam(robocop, SIDPELK_LOAD).over, true);
});

test("assertTuneFitsRam throws over SIDPLAY", () => {
  // Given an image one byte over the SIDPLAY budget
  const huge = { length: bbcSidMaxBytes() + 1 };
  // When assertTuneFitsRam checks it
  // Then it throws that SIDPLAY would be overwritten
  assert.throws(
    () => assertTuneFitsRam(huge, { name: "Huge" }),
    /Huge:.*overwrites SIDPLAY/,
  );
});

test("formatTuneRam names the load range", () => {
  // Given a short tune named Tiny
  const ok = { length: 100 };
  // When formatTuneRam describes it
  const text = formatTuneRam("Tiny", ok);
  // Then the text names the tune and SIDPLAY range

  assert.match(text, /Tiny:/);
  assert.match(text, new RegExp(`\\$${TUNE_LOAD.toString(16)}`));
  assert.match(text, /SIDPLAY/);
});
