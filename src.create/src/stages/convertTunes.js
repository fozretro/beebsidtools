/**
 * Convert many SID inputs through pre-patch → relocate → post-patch → rip.
 * Expects ctx.inputs[]; produces ctx.tunes[].
 */

import { runPipeline, createContext } from "../pipeline.js";
import { relocateStage } from "./relocate.js";
import { prePatchStage, postPatchStage } from "./patch.js";
import { ripStage } from "./rip.js";
import { sha256Hex } from "../lib/patchRegistry.js";
import { parsePsid } from "../lib/psid.js";
import { titleFromStem } from "../lib/menu.js";
import {
  SIDPLAY_LOAD,
  bbcSidMaxBytes,
  describeTuneRam,
  formatTuneRam,
} from "../lib/tuneRam.js";

/**
 * @param {object} [opts]
 * @param {true|string|false} [opts.patch=true] default patch policy for all tunes
 * @param {object} [opts.reloc] overrides for DEFAULT_RELOC_OPTS
 * @param {"fail"|"skip"} [opts.tooLarge="fail"] overflow vs SIDPLAY/SIDPELK
 * @param {number} [opts.playerLoad] default SIDPLAY $6000
 */
export function convertTunesStage(opts = {}) {
  const defaultPatch = opts.patch === undefined ? true : opts.patch;
  const reloc = opts.reloc;
  const tooLarge = opts.tooLarge === "skip" ? "skip" : "fail";
  const playerLoad = opts.playerLoad ?? SIDPLAY_LOAD;

  return {
    name: "convert-tunes",
    async run(ctx) {
      const inputs = ctx.inputs;
      if (!Array.isArray(inputs) || inputs.length === 0) {
        throw new Error("convert-tunes: ctx.inputs[] required");
      }

      const tunes = [];
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const baseName = input.baseName ?? `tune${i}`;
        const inputSid = Buffer.from(input.sid ?? input.inputSid);
        const patch = input.patch === undefined ? defaultPatch : input.patch;

        ctx.log.push(`  [${i + 1}/${inputs.length}] ${baseName}`);

        let one = await runPipeline(
          [
            prePatchStage({ patch }),
            relocateStage({ reloc }),
            postPatchStage({ patch }),
            ripStage(),
          ],
          createContext({
            baseName,
            inputSid,
            meta: { inputSha256: sha256Hex(inputSid) },
          }),
        );

        const preApplied = one.log.some((l) => l.includes("pre-patch:"));
        const postApplied = one.log.some((l) => l.includes("post-patch:"));
        for (const line of one.log) {
          if (line === "✓ done") continue;
          if (line === "→ pre-patch" && !preApplied) continue;
          if (line === "→ post-patch" && !postApplied) continue;
          ctx.log.push(`    ${line}`);
        }

        const ram = describeTuneRam(one.bbcSid, playerLoad);
        if (ram.over) {
          const msg = formatTuneRam(baseName, one.bbcSid, playerLoad);
          if (tooLarge === "skip") {
            ctx.log.push(`    warning: skipped — ${msg}`);
            continue;
          }
          throw new Error(msg);
        }
        ctx.log.push(`    ${formatTuneRam(baseName, one.bbcSid, playerLoad)}`);

        // Default menu title: stem with _ → space (not the PSID title),
        // so packed SSDs stay byte-stable.
        let title = input.title;
        if (!title) title = titleFromStem(baseName);
        if (!title) {
          try {
            title = parsePsid(inputSid).title;
          } catch {
            title = baseName;
          }
        }

        tunes.push({
          baseName,
          title,
          bbcSid: one.bbcSid,
          relSid: one.relSid,
          brkText: one.brkText,
          relocErr: one.relocErr,
          patchedSid: one.patchedSid,
          vars: one.vars,
          meta: one.meta,
          dfsName: input.dfsName,
        });
      }

      if (tooLarge === "skip" && tunes.length === 0) {
        const max = bbcSidMaxBytes(playerLoad);
        throw new Error(
          `No tunes fit under the player at $${playerLoad.toString(16)} ` +
            `(max ${max}-byte .bbcsid from $19f8).`,
        );
      }

      return {
        ...ctx,
        tunes,
        meta: { ...ctx.meta, tuneCount: tunes.length },
      };
    },
  };
}
