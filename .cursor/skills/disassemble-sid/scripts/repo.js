import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Walk up from start until src.create/src/lib/psid.js exists. */
export function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "src.create/src/lib/psid.js"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "beebsidtools root not found (need src.create/src/lib/psid.js). Run from the repo or set cwd.",
  );
}

export function resolveTool(envName, fallback) {
  return process.env[envName] || fallback;
}
