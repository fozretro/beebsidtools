#!/usr/bin/env node
/**
 * Copy built player binaries from src.player/out into public/.
 * Run after: npm run build:player (from beebsidtools/)
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PLAYER_OUT = join(ROOT, "../src.player/out");
const PUBLIC = join(ROOT, "public/player");
const HEX = join(
  ROOT,
  "../src.player/src/platform/elk/resources/hexdigs.bin",
);

mkdirSync(PUBLIC, { recursive: true });

for (const name of ["sidpl.o", "sidpelk.o"]) {
  const src = join(PLAYER_OUT, name);
  if (!existsSync(src)) {
    console.error(`Missing ${src} — run: npm run build:player`);
    process.exit(1);
  }
  copyFileSync(src, join(PUBLIC, name));
  console.log(`Copied ${name} → public/player/`);
}

if (existsSync(HEX)) {
  copyFileSync(HEX, join(PUBLIC, "hexdigs.bin"));
  console.log(`Copied hexdigs.bin → public/player/`);
}
