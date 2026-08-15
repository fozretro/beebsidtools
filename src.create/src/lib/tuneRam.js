/**
 * BBC RAM budget for a .bbcsid loaded under SIDPLAY / SIDPELK.
 * Tune DFS load is $19F8; SIDPLAY is $6000; SIDPELK is $4800.
 */

export const TUNE_LOAD = 0x19f8;
export const SIDPLAY_LOAD = 0x6000;
export const SIDPELK_LOAD = 0x4800;

export function bbcSidMaxBytes(playerLoad = SIDPLAY_LOAD) {
  return playerLoad - TUNE_LOAD;
}

export function bbcSidEnd(byteLength) {
  return TUNE_LOAD + byteLength;
}

export function playerName(playerLoad = SIDPLAY_LOAD) {
  return playerLoad === SIDPELK_LOAD ? "SIDPELK" : "SIDPLAY";
}

/**
 * @param {Buffer|Uint8Array} bbcSid
 * @param {number} [playerLoad]
 * @returns {{ end: number, max: number, free: number, over: boolean }}
 */
export function describeTuneRam(bbcSid, playerLoad = SIDPLAY_LOAD) {
  const end = bbcSidEnd(bbcSid.length);
  const max = bbcSidMaxBytes(playerLoad);
  const free = playerLoad - end;
  return { end, max, free, over: free < 0 };
}

/**
 * One-line RAM report (fits or overflow).
 * @param {string} name
 * @param {Buffer|Uint8Array} bbcSid
 * @param {number} [playerLoad]
 */
export function formatTuneRam(name, bbcSid, playerLoad = SIDPLAY_LOAD) {
  const { end, max, free, over } = describeTuneRam(bbcSid, playerLoad);
  const who = playerName(playerLoad);
  const range = `$${TUNE_LOAD.toString(16)}–$${(end - 1).toString(16)}`;
  if (over) {
    return (
      `${name}: .bbcsid is ${bbcSid.length} bytes (loads ${range}), ` +
      `which overwrites ${who} at $${playerLoad.toString(16)}. ` +
      `Maximum is ${max} bytes ($${max.toString(16)}).`
    );
  }
  return (
    `${name}: ${bbcSid.length} bytes ${range} ` +
    `(${free} bytes free before ${who} $${playerLoad.toString(16)})`
  );
}

/**
 * @param {Buffer|Uint8Array} bbcSid
 * @param {{ name?: string, playerLoad?: number }} [opts]
 */
export function assertTuneFitsRam(bbcSid, opts = {}) {
  const playerLoad = opts.playerLoad ?? SIDPLAY_LOAD;
  const name = opts.name ?? "tune";
  const { over } = describeTuneRam(bbcSid, playerLoad);
  if (over) throw new Error(formatTuneRam(name, bbcSid, playerLoad));
}
