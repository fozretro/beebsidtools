#!/usr/bin/env node
/**
 * Rebuild test/golden/tunes.ssd from committed .bbcsid + current sidpl.o.
 *
 *   (from beebsidtools/) npm run build:player && npm run update:golden-ssd
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOLDEN_SSD_NAME,
  GOLDEN_SSD_TUNES,
  packGoldenSsd,
} from "../lib/golden-ssd.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BEEBSIDTOOLS = join(HERE, "../../..");
const GOLDEN = join(HERE, "../golden");
const OUT = join(GOLDEN, GOLDEN_SSD_NAME);
const SIDPLAY = join(BEEBSIDTOOLS, "src.player/out/sidpl.o");
const HEX = join(
  BEEBSIDTOOLS,
  "src.player/src/platform/elk/resources/hexdigs.bin",
);

const required = [
  SIDPLAY,
  HEX,
  ...GOLDEN_SSD_TUNES.map((t) => join(GOLDEN, `${t.baseName}.bbcsid`)),
];
for (const p of required) {
  if (!existsSync(p)) {
    console.error(`missing ${p}`);
    if (p === SIDPLAY) console.error("Run: npm run build:player");
    process.exit(1);
  }
}

const { ssd, catalogue } = packGoldenSsd(GOLDEN, {
  sidplay: readFileSync(SIDPLAY),
  hex: readFileSync(HEX),
});

writeFileSync(OUT, ssd);
console.log(`Wrote ${OUT} (${ssd.length} bytes, ${GOLDEN_SSD_TUNES.length} tunes)`);
console.log(
  "Catalogue:",
  catalogue.map((e) => e.name).join(", "),
);
