/**
 * Convert many SID inputs: replace replica, or pre-patch → relocate → post-patch → rip.
 * Expects ctx.inputs[]; produces ctx.tunes[].
 */

import { runPipeline, createContext } from "../pipeline.js";
import { relocateStage } from "./relocate.js";
import { prePatchStage, postPatchStage } from "./patch.js";
import { ripStage } from "./rip.js";
import { getPatches, resolvePatch, sha256Hex } from "../lib/patchRegistry.js";
import { parsePsid } from "../lib/psid.js";
import { rsidNeedsManualPatch } from "../lib/rsid.js";
import { titleFromStem } from "../lib/menu.js";
import {
  SIDPLAY_LOAD,
  describeTuneRam,
  formatTuneRam,
} from "../lib/tuneRam.js";

function applyReplacePatch({ inputSid, patchFlag, inputSha256 }) {
  if (patchFlag === false) return null;
  const selected = resolvePatch({
    patches: getPatches(),
    patchFlag,
    inputSha256,
    phase: "replace",
    optional: patchFlag === true,
  });
  if (!selected) return null;
  const result = selected.patch(inputSid);
  if (!result?.bbcSid) {
    throw new Error(`${selected.id}: replace patch must return bbcSid`);
  }
  return {
    id: selected.id,
    title: selected.title,
    bbcSid: Buffer.from(result.bbcSid),
    summary: result.summary ?? "listing replica",
  };
}

function logSkipped(ctx, message) {
  const lines = String(message).split("\n");
  ctx.log.push(`    warning: skipped — ${lines[0]}`);
  for (const line of lines.slice(1)) {
    ctx.log.push(`    ${line}`);
  }
}

/**
 * @param {object} [opts]
 * @param {true|string|false} [opts.patch=true] default patch policy for all tunes
 * @param {object} [opts.reloc] overrides for DEFAULT_RELOC_OPTS
 * @param {"fail"|"skip"} [opts.onError="fail"] reloc / rip / RAM overflow
 * @param {number} [opts.playerLoad] default SIDPLAY $6000
 */
export function convertTunesStage(opts = {}) {
  const defaultPatch = opts.patch === undefined ? true : opts.patch;
  const reloc = opts.reloc;
  const onError = opts.onError === "skip" ? "skip" : "fail";
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

        try {
          const rsidMsg = rsidNeedsManualPatch(inputSid, { name: baseName, patch });
          if (rsidMsg) throw new Error(rsidMsg);

          const inputSha256 = sha256Hex(inputSid);
          const replaced = applyReplacePatch({
            inputSid,
            patchFlag: patch,
            inputSha256,
          });
          if (replaced) {
            ctx.log.push(
              `    replace: ${replaced.id}${replaced.title ? ` (${replaced.title})` : ""}`,
            );
            for (const line of replaced.summary.split("\n")) {
              ctx.log.push(`    ${line}`);
            }
            const ram = describeTuneRam(replaced.bbcSid, playerLoad);
            if (ram.over) {
              throw new Error(
                formatTuneRam(baseName, replaced.bbcSid, playerLoad),
              );
            }
            ctx.log.push(
              `    ${formatTuneRam(baseName, replaced.bbcSid, playerLoad)}`,
            );

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
              bbcSid: replaced.bbcSid,
              dfsName: input.dfsName,
              playSeconds: input.playSeconds,
              meta: {
                inputSha256,
                patchId: replaced.id,
                patchPhase: "replace",
              },
            });
            continue;
          }

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
              meta: { inputSha256 },
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
            throw new Error(formatTuneRam(baseName, one.bbcSid, playerLoad));
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
            playSeconds: input.playSeconds,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (onError === "skip") {
            logSkipped(ctx, msg);
            continue;
          }
          throw err;
        }
      }

      if (onError === "skip" && tunes.length === 0) {
        throw new Error(
          `No tunes converted — all ${inputs.length} failed or were skipped.`,
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
