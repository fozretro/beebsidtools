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
  assert.equal(bbcSidMaxBytes(SIDPLAY_LOAD), 0x4608);
  assert.equal(bbcSidMaxBytes(SIDPLAY_LOAD), 17928);
});

test("SIDPELK budget is tighter", () => {
  assert.equal(bbcSidMaxBytes(SIDPELK_LOAD), 0x2e08);
  assert.ok(bbcSidMaxBytes(SIDPELK_LOAD) < bbcSidMaxBytes(SIDPLAY_LOAD));
});

test("RoboCop-sized image fits SIDPLAY and misses SIDPELK", () => {
  const robocop = { length: 13326 };
  assert.equal(describeTuneRam(robocop, SIDPLAY_LOAD).over, false);
  assert.equal(describeTuneRam(robocop, SIDPELK_LOAD).over, true);
});

test("assertTuneFitsRam throws over SIDPLAY", () => {
  const huge = { length: bbcSidMaxBytes() + 1 };
  assert.throws(
    () => assertTuneFitsRam(huge, { name: "Huge" }),
    /Huge:.*overwrites SIDPLAY/,
  );
});

test("formatTuneRam names the load range", () => {
  const ok = { length: 100 };
  const text = formatTuneRam("Tiny", ok);
  assert.match(text, /Tiny:/);
  assert.match(text, new RegExp(`\\$${TUNE_LOAD.toString(16)}`));
  assert.match(text, /SIDPLAY/);
});
