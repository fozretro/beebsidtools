/**
 * Pack converted tunes + player assets into a bootable .ssd (in-memory).
 * Expects ctx.tunes[] and ctx.assets { sidplay, sidpelk?, hex? }.
 */

import { packBeebSidSsd } from "../lib/ssd.js";

/**
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {boolean} [opts.includeSidpelk]
 * @param {number} [opts.tracks]
 */
export function packSsdStage(opts = {}) {
  return {
    name: "pack-ssd",
    async run(ctx) {
      if (!ctx.tunes?.length) throw new Error("pack-ssd: ctx.tunes[] required");
      if (!ctx.assets?.sidplay) {
        throw new Error("pack-ssd: ctx.assets.sidplay (sidpl.o) required");
      }

      const includeSidpelk =
        opts.includeSidpelk ?? ctx.meta?.includeSidpelk ?? false;

      const { ssd, menu, catalogue } = packBeebSidSsd({
        tunes: ctx.tunes,
        assets: ctx.assets,
        title: opts.title ?? ctx.meta?.discTitle ?? "BEEBSID",
        includeSidpelk,
        tracks: opts.tracks ?? 80,
      });

      ctx.log.push(
        `  ssd: ${catalogue.length} catalogue entries, ${ssd.length} bytes`,
      );
      for (const e of catalogue) {
        ctx.log.push(
          `    ${e.name.padEnd(12)} ${e.load.toString(16).padStart(6, "0")} ` +
            `${e.exec.toString(16).padStart(6, "0")} ${e.len}`,
        );
      }

      return {
        ...ctx,
        ssd,
        menu,
        meta: {
          ...ctx.meta,
          discTitle: opts.title ?? ctx.meta?.discTitle ?? "BEEBSID",
          catalogue,
        },
      };
    },
  };
}
