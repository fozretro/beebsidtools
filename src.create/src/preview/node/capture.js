/**
 * Node turbo SSD preview: menu PNG + short WAV per tune (MachineSession + sharp).
 */

import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MachineSession } from "jsbeeb/machine-session";
import { keyCodes } from "jsbeeb/src/utils.js";
import { bootToMenu, runCatAndFree, CYCLES_PER_POLL } from "../beebMenu.js";
import { recordFromSession } from "../recordAudio.js";
import { UI_SECONDS_PER_TUNE, GOLDEN_SECONDS } from "../contract.js";

export { UI_SECONDS_PER_TUNE, GOLDEN_SECONDS };

const KEY_HOLD = 250_000;
const KEY_GAP = 400_000;

async function tapKey(session, keyCode) {
  session.keyDown(keyCode);
  await session.runFor(KEY_HOLD);
  session.keyUp(keyCode);
  await session.runFor(KEY_GAP);
}

/**
 * Resolve SSD bytes to a filesystem path (MachineSession needs a path).
 * @returns {{ path: string, cleanup: () => void }}
 */
export function materializeSsd(ssd) {
  if (typeof ssd === "string") {
    return { path: ssd, cleanup: () => {} };
  }
  const dir = mkdtempSync(join(tmpdir(), "beebsid-preview-"));
  const path = join(dir, "disc.ssd");
  writeFileSync(path, Buffer.from(ssd));
  return {
    path,
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

async function captureOneTune(ssdPath, tuneIndex, seconds, model, timeoutMs) {
  const session = new MachineSession(model, { discImage: ssdPath });
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
 * @param {string|Buffer|Uint8Array} opts.ssd
 * @param {number} [opts.tuneCount=1]
 * @param {string[]} [opts.tuneNames]
 * @param {number} [opts.secondsPerTune=15]
 * @param {boolean} [opts.audio=true]
 * @param {number} [opts.timeoutMs]
 * @param {string} [opts.model]
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
  onLog = null,
}) {
  if (ssd == null) throw new Error("captureSsdPreview: ssd required");
  const n = Math.max(1, Number(tuneCount) || 1);
  const secs = Number(secondsPerTune) || UI_SECONDS_PER_TUNE;
  const { path: ssdPath, cleanup } = materializeSsd(ssd);
  const log = (line) => {
    if (typeof onLog === "function") onLog(line);
  };

  try {
    log("    booting jsbeeb for *CAT/*FREE + menu screenshots…");
    const shot = new MachineSession(model, { discImage: ssdPath });
    let tune0 = "";
    let menuPng;
    let freePng;
    try {
      await shot.initialise();
      await shot.boot(30);
      await runCatAndFree(shot);
      freePng = Buffer.from(await shot.screenshotActive({ scale: 2 }));
      log(`    *CAT/*FREE capture (${freePng.length} byte PNG)`);
      ({ tune0 } = await bootToMenu(shot, { timeoutMs }));
      await shot.runFor(CYCLES_PER_POLL);
      menuPng = Buffer.from(await shot.screenshotActive({ scale: 2 }));
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
          ssdPath,
          i,
          secs,
          model,
          timeoutMs,
        );
        if (!tune0) tune0 = t0;
        const label = tuneNames[i] || (i === 0 && t0 ? t0 : `tune${i}`);
        tunes.push({ index: i, name: label, wav });
        log(`    recorded ${label} (${wav.length} bytes)`);
      }
    }

    return { menuPng, freePng, tune0, tunes };
  } finally {
    cleanup();
  }
}

/** Write capture result to disk (CLI helper). */
export function writePreviewFiles(
  outDir,
  preview,
  { firstAudioName = "audio.wav", writePng = true } = {},
) {
  mkdirSync(outDir, { recursive: true });
  let pngPath = null;
  if (writePng && preview.menuPng) {
    pngPath = join(outDir, "menu.png");
    writeFileSync(pngPath, preview.menuPng);
  }
  const audioPaths = [];
  for (const t of preview.tunes ?? []) {
    const p = join(outDir, `audio-${String(t.index).padStart(2, "0")}.wav`);
    writeFileSync(p, t.wav);
    audioPaths.push(p);
  }
  if (preview.tunes?.length) {
    const first = join(outDir, firstAudioName);
    writeFileSync(first, preview.tunes[0].wav);
    if (!audioPaths.includes(first)) audioPaths.unshift(first);
  }
  return { pngPath, audioPaths };
}
