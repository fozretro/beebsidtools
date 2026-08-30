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
  const old = oldMenuNoTimes();
  const info = inspectMenu(old);
  assert.equal(info.count, 2);
  assert.equal(info.hasTimes, false);
  assert.equal(info.format, null);

  const up = upgradeMenu(old);
  assert.equal(up.changed, true);
  assert.equal(up.addedTimes, true);
  assert.equal(up.format, MENU_FORMAT);
  assert.equal(inspectMenu(up.menu).format, MENU_FORMAT);
  assert.equal(up.menu.readUInt16LE(1 + 84), DEFAULT_PLAY_SECONDS);
  assert.equal(up.menu.subarray(89, 93).toString("ascii"), "BSMN");
});

test("upgradeMenu: times without trailer just stamps format 1", () => {
  const entries = oldMenuNoTimes();
  const times = Buffer.alloc(4);
  times.writeUInt16LE(165, 0);
  times.writeUInt16LE(99, 2);
  const mid = Buffer.concat([entries, times]);
  const up = upgradeMenu(mid);
  assert.equal(up.changed, true);
  assert.equal(up.addedTimes, false);
  assert.equal(up.menu.readUInt16LE(1 + 84), 165);
  assert.equal(up.menu.readUInt16LE(1 + 86), 99);
  assert.equal(inspectMenu(up.menu).format, 1);
});

test("upgradeMenu: current buildMenu is already format 1", () => {
  const menu = buildMenu([
    { dfsName: "S.00HEAD_", title: "Head Over Heels", playSeconds: 10 },
  ]);
  const up = upgradeMenu(menu);
  assert.equal(up.changed, false);
  assert.equal(up.menu.equals(menu), true);
});

test("upgradeBeebSidSsd replaces SIDPLAY and upgrades M.MENU", () => {
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

  const out = upgradeBeebSidSsd(oldDisc, { sidplay });
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
  assert.ok(existsSync(SIDPLAY), `missing ${SIDPLAY}`);
  const sidplay = readFileSync(SIDPLAY);
  const hex = readFileSync(HEX);
  const bbc = readFileSync(join(GOLDEN, "Head_Over_Heels.bbcsid"));
  const { ssd } = packBeebSidSsd({
    tunes: [{ bbcSid: bbc, baseName: "Head_Over_Heels", title: "Head Over Heels" }],
    assets: { sidplay, hex },
    title: "HOH SID",
  });
  const report = describeBeebSidUpgrade(ssd, { sidplay, hex });
  assert.equal(upgradeNeeded(report), false);
});
