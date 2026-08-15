#!/usr/bin/env node
/**
 * Publish GitHub Release v<version> from releases/<version>.md
 * (same file Help shows). Does not bump versions or commit.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function pkgVersion(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8")).version;
}

const version = pkgVersion("package.json");
for (const rel of [
  "src.create/package.json",
  "src.player/package.json",
  "src.app/package.json",
]) {
  const v = pkgVersion(rel);
  if (v !== version) {
    console.error(`publish-release: ${rel} is ${v}, root is ${version}`);
    console.error("Run: node scripts/sync-versions.js");
    process.exit(1);
  }
}

const notes = join(ROOT, "releases", `${version}.md`);
if (!existsSync(notes)) {
  console.error(`publish-release: missing ${notes}`);
  process.exit(1);
}

const tag = `v${version}`;
const r = spawnSync(
  "gh",
  [
    "release",
    "create",
    tag,
    "--title",
    `BeebSID Tools ${version}`,
    "--notes-file",
    notes,
  ],
  { cwd: ROOT, stdio: "inherit" },
);
process.exit(r.status ?? 1);
