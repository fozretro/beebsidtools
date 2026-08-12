/**
 * createSsd({ preview }) headless multi-tune capture on golden SIDs.
 * Not in test:fast.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSsd } from "../src/index.js";
import { pcmRmsS16le, previewSsdStage } from "../src/preview/node/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "golden");
const PLAYER = join(HERE, "../../src.player/out/sidpl.o");
const HEX = join(
  HERE,
  "../../src.player/src/platform/elk/resources/hexdigs.bin",
);

const TUNES = [
  "Head_Over_Heels",
  "Cybernoid",
  "RoboCop",
  "RoboCop_3",
];

describe("createSsd preview pipeline", () => {
  it("returns menu PNG and a short WAV per tune", async () => {
    // Given golden SIDs and a built sidpl.o
    assert.ok(existsSync(PLAYER), `missing ${PLAYER} — npm run build:player`);
    const inputs = TUNES.map((baseName) => {
      const sidPath = join(GOLDEN, `${baseName}.sid`);
      assert.ok(existsSync(sidPath), sidPath);
      return { sid: readFileSync(sidPath), baseName };
    });

    // When createSsd packs and runs headless preview (short clips for CI speed)
    const out = await createSsd(inputs, {
      assets: {
        sidplay: readFileSync(PLAYER),
        hex: existsSync(HEX) ? readFileSync(HEX) : undefined,
      },
      title: "GOLDEN",
      preview: {
        stage: previewSsdStage({ audio: true, secondsPerTune: 5 }),
      },
    });

    // Then preview buffers are present and audio is non-silent
    assert.ok(out.ssd?.length > 1000);
    assert.ok(out.preview?.menuPng?.length > 1000);
    assert.equal(out.preview.menuPng.subarray(0, 4).toString("hex"), "89504e47");
    assert.equal(out.preview.tunes.length, 4);
    for (const t of out.preview.tunes) {
      assert.ok(t.wav.length > 1000, t.name);
      assert.equal(t.wav.subarray(0, 4).toString(), "RIFF");
      const rms = pcmRmsS16le(t.wav.subarray(44));
      assert.ok(rms > 50, `${t.name} too quiet rms=${rms}`);
    }
  });
});
