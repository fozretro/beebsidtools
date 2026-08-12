/**
 * In-memory patch registry (no filesystem). Web/app code should import this.
 */

import headOverHeels from "./head-over-heels.js";
import robocop from "./robocop.js";
import robocop3 from "./robocop-3.js";

function normalize(patch, file) {
  if (!patch?.id || typeof patch.patch !== "function") {
    throw new Error(`Invalid patch ${file}: need { id, patch }`);
  }
  return {
    ...patch,
    phase: patch.phase === "pre" ? "pre" : "post",
    matchSha256: (patch.matchSha256 ?? []).map((h) => h.toLowerCase()),
    _file: file,
  };
}

/** @type {object[]} */
export const builtinPatches = [
  normalize(headOverHeels, "head-over-heels.js"),
  normalize(robocop, "robocop.js"),
  normalize(robocop3, "robocop-3.js"),
];
