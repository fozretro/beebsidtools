import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertSids,
  convertTunesStage,
  createContext,
  createSsd,
  rsidNeedsManualPatch,
  runPipeline,
} from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_SID = join(HERE, "golden/Head_Over_Heels.sid");
const SIDPLAY = join(HERE, "../../src.player/out/sidpl.o");

const GARBAGE = {
  sid: Buffer.from("not a sid"),
  baseName: "Garbage",
};

function fakeRsid() {
  const sid = Buffer.alloc(0x80, 0);
  sid.write("RSID", 0);
  sid[0x05] = 2;
  sid[0x07] = 0x7c;
  return sid;
}

test("convertSids fails on the first bad tune", async () => {
  // Given a buffer that is not a SID
  // When convertSids runs
  // Then it rejects on that tune
  await assert.rejects(
    () => convertSids([GARBAGE]),
    /sidreloc failed|PSID|not a/i,
  );
});

test("createSsd fails when every tune is skipped", async () => {
  // Given only a garbage input
  assert.ok(existsSync(SIDPLAY), `missing ${SIDPLAY}`);
  // When createSsd packs
  // Then it fails because nothing converted
  await assert.rejects(
    () =>
      createSsd([GARBAGE], {
        assets: { sidplay: readFileSync(SIDPLAY) },
      }),
    /No tunes converted/,
  );
});

test(
  "convert-tunes skip keeps a good SID after a reloc failure",
  { timeout: 60_000 },
  async () => {
    // Given garbage then Head Over Heels
    assert.ok(existsSync(GOLDEN_SID), `missing ${GOLDEN_SID}`);
    // When convert-tunes skips failures
    const ctx = await runPipeline(
      [convertTunesStage({ onError: "skip" })],
      createContext({
        inputs: [
          GARBAGE,
          {
            sid: readFileSync(GOLDEN_SID),
            baseName: "Head_Over_Heels",
          },
        ],
      }),
    );
    // Then only Head Over Heels remains and a skip is logged
    assert.equal(ctx.tunes.length, 1);
    assert.equal(ctx.tunes[0].baseName, "Head_Over_Heels");
    assert.ok(ctx.log.some((line) => /warning: skipped/.test(line)));
  },
);

test("unpatched RSID is reported as needing a manual patch", () => {
  // Given a fake RSID with no hash patch
  // When rsidNeedsManualPatch inspects it
  const msg = rsidNeedsManualPatch(fakeRsid(), { name: "After_8" });
  // Then the message names the file

  assert.match(msg, /After_8: RSID — needs a manual patch/);
});

test("RoboCop RSID is allowed because a hash patch exists", () => {
  // Given the golden RoboCop RSID
  const path = join(HERE, "golden/RoboCop.sid");
  assert.ok(existsSync(path), `missing ${path}`);
  // When rsidNeedsManualPatch inspects it
  // Then it is allowed
  assert.equal(rsidNeedsManualPatch(readFileSync(path), { name: "RoboCop" }), null);
});

test("convertSids fails on an unpatched RSID", async () => {
  // Given an unpatched RSID
  // When convertSids runs
  // Then it rejects with the manual-patch message
  await assert.rejects(
    () => convertSids([{ sid: fakeRsid(), baseName: "After_8" }]),
    /After_8: RSID — needs a manual patch/,
  );
});

test(
  "createSsd skips an unpatched RSID and keeps a good SID",
  { timeout: 60_000 },
  async () => {
    // Given an unpatched RSID and Head Over Heels
    assert.ok(existsSync(SIDPLAY));
    assert.ok(existsSync(GOLDEN_SID));
    // When createSsd packs
    const { tunes, log } = await createSsd(
      [
        { sid: fakeRsid(), baseName: "After_8" },
        { sid: readFileSync(GOLDEN_SID), baseName: "Head_Over_Heels" },
      ],
      { assets: { sidplay: readFileSync(SIDPLAY) } },
    );
    // Then only Head Over Heels is on the disc
    assert.equal(tunes.length, 1);
    assert.equal(tunes[0].baseName, "Head_Over_Heels");
    assert.ok(log.some((line) => /After_8: RSID — needs a manual patch/.test(line)));
  },
);
