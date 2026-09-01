#!/usr/bin/env node
/**
 * Copy sample discs + menu screenshots into public/gallery/ for the web client.
 * Source: repo discs/*.ssd and matching discs/*.png (see capture-gallery-shots.js).
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { galleryTitle } from "../src/gallery.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const DISCS = join(ROOT, "discs");
const PUBLIC = join(HERE, "../public/gallery");

if (!existsSync(DISCS)) {
  console.error(`Missing ${DISCS}`);
  process.exit(1);
}

rmSync(PUBLIC, { recursive: true, force: true });
mkdirSync(PUBLIC, { recursive: true });

const ssds = readdirSync(DISCS)
  .filter((n) => n.toLowerCase().endsWith(".ssd"))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

const discs = [];
for (const file of ssds) {
  const id = file.replace(/\.ssd$/i, "");
  const pngName = `${id}.png`;
  const pngSrc = join(DISCS, pngName);
  copyFileSync(join(DISCS, file), join(PUBLIC, file));
  let png = null;
  if (existsSync(pngSrc)) {
    copyFileSync(pngSrc, join(PUBLIC, pngName));
    png = pngName;
  }
  discs.push({
    id,
    title: galleryTitle(id),
    file,
    png,
  });
  console.log(`Copied ${file}${png ? ` + ${pngName}` : " (no screenshot)"}`);
}

writeFileSync(join(PUBLIC, "index.json"), `${JSON.stringify({ discs }, null, 2)}\n`);
console.log(`Gallery index: ${discs.length} discs → public/gallery/`);
