/**
 * RoboCop (Jonathan Dunn) — pre-relocate header fix.
 *
 * RSID ships with play=$0000; sidreloc must discover the playroutine via
 * IRQ vectors, which currently fails mid-analysis. The known play entry is
 * $254f (load $2100); after relocate to $1a00 that becomes $1e4f (matches
 * the committed moresids golden). Init also needs a higher cycle budget
 * once play is explicit.
 */

const PLAY = 0x254f;

/**
 * @param {Buffer|Uint8Array} sidData original RoboCop.sid
 */
export function patch(sidData) {
  const sid = Buffer.from(sidData);
  if (sid.length < 0x0e) throw new Error("RoboCop pre-patch: SID too short");
  const prev = (sid[0x0c] << 8) | sid[0x0d];
  sid[0x0c] = (PLAY >> 8) & 0xff;
  sid[0x0d] = PLAY & 0xff;
  return {
    patchedSid: sid,
    stats: { play: PLAY, prevPlay: prev },
    summary: `pre-reloc: play $${prev.toString(16)} → $${PLAY.toString(16)}`,
    /** Merged into relocateSid options by relocateStage. */
    reloc: { initCycles: 2_000_000 },
  };
}

export default {
  id: "robocop",
  title: "RoboCop",
  phase: "pre",
  matchSha256: [
    // input/RoboCop.sid
    "534a0be3fd586a733817ba42ca2d0a3e25327138f21c26f48ff14b89a7f8ba3f",
  ],
  patch,
};
