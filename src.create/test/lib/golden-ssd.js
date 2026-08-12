/**
 * Shared recipe for the pack-only SSD golden (all fixture .bbcsid tunes).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packBeebSidSsd } from "../../src/lib/ssd.js";

export const GOLDEN_SSD_TITLE = "GOLDEN";
export const GOLDEN_SSD_NAME = "tunes.ssd";

/** Fixture tunes packed into the SSD golden (order = menu order). */
export const GOLDEN_SSD_TUNES = [
  { baseName: "Head_Over_Heels", title: "Head Over Heels" },
  { baseName: "Cybernoid", title: "Cybernoid" },
  { baseName: "RoboCop", title: "RoboCop" },
  { baseName: "RoboCop_3", title: "RoboCop 3" },
];

/** @param {string} goldenDir test/golden */
export function packGoldenSsd(goldenDir, assets) {
  return packBeebSidSsd({
    tunes: GOLDEN_SSD_TUNES.map((t) => ({
      bbcSid: readFileSync(join(goldenDir, `${t.baseName}.bbcsid`)),
      baseName: t.baseName,
      title: t.title,
    })),
    assets,
    title: GOLDEN_SSD_TITLE,
    includeSidpelk: false,
  });
}
