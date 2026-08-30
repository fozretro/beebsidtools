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
const HVSC_SHA256 =
  "c20e8eef9c9af543644defdf5d5daca48098336be85f208424dfc0ece76e0694";
const SID_BASE = 0xfc20;
const SID_SHADOW = 0x0720;
const GATE_PULSE = 0x0740;
const STORE_OPS = new Set([0x8c, 0x8d, 0x8e, 0x99, 0x9d]);

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

const stubBase = SRC + player.length;
const ripped = trampolineSidStores(player, stubBase);
if (ripped.count === 0) {
  throw new Error("no $FC20 stores in player.bin — bars would stay blank");
}

const header = Buffer.alloc(8);
header.writeUInt16LE(STUB_INIT, 0);
header.writeUInt16LE(PLAY, 2);
header[4] = 1;
header[5] = 1;
const brktab = stubBase + ripped.stubs.length;
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
  ripped.image,
  ripped.stubs,
  Buffer.from(trailer, "latin1"),
  Buffer.from([0]),
]);

assertTuneFitsRam(bbcSid, { name: "Golden_Axe" });
writeFileSync(outPath, bbcSid);
embedInCreate(bbcSid);
const end = LOAD + bbcSid.length - 1;
console.log(
  `wrote ${outPath} (${bbcSid.length} bytes, $${LOAD.toString(16)}–$${end.toString(16)}, copy $${SRC.toString(16)}→$${PLAYER.toString(16)}, init A=$${INIT_A.toString(16)} play $${PLAY.toString(16)}, ${ripped.count} SID trampolines)`,
);

function embedInCreate(bbcSid) {
  const b64 = bbcSid.toString("base64");
  const lines = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  const patch = join(CREATE, "patches/golden-axe.js");
  const golden = join(REPO, "src.create/test/golden/Golden_Axe.bbcsid");
  writeFileSync(
    patch,
    `/**
 * Golden Axe (Jeroen Tel) — listing-built song 0 .bbcsid.
 *
 * sidreloc plus a reloc walk cannot keep this packed player's poke lists
 * locked to Hermit. Convert substitutes the assembled replica
 * (\`src.sids/goldenaxe.bbcsid/\`). Song 0 only.
 *
 * Refresh: src.sids/goldenaxe.bbcsid/bin/build.sh
 */
const BBCSID = Buffer.from(
  [
${lines.map((l) => `    "${l}",`).join("\n")}
  ].join(""),
  "base64",
);

export default {
  id: "golden-axe",
  title: "Golden Axe",
  phase: "replace",
  matchSha256: [
    // HVSC MUSICIANS/T/Tel_Jeroen/Golden_Axe.sid
    "${HVSC_SHA256}",
  ],
  patch() {
    return {
      bbcSid: Buffer.from(BBCSID),
      summary: "listing replica, song 0 ($4000 / $FC20)",
    };
  },
};
`,
  );
  writeFileSync(golden, bbcSid);
  console.log(`embedded ${patch} and ${golden}`);
}

/** Same dual-write / GATE_PULSE stubs as ripsid, for this listing image. */
function trampolineSidStores(image, stubBase) {
  const code = Buffer.from(image);
  const entries = [];
  for (let i = 0; i < code.length - 2; ) {
    const opcode = code[i];
    const op1 = code[i + 1];
    const op2 = code[i + 2];
    const addr = op1 | (op2 << 8);
    if (STORE_OPS.has(opcode) && addr >= SID_BASE && addr <= SID_BASE + 0x1f) {
      entries.push({ opcode, op1, op2, off: i, addr });
      i += 3;
      continue;
    }
    i += 1;
  }

  let brkaddr = stubBase;
  const stubs = [];
  for (const e of entries) {
    const reg = e.addr - SID_BASE;
    const voice = reg === 4 ? 0 : reg === 11 ? 1 : reg === 18 ? 2 : -1;
    const size = voice >= 0 ? 22 : 8;
    const sh = SID_SHADOW + reg;
    const out = [e.opcode, sh & 0xff, sh >> 8, e.opcode, e.op1, e.op2];
    if (voice >= 0) {
      const pulse = GATE_PULSE + voice;
      out.push(0x08, 0x48);
      if (e.opcode === 0x8e) out.push(0x8a);
      else if (e.opcode === 0x8c) out.push(0x98);
      out.push(0x29, 0x01, 0xd0, 0x05, 0xa9, 0x01, 0x8d, pulse & 0xff, pulse >> 8);
      out.push(0x68, 0x28);
    }
    out.push(0x60);
    while (out.length < size) out.push(0);

    code[e.off] = 0x20;
    code[e.off + 1] = brkaddr & 0xff;
    code[e.off + 2] = (brkaddr >> 8) & 0xff;
    stubs.push(Buffer.from(out));
    brkaddr = (brkaddr + size) & 0xffff;
  }
  return { image: code, stubs: Buffer.concat(stubs), count: entries.length };
}
