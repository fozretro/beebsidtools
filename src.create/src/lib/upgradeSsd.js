/**
 * Replace SIDPLAY / SIDPELK on an existing SSD and bring M.MENU to format 1.
 */

import { openDisc, rebuildDisc, toBuffer } from "./dfs.js";
import { upgradeMenu } from "./menu.js";

function sameBytes(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && x.equals(y);
}

function findFile(parsed, want) {
  const u = want.toUpperCase();
  return parsed.files.find((f) => f.dfsName.toUpperCase() === u);
}

/**
 * @param {Buffer|Uint8Array} ssd
 * @returns {string|null} error, or null if SIDPLAY + M.MENU are present
 */
export function beebSidSsdError(ssd) {
  try {
    const parsed = openDisc(ssd);
    if (!findFile(parsed, "SIDPLAY")) return "Not a BeebSID disc (no SIDPLAY)";
    if (!findFile(parsed, "M.MENU")) return "Not a BeebSID disc (no M.MENU)";
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Not a BeebSID disc";
  }
}

/** @param {Buffer|Uint8Array} ssd */
export function isBeebSidSsd(ssd) {
  return beebSidSsdError(ssd) == null;
}

/**
 * @typedef {{
 *   player: boolean,
 *   sidpelk: boolean,
 *   hex: boolean,
 *   menuTimes: boolean,
 *   menuFormat: boolean,
 *   format: number,
 * }} UpgradeReport
 */

/** @param {UpgradeReport} report */
export function upgradeNeeded(report) {
  return !!(
    report.player ||
    report.sidpelk ||
    report.hex ||
    report.menuTimes ||
    report.menuFormat
  );
}

/**
 * @param {Buffer|Uint8Array} ssd
 * @param {{ sidplay: Buffer|Uint8Array, sidpelk?: Buffer|Uint8Array, hex?: Buffer|Uint8Array }} assets
 */
function planUpgrade(ssd, assets) {
  if (!assets?.sidplay) throw new Error("upgradeBeebSidSsd: assets.sidplay required");
  const parsed = openDisc(ssd);
  const player = findFile(parsed, "SIDPLAY");
  if (!player) throw new Error("Not a BeebSID disc (no SIDPLAY)");
  const menuFile = findFile(parsed, "M.MENU");
  if (!menuFile) throw new Error("Not a BeebSID disc (no M.MENU)");

  const replacements = new Map();
  /** @type {UpgradeReport} */
  const report = {
    player: false,
    sidpelk: false,
    hex: false,
    menuTimes: false,
    menuFormat: false,
    format: 1,
  };

  if (!sameBytes(player.data, assets.sidplay)) {
    replacements.set(player.dfsName, Buffer.from(assets.sidplay));
    report.player = true;
  }

  const elk = findFile(parsed, "SIDPELK");
  if (elk && assets.sidpelk && !sameBytes(elk.data, assets.sidpelk)) {
    replacements.set(elk.dfsName, Buffer.from(assets.sidpelk));
    report.sidpelk = true;
  }

  const hex = findFile(parsed, "F.HEX");
  if (hex && assets.hex && !sameBytes(hex.data, assets.hex)) {
    replacements.set(hex.dfsName, Buffer.from(assets.hex));
    report.hex = true;
  }

  const menuUp = upgradeMenu(menuFile.data);
  report.menuTimes = menuUp.addedTimes;
  report.menuFormat = menuUp.changed;
  report.format = menuUp.format;
  if (menuUp.changed) replacements.set(menuFile.dfsName, menuUp.menu);

  return { parsed, replacements, report };
}

/**
 * What upgradeBeebSidSsd would change, without writing a new image.
 * @param {Buffer|Uint8Array} ssd
 * @param {{ sidplay: Buffer|Uint8Array, sidpelk?: Buffer|Uint8Array, hex?: Buffer|Uint8Array }} assets
 */
export function describeBeebSidUpgrade(ssd, assets) {
  return planUpgrade(ssd, assets).report;
}

/**
 * @param {Buffer|Uint8Array} ssd
 * @param {{ sidplay: Buffer|Uint8Array, sidpelk?: Buffer|Uint8Array, hex?: Buffer|Uint8Array }} assets
 * @returns {{ ssd: Buffer, report: UpgradeReport }}
 */
export function upgradeBeebSidSsd(ssd, assets) {
  const { parsed, replacements, report } = planUpgrade(ssd, assets);
  if (replacements.size === 0) {
    return { ssd: Buffer.from(ssd), report };
  }
  return { ssd: toBuffer(rebuildDisc(parsed, replacements)), report };
}
