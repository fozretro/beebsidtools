#!/usr/bin/env node
/**
 * Boot each discs/*.ssd to the SIDPLAY menu and write discs/<stem>.png.
 * Re-run after changing a sample disc. Sync copies the PNGs into public/gallery/.
 *
 *   node src.app/scripts/capture-gallery-shots.js
 *   node src.app/scripts/capture-gallery-shots.js --force
 */

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MachineSession } from "jsbeeb/machine-session";
import { bootToMenu, CYCLES_PER_POLL } from "beebsidtools-src-create/preview/node";

const HERE = dirname(fileURLToPath(import.meta.url));
const DISCS = join(HERE, "../../discs");
const force = process.argv.includes("--force");

const ssds = readdirSync(DISCS)
  .filter((n) => n.toLowerCase().endsWith(".ssd"))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

let wrote = 0;
let skipped = 0;
for (const file of ssds) {
  const id = file.replace(/\.ssd$/i, "");
  const pngPath = join(DISCS, `${id}.png`);
  if (!force && existsSync(pngPath)) {
    console.log(`skip ${file} (exists)`);
    skipped += 1;
    continue;
  }
  const ssdPath = join(DISCS, file);
  console.log(`capture ${file}…`);
  const session = new MachineSession("B1770", { discImage: ssdPath });
  try {
    await session.initialise();
    await session.boot(30);
    await bootToMenu(session, { timeoutMs: 60_000 });
    await session.runFor(CYCLES_PER_POLL);
    const png = Buffer.from(await session.screenshotActive({ scale: 2 }));
    writeFileSync(pngPath, png);
    console.log(`  wrote ${id}.png (${png.length} bytes)`);
    wrote += 1;
  } finally {
    session.destroy();
  }
}

console.log(`Captured ${wrote}, skipped ${skipped}.`);
