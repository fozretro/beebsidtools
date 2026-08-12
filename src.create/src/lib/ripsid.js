/**
 * Pure JS port of tools/SIDPlayer/ripsid/ripsid.c
 * SID (+ .brk poke list) → BeebSID .bbcsid with dual-write / GATE_PULSE trampolines.
 */

import { parsePsid, readBe16, cStringField } from "./psid.js";
import { parseBrkList } from "./brk.js";

export const TUNE_BASE = 0x1a00;
export const SID_SHADOW = 0x0720;
export const SID_BASE = 0xfc20;
export const GATE_PULSE_BASE = 0x0740;
export const BRK_TAB_SIZE = 8;
export const BRK_TAB_SIZE_GATE = 22;

const STORE_OPS = new Set([0x8c, 0x8d, 0x8e, 0x99, 0x9d]);

function gateVoice(sidAddr) {
  const reg = sidAddr - SID_BASE;
  if (reg === 4) return 0;
  if (reg === 11) return 1;
  if (reg === 18) return 2;
  return -1;
}

function stubSize(entry) {
  const sidAddr = entry.op1 | (entry.op2 << 8);
  return gateVoice(sidAddr) >= 0 ? BRK_TAB_SIZE_GATE : BRK_TAB_SIZE;
}

function emitStub(entry) {
  const sidAddr = entry.op1 | (entry.op2 << 8);
  const shAddr = sidAddr - SID_BASE + SID_SHADOW;
  const voice = gateVoice(sidAddr);
  const size = stubSize(entry);
  const out = [];

  out.push(entry.opcode, shAddr & 0xff, (shAddr >> 8) & 0xff);
  out.push(entry.opcode, entry.op1, entry.op2);

  if (voice >= 0) {
    const pulse = GATE_PULSE_BASE + voice;
    out.push(0x08); // PHP
    out.push(0x48); // PHA
    if (entry.opcode === 0x8e) out.push(0x8a); // TXA
    else if (entry.opcode === 0x8c) out.push(0x98); // TYA
    out.push(0x29, 0x01); // AND #1
    out.push(0xd0, 0x05); // BNE +5
    out.push(0xa9, 0x01); // LDA #1
    out.push(0x8d, pulse & 0xff, (pulse >> 8) & 0xff);
    out.push(0x68); // PLA
    out.push(0x28); // PLP
  }

  out.push(0x60); // RTS
  while (out.length < size) out.push(0);
  return Buffer.from(out);
}

function le16(n) {
  return Buffer.from([n & 0xff, (n >> 8) & 0xff]);
}

/**
 * @param {Buffer} sidData PSID/RSID bytes (relocated, optionally patched)
 * @param {string} brkText sidreloc ----DOM:BRK: listing
 * @returns {{ bbcSid: Buffer, vars: string }}
 */
export function ripSid(sidData, brkText) {
  const sid = Buffer.from(sidData);
  if (sid.length <= 0x76) throw new Error("Invalid SID file < 0x76 bytes long");

  const magic = sid.subarray(0, 4).toString("ascii");
  if (magic !== "PSID" && magic !== "RSID") {
    throw new Error("Not a sid file - invalid magic");
  }

  const vars = [];
  const log = (line) => vars.push(line);

  log(`SID_TYPE=${magic}`);
  const version = readBe16(sid, 0x04);
  log(`SID_VERSION=${version.toString(16).padStart(2, "0")}`);

  let dataoffs = readBe16(sid, 0x06);
  let loadaddr = readBe16(sid, 0x08);
  let datapad = 0;

  if (loadaddr === 0) {
    loadaddr = sid[dataoffs] | (sid[dataoffs + 1] << 8);
    dataoffs += 2;
  }

  log(`SID_OFFS=${dataoffs.toString(16).padStart(4, "0")}`);
  log(`SID_LOAD=${loadaddr.toString(16).padStart(4, "0")}`);
  log(`SID_TIT='${cStringField(sid, 0x16, 32)}'`);
  log(`SID_AUT='${cStringField(sid, 0x36, 32)}'`);
  log(`SID_REL='${cStringField(sid, 0x56, 32)}'`);

  if (loadaddr !== TUNE_BASE) {
    if ((loadaddr & 0xff00) !== (TUNE_BASE & 0xff00)) {
      throw new Error(`BAD LOAD_ADDR ${loadaddr.toString(16).padStart(4, "0")}`);
    }
    datapad = loadaddr & 0xff;
  }

  const initaddr = readBe16(sid, 0x0a);
  const playaddr = readBe16(sid, 0x0c);
  const numsongs = readBe16(sid, 0x0e);
  const defsong = readBe16(sid, 0x10);
  log(
    `SID_INIT=${initaddr.toString(16).padStart(4, "0")}\n` +
      `SID_PLAY=${playaddr.toString(16).padStart(4, "0")}\n` +
      `SID_SONGS=${numsongs.toString(16).padStart(4, "0")}`,
  );

  // Prepend order matches ripsid.c linked list (last BRK line = head).
  /** @type {{ addr: number, opcode: number, op1: number, op2: number }[]} */
  const entries = [];
  for (const addr of parseBrkList(brkText)) {
    const opcode = sid[dataoffs + addr];
    const op1 = sid[dataoffs + addr + 1];
    const op2 = sid[dataoffs + addr + 2];
    if (!STORE_OPS.has(opcode)) {
      log(
        `echo "Unknown opcode at ${addr.toString(16).padStart(4, "0")}=${opcode
          .toString(16)
          .padStart(2, "0")} - skipping"`,
      );
      continue;
    }
    entries.unshift({ addr, opcode, op1, op2 });
    log(
      `BRK_${addr.toString(16).padStart(4, "0")}=${opcode
        .toString(16)
        .padStart(2, "0")}`,
    );
  }

  let brkaddr = TUNE_BASE + datapad + (sid.length - dataoffs);
  const payload = Buffer.from(sid.subarray(dataoffs));
  for (const e of entries) {
    payload[e.addr] = 0x20;
    payload[e.addr + 1] = brkaddr & 0xff;
    payload[e.addr + 2] = (brkaddr >> 8) & 0xff;
    brkaddr = (brkaddr + stubSize(e)) & 0xffff;
  }

  const chunks = [le16(initaddr), le16(playaddr), Buffer.from([numsongs & 0xff, defsong & 0xff]), le16(brkaddr)];

  if (datapad > 0) chunks.push(Buffer.alloc(datapad, 0));
  chunks.push(payload);

  for (const e of entries) chunks.push(emitStub(e));

  const title = cStringField(sid, 0x16, 32);
  const author = cStringField(sid, 0x36, 32);
  const release = cStringField(sid, 0x56, 32);
  // Match ripsid.c fprintf spacing exactly.
  const trailer =
    ` . . . \x95title:\x94 ${title}    \x96author:\x94 ${author}     \x93release:\x94 ${release}    `;
  chunks.push(Buffer.from(trailer, "latin1"));
  chunks.push(Buffer.from([0]));

  return {
    bbcSid: Buffer.concat(chunks),
    vars: vars.join("\n") + "\n",
  };
}

// re-export parse for callers that already have a Buffer
export { parsePsid };
