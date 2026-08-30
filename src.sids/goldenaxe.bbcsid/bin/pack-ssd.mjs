#!/usr/bin/env node
/** Pack out/Golden_Axe.bbcsid onto a one-tune SIDPLAY SSD. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TUNE = join(HERE, "..");
const REPO = join(TUNE, "../..");
const CREATE = join(REPO, "src.create/src");

const bbcPath = resolve(
  process.argv[2] || join(TUNE, "out/Golden_Axe.bbcsid"),
);
const ssdPath = resolve(process.argv[3] || join(TUNE, "out/goldenaxe.ssd"));

if (!existsSync(bbcPath)) {
  console.error(`missing ${bbcPath} — run bin/build.sh first`);
  process.exit(1);
}

const { packBeebSidSsd } = await import(pathToFileURL(join(CREATE, "lib/ssd.js")).href);

function loadPlayerAssets() {
  const sidplay = [
    join(REPO, "src.player/out/sidpl.o"),
    join(REPO, "src.player/test/golden/sidpl.o"),
  ].find((p) => existsSync(p));
  if (!sidplay) throw new Error("missing sidpl.o — npm run build:player");
  const hex = join(
    REPO,
    "src.player/src/platform/elk/resources/hexdigs.bin",
  );
  const assets = { sidplay: readFileSync(sidplay) };
  if (existsSync(hex)) assets.hex = readFileSync(hex);
  return assets;
}

const { ssd } = packBeebSidSsd({
  title: "GOLDENAXE",
  assets: loadPlayerAssets(),
  tunes: [
    {
      bbcSid: readFileSync(bbcPath),
      baseName: "Golden_Axe",
      title: "Golden Axe",
    },
  ],
});
mkdirSync(dirname(ssdPath), { recursive: true });
writeFileSync(ssdPath, ssd);
console.log(`wrote ${ssdPath}`);
