import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PLAY_SECONDS,
  applySonglengths,
  buildMenu,
  formatPlaySeconds,
  hvscRelFromSonglengths,
  lookupPlaySeconds,
  normalizeHvscPath,
  parsePlayTime,
  parseSonglengthsMd5,
  playSecondsOrDefault,
} from "../src/index.js";
import { locateSonglengthsFile } from "../src/lib/songlengthsLocate.js";

const SAMPLE = `
[Database]
; /MUSICIANS/H/Hubbard_Rob/Commando.sid
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa=2:45 1:12
; C64Music/GAMES/C-D/Cybernoid.sid
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb=3:00
; /DEMOS/0-9/Short.sid
cccccccccccccccccccccccccccccccc=0:07.4
`;

test("normalizeHvscPath strips C64Music and leading slash", () => {
  // Given a Songlengths comment path
  // When normalizeHvscPath cleans it
  // Then C64Music and the leading slash are gone
  assert.equal(
    normalizeHvscPath("; /C64Music/MUSICIANS/H/Hubbard_Rob/Commando.sid"),
    "musicians/h/hubbard_rob/commando.sid",
  );
});

test("parsePlayTime reads mm:ss and fractional seconds", () => {
  // Given HVSC time strings
  // When parsePlayTime reads them
  // Then seconds are integers and junk is null
  assert.equal(parsePlayTime("2:45"), 165);
  assert.equal(parsePlayTime("0:07.4"), 7);
  assert.equal(parsePlayTime("nope"), null);
});

test("parseSonglengthsMd5 looks up default song by path", () => {
  // Given a small Songlengths.md5 sample
  const db = parseSonglengthsMd5(SAMPLE);
  // When lookupPlaySeconds uses path or MD5
  // Then the default song length is returned
  assert.equal(
    lookupPlaySeconds(db, {
      path: "MUSICIANS/H/Hubbard_Rob/Commando.sid",
      startSong: 1,
    }),
    165,
  );
  assert.equal(
    lookupPlaySeconds(db, {
      path: "MUSICIANS/H/Hubbard_Rob/Commando.sid",
      startSong: 2,
    }),
    72,
  );
  assert.equal(
    lookupPlaySeconds(db, { md5: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
    180,
  );
  assert.equal(lookupPlaySeconds(db, { path: "missing.sid" }), null);
});

test("applySonglengths sets only matched rows", () => {
  // Given two rows and the sample database
  // When applySonglengths fills times
  const rows = applySonglengths(
    [
      { path: "GAMES/C-D/Cybernoid.sid", startSong: 1 },
      { path: "other.sid", startSong: 1 },
    ],
    parseSonglengthsMd5(SAMPLE),
  );
  // Then only the HVSC match gets seconds
  assert.equal(rows[0].playSeconds, 180);
  assert.equal(rows[1].playSeconds, undefined);
});

test("formatPlaySeconds and default", () => {
  // Given seconds or a missing time
  // When formatPlaySeconds and playSecondsOrDefault run
  // Then the display is mm:ss or the 3:00 default
  assert.equal(formatPlaySeconds(165), "2:45");
  assert.equal(formatPlaySeconds(null), "—");
  assert.equal(playSecondsOrDefault(undefined), DEFAULT_PLAY_SECONDS);
});

test("hvscRelFromSonglengths is relative to the Songlengths.md5 root", () => {
  // Given a SID path and a Songlengths.md5 path
  // When hvscRelFromSonglengths walks to the collection root
  // Then the HVSC-relative path is lowercase
  assert.equal(
    hvscRelFromSonglengths(
      "/hvsc/C64Music/MUSICIANS/H/Hubbard_Rob/Commando.sid",
      "/hvsc/C64Music/DOCUMENTS/Songlengths.md5",
    ),
    "musicians/h/hubbard_rob/commando.sid",
  );
  assert.equal(
    hvscRelFromSonglengths(
      "/hvsc/C64Music/GAMES/C-D/Cybernoid.sid",
      "/hvsc/DOCUMENTS/Songlengths.md5",
    ),
    "games/c-d/cybernoid.sid",
  );
});

test("CLI-style MD5 lookup (same as ./create ssd)", () => {
  // Given Head Over Heels and a one-line MD5 database
  const sidPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "golden/Head_Over_Heels.sid",
  );
  assert.ok(existsSync(sidPath), `missing ${sidPath}`);
  const sid = readFileSync(sidPath);
  const md5 = createHash("md5").update(sid).digest("hex");
  const db = parseSonglengthsMd5(`; /unused.sid\n${md5}=4:12\n`);
  // When lookupPlaySeconds uses the file MD5
  // Then the time is 4:12
  assert.equal(lookupPlaySeconds(db, { md5, startSong: 1 }), 252);
});

test("locateSonglengthsFile walks up to DOCUMENTS", () => {
  // Given a fake HVSC tree with DOCUMENTS/Songlengths.md5
  const root = mkdtempSync(join(tmpdir(), "beebsid-sl-"));
  const docs = join(root, "C64Music", "DOCUMENTS");
  const musician = join(root, "C64Music", "MUSICIANS", "H");
  mkdirSync(docs, { recursive: true });
  mkdirSync(musician, { recursive: true });
  const sl = join(docs, "Songlengths.md5");
  writeFileSync(sl, SAMPLE);
  // When locateSonglengthsFile starts in a musician folder
  // Then it finds the file, or null if the tree is missing
  assert.equal(locateSonglengthsFile([musician], (p) => p === sl), sl);
  assert.equal(locateSonglengthsFile(["/no/such"], () => false), null);
});

test("buildMenu appends uint16 LE play-seconds", () => {
  // Given two titles, one with a time
  // When buildMenu writes the file
  const menu = buildMenu([
    { dfsName: "S.00HEAD_", title: "Head Over Heels", playSeconds: 165 },
    { dfsName: "S.01CYBER", title: "Cybernoid" },
  ]);
  // Then times are uint16 LE and the default fills the gap
  assert.equal(menu[0], 2);
  assert.equal(menu.length, 1 + 42 * 2 + 4 + 5);
  assert.equal(menu.readUInt16LE(1 + 84), 165);
  assert.equal(menu.readUInt16LE(1 + 84 + 2), DEFAULT_PLAY_SECONDS);
  assert.equal(menu.subarray(89, 93).toString("ascii"), "BSMN");
  assert.equal(menu[93], 1);
});
