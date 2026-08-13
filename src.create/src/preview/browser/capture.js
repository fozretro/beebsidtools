/**
 * Browser turbo SSD preview (same contract as preview/node/capture.js).
 */

import { keyCodes } from "../keyCodes.js";
import { bootToMenu, runCatAndFree, CYCLES_PER_POLL } from "../beebMenu.js";
import { recordFromSession } from "../recordAudio.js";
import { MachineSession, DEFAULT_ROM_BASE } from "./machineSession.js";
import { UI_SECONDS_PER_TUNE } from "../contract.js";

export { UI_SECONDS_PER_TUNE };

const KEY_HOLD = 250_000;
const KEY_GAP = 400_000;

async function tapKey(session, keyCode) {
  session.keyDown(keyCode);
  await session.runFor(KEY_HOLD);
  session.keyUp(keyCode);
  await session.runFor(KEY_GAP);
}

function asBytes(ssd) {
  if (ssd instanceof Uint8Array) return ssd;
  return new Uint8Array(ssd);
}

async function captureOneTune(
  discBytes,
  tuneIndex,
  seconds,
  model,
  timeoutMs,
  romBaseUrl,
) {
  const session = new MachineSession(model, {
    discImage: discBytes,
    romBaseUrl,
  });
  try {
    await session.initialise();
    await session.boot(30);
    const { tune0 } = await bootToMenu(session, { timeoutMs });
    await session.runFor(CYCLES_PER_POLL);

    for (let d = 0; d < tuneIndex; d++) {
      await tapKey(session, keyCodes.DOWN);
    }
    await session.runFor(CYCLES_PER_POLL);

    const { wav } = await recordFromSession(session, { seconds });
    return { tune0, wav };
  } finally {
    session.destroy();
  }
}

/**
 * @param {object} opts
 * @param {Buffer|Uint8Array|ArrayBuffer} opts.ssd
 * @param {number} [opts.tuneCount=1]
 * @param {string[]} [opts.tuneNames]
 * @param {number} [opts.secondsPerTune]
 * @param {boolean} [opts.audio=true]
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.model]
 * @param {string} [opts.romBaseUrl]
 * @param {(line: string) => void} [opts.onLog]
 */
export async function captureSsdPreview({
  ssd,
  tuneCount = 1,
  tuneNames = [],
  secondsPerTune = UI_SECONDS_PER_TUNE,
  audio = true,
  timeoutMs = 60_000,
  // *FREE needs Acorn 1770 DFS (not 8271 DFS 1.2)
  model = "B1770",
  romBaseUrl = DEFAULT_ROM_BASE,
  onLog = null,
}) {
  if (ssd == null) throw new Error("captureSsdPreview: ssd required");
  if (typeof document === "undefined") {
    throw new Error("captureSsdPreview (browser): requires DOM (canvas PNG)");
  }

  const n = Math.max(1, Number(tuneCount) || 1);
  const secs = Number(secondsPerTune) || UI_SECONDS_PER_TUNE;
  const discBytes = asBytes(ssd);
  const log = (line) => {
    if (typeof onLog === "function") onLog(line);
  };

  log("    booting jsbeeb (browser) for *CAT/*FREE + menu screenshots…");
  const shot = new MachineSession(model, {
    discImage: discBytes,
    romBaseUrl,
  });
  let tune0 = "";
  let menuPng;
  let freePng;
  try {
    await shot.initialise();
    await shot.boot(30);
    await runCatAndFree(shot);
    freePng = await shot.screenshotActive({ scale: 2 });
    log(`    *CAT/*FREE capture (${freePng.length} byte PNG)`);
    ({ tune0 } = await bootToMenu(shot, { timeoutMs }));
    await shot.runFor(CYCLES_PER_POLL);
    menuPng = await shot.screenshotActive({ scale: 2 });
    log(`    menu ready (${tune0 || "ok"}, ${menuPng.length} byte PNG)`);
  } finally {
    shot.destroy();
  }

  /** @type {Array<{ index: number, name: string, wav: Buffer }>} */
  const tunes = [];

  if (audio) {
    for (let i = 0; i < n; i++) {
      const name = tuneNames[i] || (i === 0 && tune0 ? tune0 : `tune${i}`);
      log(`    recording ${i + 1}/${n}: ${name} (${secs}s)…`);
      const { wav, tune0: t0 } = await captureOneTune(
        discBytes,
        i,
        secs,
        model,
        timeoutMs,
        romBaseUrl,
      );
      if (!tune0) tune0 = t0;
      const label = tuneNames[i] || (i === 0 && t0 ? t0 : `tune${i}`);
      tunes.push({ index: i, name: label, wav });
      log(`    recorded ${label} (${wav.length} bytes)`);
    }
  }

  return { menuPng, freePng, tune0, tunes };
}
