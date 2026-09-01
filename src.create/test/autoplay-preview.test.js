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
import { GOLDEN_SSD_TUNES } from "./lib/golden-ssd.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SSD = join(HERE, "golden/tunes.ssd");
const HINT_ADDR = 0x7c00 + 40 + 20;
const TIMER_ADDR = 0x7c00 + 24 * 40 + 25;
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
      // Given a golden SSD booted to the SIDPLAY menu
      assert.ok(existsSync(GOLDEN_SSD), `missing ${GOLDEN_SSD}`);
      const session = new MachineSession("B1770", { discImage: GOLDEN_SSD });
      try {
        await session.initialise();
        await session.boot(30);
        await bootToMenu(session, { timeoutMs: 60_000 });
        await session.runFor(CYCLES_PER_POLL);
        assert.equal(asciiAt(session, HINT_ADDR, 6), "A AUTO");

        // When A is pressed
        await tapKey(session, keyCodes.A);
        await waitFor(
          session,
          () =>
            session.readMemory(AUTOPLAY_ADDR, 1)[0] === 1 &&
            session.readMemory(LAST_MENU_ADDR, 1)[0] === 0,
        );

        // Then auto-play is on and the timer shows 03:00
        assert.equal(asciiAt(session, TIMER_ADDR, 5), "03:00");

        // When period is pressed
        await tapKey(session, keyCodes.PERIOD);
        await waitFor(
          session,
          () => session.readMemory(AUTOPLAY_ADDR, 1)[0] === 0,
        );
        // Then auto-play is off and the timer is blank
        assert.equal(asciiAt(session, TIMER_ADDR, 5), "     ");

        // When Escape returns to the menu and A then Return skip a catalogue tune
        await tapKey(session, keyCodes.ESCAPE);
        await waitFor(
          session,
          () => asciiAt(session, HINT_ADDR, 6) === "A AUTO",
        );

        await tapKey(session, keyCodes.A);
        await waitFor(
          session,
          () => session.readMemory(AUTOPLAY_ADDR, 1)[0] === 1,
        );

        const first = Buffer.from(session.readMemory(TUNE_CODE, 16));
        await tapKey(session, keyCodes.ENTER);
        // Then auto-play stays on and the next catalogue tune is loaded
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

  it(
    "Down does not move past the last catalogue SID",
    { timeout: 90_000 },
    async () => {
      // Given a golden SSD booted to the SIDPLAY menu
      assert.ok(existsSync(GOLDEN_SSD), `missing ${GOLDEN_SSD}`);
      const last = GOLDEN_SSD_TUNES.length - 1;
      const session = new MachineSession("B1770", { discImage: GOLDEN_SSD });
      try {
        await session.initialise();
        await session.boot(30);
        await bootToMenu(session, { timeoutMs: 60_000 });
        await session.runFor(CYCLES_PER_POLL);

        // When Down is pressed past the last SID and Return starts that row
        for (let i = 0; i < last + 6; i++) {
          await tapKey(session, keyCodes.DOWN);
        }
        await tapKey(session, keyCodes.ENTER);
        // Then the last catalogue tune plays
        await waitFor(
          session,
          () => session.readMemory(LAST_MENU_ADDR, 1)[0] === last,
        );
      } finally {
        session.destroy();
      }
    },
  );
});
