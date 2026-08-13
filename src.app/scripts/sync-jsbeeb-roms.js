#!/usr/bin/env node
/**
 * Sync jsbeeb ROMs from the npm package into public/jsbeeb/roms/.
 */

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const CREATE = join(APP, "../src.create");
const require = createRequire(join(CREATE, "package.json"));

let romSrc;
try {
  const jsbeebPkg = require.resolve("jsbeeb/package.json");
  romSrc = join(dirname(jsbeebPkg), "public/roms");
} catch {
  romSrc = join(CREATE, "node_modules/jsbeeb/public/roms");
}

if (!existsSync(romSrc)) {
  console.error(`Missing ${romSrc} — npm install in src.create`);
  process.exit(1);
}

const destRoms = join(APP, "public/jsbeeb/roms");
mkdirSync(join(APP, "public/jsbeeb"), { recursive: true });
cpSync(romSrc, destRoms, { recursive: true });
console.log(`Synced jsbeeb ROMs → public/jsbeeb/roms/`);
