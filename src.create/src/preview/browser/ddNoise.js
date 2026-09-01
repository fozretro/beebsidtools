/**
 * Live disc-drive samples. jsbeeb SamplePlayer XHR/`data.buffer` fails to
 * decode under Vite, so sounds are fetch + decodeAudioData.
 */

import { DdNoise } from "jsbeeb/src/ddnoise.js";
import {
  DISC525_SOUNDS,
  driveAlreadySpinning,
  patchFakeDdNoise,
} from "../disc525.js";

/**
 * @param {AudioContext} audioCtx
 * @param {string} romBaseUrl
 */
export async function loadDisc525Sounds(audioCtx, romBaseUrl) {
  const base = romBaseUrl.endsWith("/") ? romBaseUrl : `${romBaseUrl}/`;
  /** @type {Record<string, AudioBuffer>} */
  const sounds = {};
  await Promise.all(
    Object.entries(DISC525_SOUNDS).map(async ([key, rel]) => {
      const url = base + rel;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Missing disc noise ${url}`);
      const ab = await res.arrayBuffer();
      sounds[key] = await audioCtx.decodeAudioData(ab.slice(0));
    }),
  );
  return sounds;
}

/**
 * Patch TestMachine's FakeDdNoise so the FDC plays samples.
 * @param {AudioContext} audioCtx
 * @param {object} processor
 * @param {string} romBaseUrl
 */
export async function attachDiscDriveNoise(audioCtx, processor, romBaseUrl) {
  const dd = new DdNoise(audioCtx, audioCtx.destination);
  dd.sounds = await loadDisc525Sounds(audioCtx, romBaseUrl);
  const unpatch = patchFakeDdNoise(processor.ddNoise, dd);
  if (driveAlreadySpinning(processor)) dd.spinUp();
  return {
    dispose() {
      unpatch();
    },
  };
}
