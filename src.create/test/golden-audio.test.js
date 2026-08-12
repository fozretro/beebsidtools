/**
 * Record Head Over Heels from golden tunes.ssd via jsbeeb + FastSID.
 * Not included in test:fast.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  recordSsdAudio,
  pcmRmsS16le,
  DEFAULT_RECORD_SECONDS,
} from "../src/preview/node/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SSD = join(HERE, "golden/tunes.ssd");
const GOLDEN_WAV = join(HERE, "golden/Head_Over_Heels.10s.wav");
const OUT_DIR = join(HERE, "out");
const OUT_WAV = join(OUT_DIR, "Head_Over_Heels.10s.wav");

describe("golden-audio (jsbeeb + FastSID HOH)", () => {
  it("records 10s of Head Over Heels matching golden WAV", async () => {
    // Given a packed golden SSD and a committed HOH audio golden
    assert.ok(existsSync(GOLDEN_SSD), `missing ${GOLDEN_SSD}`);
    assert.ok(existsSync(GOLDEN_WAV), `missing ${GOLDEN_WAV} — run npm run update:golden-audio`);
    mkdirSync(OUT_DIR, { recursive: true });

    // When jsbeeb boots, opens HOH with RETURN, and FastSID records 10s
    const { wavPath, pokeCount, seconds } = await recordSsdAudio({
      ssdPath: GOLDEN_SSD,
      wavPath: OUT_WAV,
      seconds: DEFAULT_RECORD_SECONDS,
      expectTune0: "Head Over Heels",
    });

    // Then WAV bytes equal the golden and the recording is non-silent
    assert.equal(wavPath, OUT_WAV);
    assert.ok(pokeCount > 0, "expected BeebSID $FC20 writes");
    assert.ok(Math.abs(seconds - DEFAULT_RECORD_SECONDS) < 0.01);

    const got = readFileSync(OUT_WAV);
    const want = readFileSync(GOLDEN_WAV);
    if (!got.equals(want)) {
      writeFileSync(join(OUT_DIR, "Head_Over_Heels.10s.got.wav"), got);
    }
    assert.equal(got.length, want.length, "WAV size mismatch");
    assert.ok(got.equals(want), "WAV bytes differ from golden");

    const rms = pcmRmsS16le(got.subarray(44));
    assert.ok(rms > 100, `audio too quiet (rms=${rms})`);
  });
});
