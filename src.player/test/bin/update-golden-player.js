#!/usr/bin/env node
/**
 * Copy built out/*.o into test/golden/.
 *
 *   npm run build
 *   npm run update:golden-player
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, "out");
const GOLDEN = join(HERE, "../golden");

for (const name of ["sidpl.o", "sidpelk.o"]) {
  const src = join(OUT, name);
  if (!existsSync(src)) {
    console.error(`missing ${src} — npm run build`);
    process.exit(1);
  }
  const dst = join(GOLDEN, name);
  copyFileSync(src, dst);
  console.log(`Wrote ${dst}`);
}
