/**
 * SIDPLAY M.MENU binary, DFS tune names (S.nnXXXXX), and !BOOT.
 *
 * Port of Dominic Beesley's mkssd.sh menu / !BOOT layout (sidplay-build / Stardot).
 * After the 42-byte entries: uint16 LE play-seconds per tune (SIDPLAY auto-play).
 */

import {
  MENU_BUF_SIZE,
  playSecondsOrDefault,
} from "./songlengths.js";

export { DEFAULT_PLAY_SECONDS, MENU_BUF_SIZE } from "./songlengths.js";

export const MENU_ENTRY_SIZE = 42;

/**
 * BBC DFS name for tune index i and stem (max 9 chars: S.nnXXXXX).
 * @param {number} index
 * @param {string} stem  base name without extension
 */
export function dfsTuneName(index, stem) {
  const stem5 = (stem.replace(/[^A-Za-z0-9_]/g, "").slice(0, 5) + "     ")
    .slice(0, 5)
    .toUpperCase();
  return `S.${String(index).padStart(2, "0")}${stem5}`.slice(0, 9);
}

/** Human title from a basename when PSID title is empty. */
export function titleFromStem(stem) {
  return stem.replace(/_/g, " ").slice(0, 32);
}

/**
 * One menu entry: 9-char name + CR + 32-char title.
 * @param {string} fname
 * @param {string} title
 */
export function menuEntry(fname, title) {
  const name = Buffer.alloc(9, 0x20);
  Buffer.from(fname.slice(0, 9), "ascii").copy(name);
  const tit = Buffer.alloc(32, 0x20);
  Buffer.from(String(title ?? "").slice(0, 32), "ascii").copy(tit);
  return Buffer.concat([name, Buffer.from([0x0d]), tit]);
}

/**
 * @param {Array<{ dfsName: string, title: string, playSeconds?: number }>} entries
 * @returns {Buffer}
 */
export function buildMenu(entries) {
  if (!entries.length || entries.length > 31) {
    throw new Error(`M.MENU needs 1..31 tunes, got ${entries.length}`);
  }
  const parts = [Buffer.from([entries.length])];
  for (const e of entries) {
    parts.push(menuEntry(e.dfsName, e.title));
  }
  const times = Buffer.alloc(entries.length * 2);
  for (let i = 0; i < entries.length; i++) {
    times.writeUInt16LE(playSecondsOrDefault(entries[i].playSeconds), i * 2);
  }
  parts.push(times);
  const menu = Buffer.concat(parts);
  if (menu.length > MENU_BUF_SIZE) {
    throw new Error(
      `M.MENU ${menu.length} bytes > player buffer ${MENU_BUF_SIZE}`,
    );
  }
  return menu;
}

/** !BOOT: Mode 7 then *SIDPLAY (CR-terminated BBC lines). */
export function buildBoot() {
  return Buffer.from("MO.7\r*SIDPLAY\r", "ascii");
}
