/**
 * jsbeeb 5.25" drive samples and the FakeDdNoise patch TestMachine needs.
 * fake6502 always installs FakeDdNoise and the FDC closes over that object.
 */

export const DISC525_SOUNDS = {
  motorOn: "sounds/disc525/motoron.wav",
  motorOff: "sounds/disc525/motoroff.wav",
  motor: "sounds/disc525/motor.wav",
  step: "sounds/disc525/step.wav",
  seek: "sounds/disc525/seek.wav",
  seek2: "sounds/disc525/seek2.wav",
  seek3: "sounds/disc525/seek3.wav",
};

/**
 * Forward spin/seek on the stub the FDC already holds.
 * @param {object} stub
 * @param {{ spinUp: Function, spinDown: Function, seek: Function, mute?: Function, unmute?: Function }} real
 * @returns {() => void}
 */
export function patchFakeDdNoise(stub, real) {
  if (!stub || !real) return () => {};
  stub.spinUp = () => real.spinUp();
  stub.spinDown = () => real.spinDown();
  stub.seek = (diff) => real.seek(diff);
  stub.mute = () => real.mute?.();
  stub.unmute = () => real.unmute?.();
  return function unpatch() {
    real.spinDown();
    stub.spinUp = () => {};
    stub.spinDown = () => {};
    stub.seek = () => 0;
    stub.mute = () => {};
    stub.unmute = () => {};
  };
}

/** @param {{ fdc?: { drives?: { spinning?: boolean }[] } }} processor */
export function driveAlreadySpinning(processor) {
  const drives = processor?.fdc?.drives;
  return Array.isArray(drives) && drives.some((d) => d?.spinning);
}
