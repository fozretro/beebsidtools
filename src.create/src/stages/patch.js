/**
 * Pre- or post-relocate patch stage (in-memory).
 *
 *  phase "pre"  — mutates ctx.inputSid (hash match on original); may set meta.relocOpts
 *  phase "post" — mutates relocated SID → ctx.patchedSid / ripInput
 */

import {
  getPatches,
  resolvePatch,
  sha256Hex,
  patchPhase,
} from "../lib/patchRegistry.js";

/**
 * @param {object} [opts]
 * @param {true|string|false} [opts.patch=true]  true=auto; string=force id; false=skip
 * @param {"pre"|"post"} [opts.phase="post"]
 * @param {object[]} [opts.patches] override builtin list
 */
export function patchStage(opts = {}) {
  const patchFlag = opts.patch === undefined ? true : opts.patch;
  const phase = opts.phase === "pre" ? "pre" : "post";

  return {
    name: phase === "pre" ? "pre-patch" : "post-patch",
    async run(ctx) {
      if (patchFlag === false) return ctx;

      const patches = getPatches(opts.patches);
      const inputSha256 = ctx.meta.inputSha256 ?? null;

      if (phase === "pre") {
        if (!ctx.inputSid) throw new Error("pre-patch: ctx.inputSid required");
        const selected = resolvePatch({
          patches,
          patchFlag,
          inputSha256: inputSha256 ?? sha256Hex(ctx.inputSid),
          phase: "pre",
          optional: patchFlag === true,
        });
        if (!selected) {
          return ctx;
        }
        const result = selected.patch(ctx.inputSid);
        const patched = Buffer.from(result.patchedSid);
        const summary = result.summary ?? `applied ${selected.id}`;
        ctx.log.push(
          `  pre-patch: ${selected.id}${selected.title ? ` (${selected.title})` : ""}`,
        );
        for (const line of summary.split("\n")) ctx.log.push(`  ${line}`);
        return {
          ...ctx,
          inputSid: patched,
          meta: {
            ...ctx.meta,
            prePatchId: selected.id,
            relocOpts: {
              ...(ctx.meta.relocOpts ?? {}),
              ...(result.reloc ?? {}),
            },
            prePatchStats: result.stats,
          },
        };
      }

      // post
      const src = ctx.relSid ?? ctx.ripInput;
      if (!src) throw new Error("post-patch: ctx.relSid required");

      const relocSha256 = sha256Hex(src);
      const selected = resolvePatch({
        patches,
        patchFlag,
        inputSha256,
        relocSha256,
        phase: "post",
        optional: patchFlag === true,
      });

      if (!selected) {
        return {
          ...ctx,
          meta: { ...ctx.meta, relocSha256, patchId: null },
        };
      }

      const result = selected.patch(src);
      const patchedSid = Buffer.from(result.patchedSid);
      const summary = result.summary ?? `applied ${selected.id}`;

      ctx.log.push(
        `  post-patch: ${selected.id}${selected.title ? ` (${selected.title})` : ""}`,
      );
      for (const line of summary.split("\n")) ctx.log.push(`  ${line}`);

      return {
        ...ctx,
        patchedSid,
        ripInput: patchedSid,
        meta: {
          ...ctx.meta,
          relocSha256,
          patchId: selected.id,
          patchPhase: patchPhase(selected),
          patchStats: result.stats,
        },
      };
    },
  };
}

/** @param {object} [opts] */
export function prePatchStage(opts = {}) {
  return patchStage({ ...opts, phase: "pre" });
}

/** @param {object} [opts] */
export function postPatchStage(opts = {}) {
  return patchStage({ ...opts, phase: "post" });
}
