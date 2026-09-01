import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISC525_SOUNDS,
  driveAlreadySpinning,
  patchFakeDdNoise,
} from "../src/preview/disc525.js";

test("DISC525_SOUNDS lists the jsbeeb 5.25 inch samples", () => {
  // Given the path map used by Test Disc
  // When the keys are read
  // Then every motor and seek WAV is present
  assert.deepEqual(Object.keys(DISC525_SOUNDS).sort(), [
    "motor",
    "motorOff",
    "motorOn",
    "seek",
    "seek2",
    "seek3",
    "step",
  ]);
  for (const rel of Object.values(DISC525_SOUNDS)) {
    assert.match(rel, /^sounds\/disc525\/.+\.wav$/);
  }
});

test("patchFakeDdNoise forwards spin and seek onto the stub the FDC holds", () => {
  // Given TestMachine's FakeDdNoise stub and a real player
  const calls = [];
  const stub = {
    spinUp() {},
    spinDown() {},
    seek() {
      return 0;
    },
  };
  const real = {
    spinUp: () => calls.push("up"),
    spinDown: () => calls.push("down"),
    seek: (n) => {
      calls.push(`seek:${n}`);
      return 0.2;
    },
    mute: () => calls.push("mute"),
    unmute: () => calls.push("unmute"),
  };
  // When the stub is patched and the FDC calls through it
  const unpatch = patchFakeDdNoise(stub, real);
  stub.spinUp();
  assert.equal(stub.seek(12), 0.2);
  stub.spinDown();
  // Then the real player ran
  assert.deepEqual(calls, ["up", "seek:12", "down"]);
  // When dispose runs
  unpatch();
  // Then later FDC calls stay silent
  stub.spinUp();
  assert.equal(stub.seek(3), 0);
  assert.deepEqual(calls, ["up", "seek:12", "down", "down"]);
});

test("driveAlreadySpinning is true only when a drive motor is on", () => {
  // Given no FDC
  // Then there is nothing to sync
  assert.equal(driveAlreadySpinning({}), false);
  // Given a spinning drive
  // When attach checks after turbo boot
  // Then the motor sample should start
  assert.equal(
    driveAlreadySpinning({ fdc: { drives: [{ spinning: false }, { spinning: true }] } }),
    true,
  );
});
