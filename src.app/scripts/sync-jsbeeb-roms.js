#!/usr/bin/env node
/**
 * Sync jsbeeb browser assets into public/jsbeeb/:
 * - ROMs from the jsbeeb npm package
 * - disc525 drive samples (not shipped on npm; fetched from upstream)
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const CREATE = join(APP, "../src.create");
const require = createRequire(join(CREATE, "package.json"));

const DISC525_SOUNDS = [
  "motoron.wav",
  "motoroff.wav",
  "motor.wav",
  "step.wav",
  "seek.wav",
  "seek2.wav",
  "seek3.wav",
];

const DISC525_BASE =
  "https://raw.githubusercontent.com/mattgodbolt/jsbeeb/main/public/sounds/disc525/";

let romSrc;
try {
  const jsbeebPkg = require.resolve("jsbeeb/package.json");
  romSrc = join(dirname(jsbeebPkg), "public/roms");
} catch {
  romSrc = join(CREATE, "node_modules/jsbeeb/public/roms");
}

const destRoms = join(APP, "public/jsbeeb/roms");
const destSounds = join(APP, "public/jsbeeb/sounds/disc525");

if (!existsSync(romSrc)) {
  console.error(`Missing ${romSrc} — npm install in src.create`);
  process.exit(1);
}

mkdirSync(join(APP, "public/jsbeeb"), { recursive: true });
cpSync(romSrc, destRoms, { recursive: true });
console.log(`Synced jsbeeb ROMs → public/jsbeeb/roms/`);

mkdirSync(destSounds, { recursive: true });
for (const name of DISC525_SOUNDS) {
  const out = join(destSounds, name);
  if (existsSync(out)) continue;
  const url = DISC525_BASE + name;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch ${url}: ${res.status}`);
    process.exit(1);
  }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`Fetched ${name}`);
}
console.log(`Synced disc525 sounds → public/jsbeeb/sounds/disc525/`);
