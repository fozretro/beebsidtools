#!/usr/bin/env node
/**
 * Refresh test/golden/Head_Over_Heels.10s.wav from golden tunes.ssd via jsbeeb+FastSID.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { recordSsdAudio } from "../../src/preview/node/recordAudio.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SSD = join(HERE, "../golden/tunes.ssd");
const WAV = join(HERE, "../golden/Head_Over_Heels.10s.wav");

const result = await recordSsdAudio({
  ssdPath: SSD,
  wavPath: WAV,
  seconds: 10,
  expectTune0: "Head Over Heels",
});

console.log(
  `Wrote ${WAV} (${result.seconds.toFixed(2)}s, ${result.pokeCount} SID pokes, rms path ready)`,
);
