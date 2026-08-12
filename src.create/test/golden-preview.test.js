/**
 * Headless menu capture on golden tunes.ssd (via captureSsdPreview).
 * Not included in test:fast.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { captureSsdPreview } from "../src/preview/node/capture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SSD = join(HERE, "golden/tunes.ssd");
const OUT_DIR = join(HERE, "out");
const OUT_PNG = join(OUT_DIR, "menu.png");

describe("golden-preview (jsbeeb Mode 7 menu)", () => {
  it("boots tunes.ssd to SIDPLAY menu and writes menu.png", async () => {
    // Given a packed golden SSD
    assert.ok(existsSync(GOLDEN_SSD), `missing ${GOLDEN_SSD}`);
    mkdirSync(OUT_DIR, { recursive: true });

    // When headless preview captures the menu (no audio)
    const { menuPng, tune0 } = await captureSsdPreview({
      ssd: GOLDEN_SSD,
      tuneCount: 1,
      audio: false,
    });

    // Then a PNG is produced and the first tune title is Head Over Heels
    writeFileSync(OUT_PNG, menuPng);
    assert.ok(existsSync(OUT_PNG), "menu.png written");
    assert.ok(menuPng.length > 1000, `png too small: ${menuPng.length}`);
    assert.equal(menuPng.subarray(0, 4).toString("hex"), "89504e47");
    assert.match(tune0, /^Head Over Heels/);
    // silence unused import warning if assert path only
    assert.ok(readFileSync(OUT_PNG).equals(menuPng));
  });
});
