/**
 * Relocate stage — pure JS sidreloc (in-memory).
 */

import { relocateSid } from "../lib/sidreloc/index.js";

/** Default BeebSID relocate flags (match convert_beebsid.sh). */
export const DEFAULT_RELOC_OPTS = {
  force: true,
  keepZp: true,
  page: 0x1a,
  sidDest: 0xfc20,
};

/**
 * @param {object} [opts]
 * @param {object} [opts.reloc] overrides for relocateSid options
 */
export function relocateStage(opts = {}) {
  return {
    name: "Retargeting tune code",
    async run(ctx) {
      if (!ctx.inputSid) throw new Error("relocate: ctx.inputSid required");

      const { relSid, brkText, errText, exitCode } = relocateSid(ctx.inputSid, {
        ...DEFAULT_RELOC_OPTS,
        ...(ctx.meta?.relocOpts ?? {}),
        ...(opts.reloc ?? {}),
      });

      // sidreloc ORs warning flags: 0x20=oob, 0x40=pitch — treat those as OK.
      if ((exitCode & ~0x60) !== 0) {
        throw new Error(
          `sidreloc failed (exit ${exitCode}):\n${errText || "(no stderr)"}`,
        );
      }
      if (!relSid) {
        throw new Error(
          `sidreloc produced no output (exit ${exitCode}):\n${errText || "(no stderr)"}`,
        );
      }

      const relBuf = Buffer.from(relSid);
      return {
        ...ctx,
        relSid: relBuf,
        brkText,
        relocErr: errText,
        ripInput: relBuf,
        meta: {
          ...ctx.meta,
          relocExitCode: exitCode,
        },
      };
    },
  };
}
