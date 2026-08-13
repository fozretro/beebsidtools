/**
 * Parse sidrelocBRK / ----DOM:BRK: poke lists.
 * Format from Dominic Beesley's sidreloc-1.0-dom (sidplay-build / Stardot).
 */

const BRK_RE = /^----DOM:BRK:([0-9A-Fa-f]+)/;

/**
 * @param {string} text
 * @returns {number[]} offsets from SID load address
 */
export function parseBrkList(text) {
  const addrs = [];
  for (const line of text.split(/\r?\n/)) {
    const m = BRK_RE.exec(line);
    if (m) addrs.push(parseInt(m[1], 16));
  }
  return addrs;
}
