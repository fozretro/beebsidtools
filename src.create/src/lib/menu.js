/**
 * SIDPLAY M.MENU binary, DFS tune names (S.nnXXXXX), and !BOOT.
 *
 * Port of Dominic Beesley's mkssd.sh menu / !BOOT layout (sidplay-build / Stardot).
 *
 *   [count][N × 42-byte entries][N × uint16 LE seconds][BSMN][format]
 *
 * Format 1 = times table + version trailer. The player only reads count,
 * entries, and seconds; it ignores the trailer. Older discs have no trailer
 * (and often no times) — upgradeMenu fills those in so we do not guess later.
 */

import {
  DEFAULT_PLAY_SECONDS,
  MENU_BUF_SIZE,
  playSecondsOrDefault,
} from "./songlengths.js";

export { DEFAULT_PLAY_SECONDS, MENU_BUF_SIZE } from "./songlengths.js";

export const MENU_ENTRY_SIZE = 42;

/** ASCII "BSMN" (BeebSID MeNu) after the seconds table. */
export const MENU_MAGIC = Buffer.from("BSMN", "ascii");

/** Current M.MENU payload after the entries. */
export const MENU_FORMAT = 1;

export const MENU_TRAILER_SIZE = MENU_MAGIC.length + 1;

export function menuTrailer(format = MENU_FORMAT) {
  return Buffer.concat([MENU_MAGIC, Buffer.from([format])]);
}

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
  parts.push(menuTrailer());
  const menu = Buffer.concat(parts);
  if (menu.length > MENU_BUF_SIZE) {
    throw new Error(
      `M.MENU ${menu.length} bytes > player buffer ${MENU_BUF_SIZE}`,
    );
  }
  return menu;
}

/**
 * @param {Buffer|Uint8Array} buf
 * @returns {{ count: number, entriesEnd: number, timesEnd: number, hasTimes: boolean, format: number|null }}
 */
export function inspectMenu(buf) {
  const menu = Buffer.from(buf);
  if (!menu.length) throw new Error("M.MENU is empty");
  const count = menu[0];
  if (!count || count > 31) throw new Error(`M.MENU: bad tune count ${count}`);
  const entriesEnd = 1 + count * MENU_ENTRY_SIZE;
  if (menu.length < entriesEnd) {
    throw new Error("M.MENU: truncated catalogue");
  }
  const timesEnd = entriesEnd + count * 2;
  const hasTimes = menu.length >= timesEnd;
  let format = null;
  if (hasTimes && menu.length >= timesEnd + MENU_TRAILER_SIZE) {
    const magic = menu.subarray(timesEnd, timesEnd + MENU_MAGIC.length);
    if (magic.equals(MENU_MAGIC)) {
      format = menu[timesEnd + MENU_MAGIC.length];
    }
  }
  return { count, entriesEnd, timesEnd, hasTimes, format };
}

/**
 * Bring an on-disc M.MENU up to MENU_FORMAT (times + trailer).
 * Missing or zero times become DEFAULT_PLAY_SECONDS.
 *
 * @param {Buffer|Uint8Array} buf
 * @returns {{ menu: Buffer, changed: boolean, addedTimes: boolean, format: number }}
 */
export function upgradeMenu(buf) {
  const info = inspectMenu(buf);
  if (info.format != null && info.format > MENU_FORMAT) {
    throw new Error(
      `M.MENU format ${info.format} is newer than this tool (${MENU_FORMAT})`,
    );
  }
  if (info.format === MENU_FORMAT) {
    return {
      menu: Buffer.from(buf),
      changed: false,
      addedTimes: false,
      format: MENU_FORMAT,
    };
  }

  const src = Buffer.from(buf);
  const times = Buffer.alloc(info.count * 2);
  let addedTimes = !info.hasTimes;
  if (info.hasTimes) {
    src.copy(times, 0, info.entriesEnd, info.timesEnd);
    for (let i = 0; i < info.count; i++) {
      if (times.readUInt16LE(i * 2) === 0) {
        times.writeUInt16LE(DEFAULT_PLAY_SECONDS, i * 2);
        addedTimes = true;
      }
    }
  } else {
    for (let i = 0; i < info.count; i++) {
      times.writeUInt16LE(playSecondsOrDefault(undefined), i * 2);
    }
  }

  const menu = Buffer.concat([
    src.subarray(0, info.entriesEnd),
    times,
    menuTrailer(),
  ]);
  if (menu.length > MENU_BUF_SIZE) {
    throw new Error(
      `M.MENU ${menu.length} bytes > player buffer ${MENU_BUF_SIZE}`,
    );
  }
  return { menu, changed: true, addedTimes, format: MENU_FORMAT };
}

/** !BOOT: Mode 7 then *SIDPLAY (CR-terminated BBC lines). */
export function buildBoot() {
  return Buffer.from("MO.7\r*SIDPLAY\r", "ascii");
}
