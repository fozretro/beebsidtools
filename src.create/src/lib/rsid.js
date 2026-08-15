/**
 * RSID files need a C64 (CIA/IRQ play, KERNAL, …). SIDPLAY only jmp (TUNE_PLAY),
 * so an unpatched RSID is skipped until a hash patch exists (see RoboCop).
 */

import { parsePsid } from "./psid.js";
import {
  findPatchByHash,
  findPatchById,
  getPatches,
  sha256Hex,
} from "./patchRegistry.js";

export function rsidManualPatchMessage(name = "tune") {
  return `${name}: RSID — needs a manual patch`;
}

/**
 * @param {Buffer|Uint8Array} inputSid
 * @param {{ name?: string, patch?: true|string|false }} [opts]
 * @returns {string|null} skip/fail message, or null if convert may proceed
 */
export function rsidNeedsManualPatch(inputSid, opts = {}) {
  const name = opts.name ?? "tune";
  const patch = opts.patch === undefined ? true : opts.patch;

  let parsed;
  try {
    parsed = parsePsid(inputSid);
  } catch {
    return null;
  }
  if (parsed.magic !== "RSID") return null;

  if (patch === false) return rsidManualPatchMessage(name);

  const patches = getPatches();
  if (typeof patch === "string") {
    return findPatchById(patches, patch) ? null : rsidManualPatchMessage(name);
  }

  if (findPatchByHash(patches, sha256Hex(inputSid))) return null;
  return rsidManualPatchMessage(name);
}
