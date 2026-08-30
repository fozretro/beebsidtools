#!/usr/bin/env node
/**
 * player.bin (assembled for $4000) → SIDPLAY .bbcsid.
 *
 * OSFILE on this stack does not load a DFS file through $4000, so the 4K
 * sits at $1A20 and a stub copies it to $4000 (same idea as the C64 init).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TUNE = join(HERE, "..");
const REPO = join(TUNE, "../..");
const CREATE = join(REPO, "src.create/src");

const playerPath = process.argv[2];
const outPath = process.argv[3];
if (!playerPath || !outPath) {
  console.error("usage: wrap.mjs <player.bin> <out.bbcsid>");
  process.exit(1);
}

const { parsePsid } = await import(pathToFileURL(join(CREATE, "lib/psid.js")).href);
const { assertTuneFitsRam } = await import(
  pathToFileURL(join(CREATE, "lib/tuneRam.js")).href
);

const LOAD = 0x19f8;
const PAYLOAD = 0x1a00;
const PLAYER = 0x4000;
const PLAY = 0x4003;
const STUB_INIT = 0x1a00;
const INIT_A = 0x01;
const SRC = 0x1a30;

const player = readFileSync(playerPath);
if (player.length !== 0x1000) {
  throw new Error(`player.bin must be 4K, got ${player.length}`);
}

const off995B = 0x995b - 0x9000;
if (player[off995B] !== 0x4a) {
  throw new Error(
    `L995B[0] is $${player[off995B].toString(16)} (want $4A) — from-listing missed pointer pages`,
  );
}
const off9908 = 0x9908 - 0x9000;
if (player[off9908] !== 0x4f) {
  throw new Error(`L9908[0] is $${player[off9908].toString(16)} (want $4F)`);
}

const orig = parsePsid(
  readFileSync(join(TUNE, "../goldenaxe/original/Golden_Axe.sid")),
);

// ZP $50–$53: below SIDPLAY's "tune owns $70+" and unused by this player.
const stub = Buffer.from([
  0xa9, SRC & 0xff, // LDA #<src
  0x85, 0x50,
  0xa9, SRC >> 8, // LDA #>src
  0x85, 0x51,
  0xa9, 0x00, // LDA #$00
  0x85, 0x52,
  0xa9, PLAYER >> 8, // LDA #$40
  0x85, 0x53,
  0xa2, 0x10, // LDX #$10
  0xa0, 0x00, // LDY #$00
  0xb1, 0x50, // LDA ($50),Y
  0x91, 0x52, // STA ($52),Y
  0xc8, // INY
  0xd0, 0xf9, // BNE *-5
  0xe6, 0x51, // INC $51
  0xe6, 0x53, // INC $53
  0xca, // DEX
  0xd0, 0xf2, // BNE *-12
  0xa9, INIT_A, // LDA #$01
  0x4c, PLAYER & 0xff, PLAYER >> 8, // JMP $4000
]);
if (stub.length > SRC - PAYLOAD) {
  throw new Error(`stub ${stub.length} bytes; SRC needs >= ${stub.length} gap`);
}

const header = Buffer.alloc(8);
header.writeUInt16LE(STUB_INIT, 0);
header.writeUInt16LE(PLAY, 2);
header[4] = 1;
header[5] = 1;
const brktab = SRC + player.length;
header.writeUInt16LE(brktab, 6);

const gap = Buffer.alloc(SRC - PAYLOAD, 0);
stub.copy(gap);

const trailer =
  ` . . . \x95title:\x94 ${orig.title}    ` +
  `\x96author:\x94 ${orig.author}     ` +
  `\x93release:\x94 ${orig.release}    `;
const bbcSid = Buffer.concat([
  header,
  gap,
  player,
  Buffer.from(trailer, "latin1"),
  Buffer.from([0]),
]);

assertTuneFitsRam(bbcSid, { name: "Golden_Axe" });
writeFileSync(outPath, bbcSid);
const end = LOAD + bbcSid.length - 1;
console.log(
  `wrote ${outPath} (${bbcSid.length} bytes, $${LOAD.toString(16)}–$${end.toString(16)}, copy $${SRC.toString(16)}→$${PLAYER.toString(16)}, init A=$${INIT_A.toString(16)} play $${PLAY.toString(16)})`,
);
