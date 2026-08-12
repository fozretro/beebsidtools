/**
 * Shared jsbeeb helpers: SHIFT+BREAK to SIDPLAY Mode 7 menu.
 */

import { Buffer } from "buffer";
import { keyCodes } from "jsbeeb/src/utils.js";

/** Spaced teletext title at $7C2D (and $7C55) from menu.bin */
export const MENU_TITLE_ADDR = 0x7c2d;
export const MENU_TITLE_BYTES = Buffer.from("S I D P L A Y");
export const MENU_DH_ADDR = 0x7c29;
export const MENU_DH_BYTE = 0x8d;
/** First tune title colour+text row (show_men); ASCII starts at $7CA5 */
export const MENU_TUNE0_ADDR = 0x7ca5;

export const CYCLES_PER_POLL = 500_000;
export const SHIFT_HOLD_CYCLES = 2_000_000;
/** Settle time after each DFS command before the next / screenshot */
export const FREE_SETTLE_CYCLES = 1_500_000;

/**
 * At a BASIC prompt (after session.boot), run `*CAT` then `*FREE`.
 * Requires Acorn 1770 DFS (jsbeeb model B1770) for `*FREE`.
 * Caller takes the screenshot.
 * @param {{ type: Function, runFor: Function }} session
 */
export async function runCatAndFree(session) {
  await session.type("*CAT");
  await session.runFor(FREE_SETTLE_CYCLES);
  await session.type("*FREE");
  await session.runFor(FREE_SETTLE_CYCLES);
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function hexDump(bytes, startAddr) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const slice = bytes.slice(i, i + 16);
    const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = [...slice]
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
      .join("");
    lines.push(
      `${(startAddr + i).toString(16).toUpperCase().padStart(4, "0")}: ${hex}  ${ascii}`,
    );
  }
  return lines.join("\n");
}

/**
 * SHIFT+BREAK an initialised session and wait for the Mode 7 SIDPLAY menu.
 * @param {import("jsbeeb/machine-session").MachineSession} session
 * @param {{ timeoutMs?: number, expectTune0?: Uint8Array|Buffer|string|null }} [opts]
 * @returns {Promise<{ tune0: string }>}
 */
export async function bootToMenu(session, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const expectTune0 = opts.expectTune0 ?? null;

  session.keyDown(keyCodes.SHIFT);
  session.reset(true);
  await session.runFor(SHIFT_HOLD_CYCLES);
  session.keyUp(keyCodes.SHIFT);

  const deadline = Date.now() + timeoutMs;
  let ready = false;
  while (Date.now() < deadline) {
    await session.runFor(CYCLES_PER_POLL);
    const title = session.readMemory(MENU_TITLE_ADDR, MENU_TITLE_BYTES.length);
    const dh = session.readMemory(MENU_DH_ADDR, 1)[0];
    if (bytesEqual(title, MENU_TITLE_BYTES) && dh === MENU_DH_BYTE) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    const dump = session.readMemory(0x7c00, 0x80);
    throw new Error(
      `bootToMenu: Mode 7 menu not reached within ${timeoutMs}ms\n` +
        hexDump(dump, 0x7c00),
    );
  }

  const tune0Buf = Buffer.from(session.readMemory(MENU_TUNE0_ADDR, 32));
  const tune0 = tune0Buf.toString("ascii").replace(/\0/g, " ").trimEnd();

  if (expectTune0 != null) {
    const want = Buffer.isBuffer(expectTune0)
      ? expectTune0
      : Buffer.from(expectTune0);
    if (!tune0Buf.subarray(0, want.length).equals(want)) {
      throw new Error(
        `bootToMenu: tune0 at $${MENU_TUNE0_ADDR.toString(16)} expected ` +
          `${JSON.stringify(want.toString("ascii"))}, got ${JSON.stringify(tune0)}`,
      );
    }
  }

  return { tune0 };
}
