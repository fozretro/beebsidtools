/**
 * Node-only: walk up from SID folders to find HVSC Songlengths.md5.
 * Do not import from the browser app (uses node:path).
 */

import { dirname, join } from "node:path";
import { SONGLENGTHS_NAME, SONGLENGTHS_REL } from "./songlengths.js";

/**
 * @param {string[]} startDirs
 * @param {(path: string) => boolean} existsFn
 * @returns {string|null}
 */
export function locateSonglengthsFile(startDirs, existsFn) {
  const seen = new Set();
  for (const start of startDirs) {
    let dir = start;
    for (;;) {
      const key = dir.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        for (const parts of SONGLENGTHS_REL) {
          const candidate = join(dir, ...parts);
          if (existsFn(candidate)) return candidate;
        }
        const loose = join(dir, SONGLENGTHS_NAME);
        if (existsFn(loose)) return loose;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}
