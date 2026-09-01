import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PLAY_SECONDS,
  MENU_FORMAT,
  buildMenu,
  describeBeebSidUpgrade,
  inspectMenu,
  menuEntry,
  openDisc,
  packBeebSidSsd,
  rebuildDisc,
  toBuffer,
  upgradeBeebSidSsd,
  upgradeMenu,
  upgradeNeeded,
  beebSidSsdError,
  isBeebSidSsd,
} from "../src/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "golden");
const SIDPLAY = join(HERE, "../../src.player/out/sidpl.o");
const HEX = join(
  HERE,
  "../../src.player/src/platform/elk/resources/hexdigs.bin",
);

function oldMenuNoTimes() {
  return Buffer.concat([
    Buffer.from([2]),
    menuEntry("S.00HEAD_", "Head Over Heels"),
    menuEntry("S.01CYBER", "Cybernoid"),
  ]);
}

test("inspectMenu / upgradeMenu: entries-only gets times + BSMN", () => {
  // Given an M.MENU with entries only
  const old = oldMenuNoTimes();
  const info = inspectMenu(old);
  assert.equal(info.count, 2);
  assert.equal(info.hasTimes, false);
  assert.equal(info.format, null);

  // When upgradeMenu fills times and the trailer
  const up = upgradeMenu(old);
  // Then the menu is format 1 with default play seconds
  assert.equal(up.changed, true);
  assert.equal(up.addedTimes, true);
  assert.equal(up.format, MENU_FORMAT);
  assert.equal(inspectMenu(up.menu).format, MENU_FORMAT);
  assert.equal(up.menu.readUInt16LE(1 + 84), DEFAULT_PLAY_SECONDS);
  assert.equal(up.menu.subarray(89, 93).toString("ascii"), "BSMN");
});

test("upgradeMenu: times without trailer just stamps format 1", () => {
  // Given entries plus a times table and no BSMN trailer
  const entries = oldMenuNoTimes();
  const times = Buffer.alloc(4);
  times.writeUInt16LE(165, 0);
  times.writeUInt16LE(99, 2);
  const mid = Buffer.concat([entries, times]);
  // When upgradeMenu stamps the trailer
  const up = upgradeMenu(mid);
  // Then existing times stay and format becomes 1
  assert.equal(up.changed, true);
  assert.equal(up.addedTimes, false);
  assert.equal(up.menu.readUInt16LE(1 + 84), 165);
  assert.equal(up.menu.readUInt16LE(1 + 86), 99);
  assert.equal(inspectMenu(up.menu).format, 1);
});

test("upgradeMenu: current buildMenu is already format 1", () => {
  // Given a current M.MENU
  const menu = buildMenu([
    { dfsName: "S.00HEAD_", title: "Head Over Heels", playSeconds: 10 },
  ]);
  // When upgradeMenu runs
  const up = upgradeMenu(menu);
  // Then the bytes are unchanged
  assert.equal(up.changed, false);
  assert.equal(up.menu.equals(menu), true);
});

test("upgradeBeebSidSsd replaces SIDPLAY and upgrades M.MENU", () => {
  // Given a packed disc with a stale player and an old menu
  assert.ok(existsSync(SIDPLAY), `missing ${SIDPLAY}`);
  const sidplay = readFileSync(SIDPLAY);
  const bbc = readFileSync(join(GOLDEN, "Head_Over_Heels.bbcsid"));
  const { ssd } = packBeebSidSsd({
    tunes: [{ bbcSid: bbc, baseName: "Head_Over_Heels", title: "Head Over Heels" }],
    assets: {
      sidplay,
      hex: readFileSync(HEX),
    },
    title: "HOH SID",
  });

  const parsed = openDisc(ssd);
  const menuFile = parsed.files.find((f) => f.dfsName === "M.MENU");
  const player = parsed.files.find((f) => f.dfsName === "SIDPLAY");
  assert.ok(menuFile && player);

  const aged = Buffer.concat([menuFile.data.subarray(0, 1 + 42)]);
  const stalePlayer = Buffer.alloc(player.data.length, 0x5a);
  const oldDisc = toBuffer(
    rebuildDisc(parsed, {
      "M.MENU": aged,
      SIDPLAY: stalePlayer,
    }),
  );

  // When upgradeBeebSidSsd writes the current player and menu
  const out = upgradeBeebSidSsd(oldDisc, { sidplay });
  // Then SIDPLAY matches the asset and the menu is format 1
  assert.equal(out.report.player, true);
  assert.equal(out.report.menuTimes, true);
  assert.equal(out.report.menuFormat, true);

  const next = openDisc(out.ssd);
  const nextPlayer = next.files.find((f) => f.dfsName === "SIDPLAY");
  const nextMenu = next.files.find((f) => f.dfsName === "M.MENU");
  assert.ok(nextPlayer.data.equals(sidplay));
  assert.equal(inspectMenu(nextMenu.data).format, 1);
});

test("freshly packed disc does not need upgrade", () => {
  // Given a disc packed with the current player
  assert.ok(existsSync(SIDPLAY), `missing ${SIDPLAY}`);
  const sidplay = readFileSync(SIDPLAY);
  const hex = readFileSync(HEX);
  const bbc = readFileSync(join(GOLDEN, "Head_Over_Heels.bbcsid"));
  const { ssd } = packBeebSidSsd({
    tunes: [{ bbcSid: bbc, baseName: "Head_Over_Heels", title: "Head Over Heels" }],
    assets: { sidplay, hex },
    title: "HOH SID",
  });
  // When describeBeebSidUpgrade inspects it
  const report = describeBeebSidUpgrade(ssd, { sidplay, hex });
  // Then no upgrade is needed
  assert.equal(upgradeNeeded(report), false);
  assert.equal(isBeebSidSsd(ssd), true);
  assert.equal(beebSidSsdError(ssd), null);
});

test("beebSidSsdError rejects a non-BeebSID image", () => {
  // Given 512 zero bytes
  const junk = Buffer.alloc(512, 0);
  // When the disc is checked
  // Then it is not a BeebSID SSD
  assert.equal(isBeebSidSsd(junk), false);
  assert.ok(beebSidSsdError(junk));
});
