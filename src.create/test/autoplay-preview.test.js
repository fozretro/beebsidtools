/**
 * Headless SIDPLAY auto-play keys on golden tunes.ssd.
 * Not included in test:fast (jsbeeb boot).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MachineSession } from "jsbeeb/machine-session";
import { bootToMenu, CYCLES_PER_POLL } from "../src/preview/beebMenu.js";
import { keyCodes } from "../src/preview/keyCodes.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SSD = join(HERE, "golden/tunes.ssd");
const HINT_ADDR = 0x7c00 + 40 + 20;
/** SIDPLAY `.autoplay` / `.last_menu_run` in sidpl.lst (ORG $6000). */
const AUTOPLAY_ADDR = 0x606d;
const LAST_MENU_ADDR = 0x6072;
const TUNE_CODE = 0x1a00;

const KEY_HOLD = 250_000;
const KEY_GAP = 400_000;

async function tapKey(session, keyCode) {
  session.keyDown(keyCode);
  await session.runFor(KEY_HOLD);
  session.keyUp(keyCode);
  await session.runFor(KEY_GAP);
}

function asciiAt(session, addr, n) {
  return Buffer.from(session.readMemory(addr, n)).toString("ascii");
}

async function waitFor(session, pred, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await session.runFor(CYCLES_PER_POLL);
    if (pred()) return;
  }
  throw new Error("autoplay-preview: timed out waiting for screen");
}

describe("SIDPLAY auto-play (jsbeeb)", () => {
  it(
    "A starts auto-play; Return skips to the next catalogue tune",
    { timeout: 90_000 },
    async () => {
      assert.ok(existsSync(GOLDEN_SSD), `missing ${GOLDEN_SSD}`);
      const session = new MachineSession("B1770", { discImage: GOLDEN_SSD });
      try {
        await session.initialise();
        await session.boot(30);
        await bootToMenu(session, { timeoutMs: 60_000 });
        await session.runFor(CYCLES_PER_POLL);

        assert.equal(asciiAt(session, HINT_ADDR, 6), "A AUTO");

        await tapKey(session, keyCodes.A);
        await waitFor(
          session,
          () =>
            session.readMemory(AUTOPLAY_ADDR, 1)[0] === 1 &&
            session.readMemory(LAST_MENU_ADDR, 1)[0] === 0,
        );

        const first = Buffer.from(session.readMemory(TUNE_CODE, 16));
        await tapKey(session, keyCodes.ENTER);
        await waitFor(
          session,
          () =>
            session.readMemory(AUTOPLAY_ADDR, 1)[0] === 1 &&
            session.readMemory(LAST_MENU_ADDR, 1)[0] === 1 &&
            !Buffer.from(session.readMemory(TUNE_CODE, 16)).equals(first),
        );
      } finally {
        session.destroy();
      }
    },
  );
});
