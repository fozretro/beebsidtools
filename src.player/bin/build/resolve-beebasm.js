/**
 * Resolve BeebAsm binary: BEEBASM env, else `beebasm` on PATH.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export function resolveBeebasm() {
  if (process.env.BEEBASM) return process.env.BEEBASM;
  const which = spawnSync("which", ["beebasm"], { encoding: "utf8" });
  if (which.status === 0) {
    const p = (which.stdout || "").trim();
    if (p) return p;
  }
  return "beebasm";
}

export function beebasmHint(path) {
  return (
    `beebasm not found (${path})\n` +
    `Install BeebAsm (https://github.com/stardot/beebasm), put it on PATH,\n` +
    `or set BEEBASM=/path/to/beebasm`
  );
}

export function beebasmExists(path = resolveBeebasm()) {
  if (path.includes("/") || path.startsWith(".")) return existsSync(path);
  const which = spawnSync("which", [path], { encoding: "utf8" });
  return which.status === 0 && !!(which.stdout || "").trim();
}
