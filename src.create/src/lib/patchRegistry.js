/**
 * Select BeebSID patches by SHA-256 or id.
 * Patches declare phase: "pre" (before relocate) or "post" (after, default).
 */

import { builtinPatches } from "../patches/index.js";
import { sha256Hex } from "./sha256.js";

export { sha256Hex, builtinPatches };

/** @deprecated Prefer builtinPatches */
export const DEFAULT_PATCHES = builtinPatches;

/**
 * @param {object[]} [patches]
 * @returns {object[]}
 */
export function getPatches(patches) {
  return patches ?? builtinPatches;
}

/** @deprecated Use getPatches() or builtinPatches */
export function loadPatches() {
  return builtinPatches;
}

/** @param {object} p @returns {"pre"|"post"} */
export function patchPhase(p) {
  return p?.phase === "pre" ? "pre" : "post";
}

/**
 * @param {object[]} patches
 * @param {"pre"|"post"} [phase]
 */
export function patchesForPhase(patches, phase) {
  if (!phase) return patches;
  return patches.filter((p) => patchPhase(p) === phase);
}

export function findPatchByHash(patches, hex) {
  const key = hex.toLowerCase();
  const hits = patches.filter((p) =>
    (p.matchSha256 ?? []).map((h) => h.toLowerCase()).includes(key),
  );
  if (hits.length > 1) {
    throw new Error(
      `Ambiguous patch match for ${key}: ${hits.map((p) => p.id).join(", ")}`,
    );
  }
  return hits[0] ?? null;
}

export function findPatchById(patches, id) {
  const key = id.toLowerCase();
  return patches.find((p) => p.id.toLowerCase() === key) ?? null;
}

/**
 * @param {object} opts
 * @param {object[]} opts.patches
 * @param {true|string|false|null} [opts.patchFlag=true]
 * @param {string} [opts.inputSha256]
 * @param {string} [opts.relocSha256]
 * @param {"pre"|"post"} [opts.phase="post"]
 * @param {boolean} [opts.optional=false]
 */
export function resolvePatch({
  patches,
  patchFlag = true,
  inputSha256,
  relocSha256,
  phase = "post",
  optional = false,
}) {
  if (patchFlag === false || patchFlag == null) return null;

  if (patchFlag !== true) {
    const p = findPatchById(patches, patchFlag);
    if (!p) {
      const known = patches.map((x) => x.id).join(", ") || "(none)";
      throw new Error(`Unknown patch '${patchFlag}'. Known: ${known}`);
    }
    // Forced id applies only in its declared phase.
    if (patchPhase(p) !== phase) return null;
    return p;
  }

  const scoped = patchesForPhase(patches, phase);
  for (const hex of [inputSha256, relocSha256].filter(Boolean)) {
    const p = findPatchByHash(scoped, hex);
    if (p) return p;
  }

  if (optional) return null;

  const tried = [inputSha256, relocSha256].filter(Boolean).join(", ");
  throw new Error(
    `No ${phase} patch matches SHA-256 [${tried || "n/a"}]. ` +
      `Add a module under src.create/src/patches/ or pass --patch=<id>.`,
  );
}
