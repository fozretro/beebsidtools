#!/usr/bin/env node
/**
 * Copy root package.json version into src.create / src.player / src.app.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
  .version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`sync-versions: bad root version ${version}`);
  process.exit(1);
}

const targets = [
  "src.create/package.json",
  "src.player/package.json",
  "src.app/package.json",
];

for (const rel of targets) {
  const path = join(ROOT, rel);
  const next = readFileSync(path, "utf8").replace(
    /("version"\s*:\s*")[^"]+(")/,
    `$1${version}$2`,
  );
  writeFileSync(path, next);
  console.log(`${rel} → ${version}`);
}
