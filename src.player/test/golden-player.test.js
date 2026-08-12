/**
 * Built sidpl.o / sidpelk.o must byte-match committed goldens.
 * Refresh: npm run build && npm run update:golden-player
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { firstDiffLines } from "./lib/diff.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "out");
const GOLDEN = join(HERE, "golden");

for (const name of ["sidpl.o", "sidpelk.o"]) {
  test(`player golden: ${name}`, () => {
    const built = join(OUT, name);
    const golden = join(GOLDEN, name);
    assert.ok(existsSync(built), `missing ${built} — npm run build`);
    assert.ok(
      existsSync(golden),
      `missing ${golden} — npm run update:golden-player`,
    );
    const a = readFileSync(built);
    const b = readFileSync(golden);
    if (!a.equals(b)) {
      assert.fail(
        `${name} differs from golden\n` +
          firstDiffLines(built, golden).join("\n"),
      );
    }
  });
}
