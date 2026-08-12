/**
 * In-memory SSD packer: catalogue shape + byte-match golden tunes.ssd.
 * Refresh golden: npm run build:player && npm run update:golden-ssd
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSsd, packBeebSidSsd, buildMenu, dfsTuneName } from "../src/index.js";
import {
  GOLDEN_SSD_NAME,
  GOLDEN_SSD_TUNES,
  packGoldenSsd,
} from "./lib/golden-ssd.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BEEBSIDTOOLS = join(HERE, "../..");
const GOLDEN = join(HERE, "golden");
const SIDPLAY = join(BEEBSIDTOOLS, "src.player/out/sidpl.o");
const HEX = join(
  BEEBSIDTOOLS,
  "src.player/src/platform/elk/resources/hexdigs.bin",
);
const TUNES_SSD = join(GOLDEN, GOLDEN_SSD_NAME);

test("dfsTuneName / M.MENU layout", () => {
  assert.equal(dfsTuneName(0, "Head_Over_Heels"), "S.00HEAD_");
  const menu = buildMenu([
    { dfsName: "S.00HEAD_", title: "Head Over Heels" },
    { dfsName: "S.01CYBER", title: "Cybernoid" },
  ]);
  assert.equal(menu[0], 2);
  assert.equal(menu.length, 1 + 42 * 2);
  assert.equal(menu.subarray(1, 10).toString("ascii"), "S.00HEAD_");
  assert.equal(menu[10], 0x0d);
});

test("packBeebSidSsd catalogue shape", () => {
  assert.ok(existsSync(SIDPLAY), `missing ${SIDPLAY} — npm run build:player`);
  const bbc = readFileSync(join(GOLDEN, "Head_Over_Heels.bbcsid"));
  const { ssd, catalogue } = packBeebSidSsd({
    tunes: [{ bbcSid: bbc, baseName: "Head_Over_Heels", title: "Head Over Heels" }],
    assets: {
      sidplay: readFileSync(SIDPLAY),
      hex: readFileSync(HEX),
    },
    title: "HOH SID",
    includeSidpelk: false,
  });
  assert.ok(ssd.length === 800 * 256);
  assert.ok(catalogue.some((e) => e.name.includes("SIDPLAY")));
  assert.ok(catalogue.some((e) => e.name.includes("MENU")));
  assert.ok(catalogue.some((e) => e.name.includes("BOOT") || e.name.includes("!BOOT")));
  assert.ok(catalogue.some((e) => e.name.startsWith("S.")));
  const tune = catalogue.find((e) => e.name.startsWith("S."));
  assert.equal(tune.load, 0x19f8);
});

test("packGoldenSsd matches committed tunes.ssd", () => {
  assert.ok(existsSync(SIDPLAY), `missing ${SIDPLAY} — npm run build:player`);
  assert.ok(
    existsSync(TUNES_SSD),
    `missing ${TUNES_SSD} — npm run update:golden-ssd`,
  );
  const { ssd, catalogue } = packGoldenSsd(GOLDEN, {
    sidplay: readFileSync(SIDPLAY),
    hex: readFileSync(HEX),
  });
  const golden = readFileSync(TUNES_SSD);
  assert.equal(
    catalogue.filter((e) => e.name.startsWith("S.")).length,
    GOLDEN_SSD_TUNES.length,
  );
  assert.equal(ssd.length, golden.length);
  assert.ok(
    ssd.equals(golden),
    "tunes.ssd differs — rebuild player and run: npm run update:golden-ssd",
  );
});

test(
  "createSsd multi-tune pipeline (all golden SIDs)",
  { timeout: 180_000 },
  async () => {
    assert.ok(existsSync(SIDPLAY));
    const inputs = GOLDEN_SSD_TUNES.map((t) => {
      const path = join(GOLDEN, `${t.baseName}.sid`);
      assert.ok(existsSync(path), `missing ${path}`);
      return { sid: readFileSync(path), baseName: t.baseName };
    });
    const { ssd, tunes, meta } = await createSsd(inputs, {
      assets: {
        sidplay: readFileSync(SIDPLAY),
        hex: readFileSync(HEX),
      },
      title: "GOLDEN",
      includeSidpelk: false,
    });
    assert.equal(tunes.length, GOLDEN_SSD_TUNES.length);
    for (const t of tunes) assert.ok(t.bbcSid.length > 100);
    assert.equal(
      meta.catalogue.filter((e) => e.name.startsWith("S.")).length,
      GOLDEN_SSD_TUNES.length,
    );
    assert.ok(ssd.length === 800 * 256);
  },
);
