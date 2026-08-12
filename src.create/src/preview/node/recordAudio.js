/**
 * Node preview audio: shared recorder + optional disk write / full SSD boot.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MachineSession } from "jsbeeb/machine-session";
import { bootToMenu, CYCLES_PER_POLL } from "../beebMenu.js";
import {
  recordFromSession as recordFromSessionCore,
  pressReturn,
  pcmRmsS16le,
  BEEBSID_BASE,
  DEFAULT_RECORD_SECONDS,
} from "../recordAudio.js";

export {
  pressReturn,
  pcmRmsS16le,
  BEEBSID_BASE,
  DEFAULT_RECORD_SECONDS,
};

/**
 * @param {import("jsbeeb/machine-session").MachineSession} session
 * @param {{ seconds?: number, wavPath?: string }} opts
 */
export async function recordFromSession(session, opts = {}) {
  const result = await recordFromSessionCore(session, opts);
  if (opts.wavPath) {
    mkdirSync(dirname(opts.wavPath), { recursive: true });
    writeFileSync(opts.wavPath, result.wav);
  }
  return { ...result, wavPath: opts.wavPath || undefined };
}

/**
 * Boot SSD → menu → record first tune to WAV (and optional menu PNG).
 */
export async function recordSsdAudio({
  ssdPath,
  wavPath,
  seconds = DEFAULT_RECORD_SECONDS,
  pngPath = null,
  timeoutMs = 60_000,
  model = "B1770",
  expectTune0 = null,
}) {
  if (!ssdPath) throw new Error("recordSsdAudio: ssdPath required");
  if (!wavPath) throw new Error("recordSsdAudio: wavPath required");

  const session = new MachineSession(model, { discImage: ssdPath });
  try {
    await session.initialise();
    await session.boot(30);
    const { tune0 } = await bootToMenu(session, { timeoutMs, expectTune0 });

    if (pngPath) {
      await session.runFor(CYCLES_PER_POLL);
      const png = await session.screenshotActive({ scale: 2 });
      mkdirSync(dirname(pngPath), { recursive: true });
      writeFileSync(pngPath, png);
    }

    const audio = await recordFromSession(session, { seconds, wavPath });
    return { tune0, ...audio, pngPath: pngPath || undefined };
  } finally {
    session.destroy();
  }
}
