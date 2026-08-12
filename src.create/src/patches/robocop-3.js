/**
 * RoboCop 3 — BeebSID hardware patch (under-ROM copy → $4500, song0 only).
 * Port of the historical RoboCop 3 BeebSID hardware patch.
 */

import { parsePsid, rebuildPsid } from "../lib/psid.js";

const WORK_OLD_A = 0x9000;
const WORK_OLD_B = 0xb000;
const WORK_NEW = 0x4500;
const WORK_SIZE = 0x1a00;
const SONG0_SRC = 0x1c50;

const BANK_ZP_SITES = [0x1ac5, 0x1b5e, 0x1b63, 0x1b6a];
const PTR_TABLE = 0x1ba0;
const NUM_SONGS = 20;

const JSR_FIXES = [
  [0x1b07, 0xb000, WORK_NEW],
  [0x1b44, 0x9003, WORK_NEW + 3],
  [0x1b4c, 0x9003, WORK_NEW + 3],
  [0x1b54, 0x9003, WORK_NEW + 3],
];

const ABS_SITES = new Set([
  0x0000, 0x0003, 0x0072, 0x0085, 0x0093, 0x00c4, 0x00ce, 0x00db, 0x00e1, 0x00e7,
  0x00ed, 0x00f3, 0x00f6, 0x010d, 0x0116, 0x011b, 0x0122, 0x0133, 0x0138, 0x0148,
  0x0151, 0x0154, 0x0157, 0x0161, 0x0164, 0x0178, 0x018c, 0x0197, 0x01a0, 0x01a3,
  0x01aa, 0x01af, 0x01b2, 0x01b7, 0x01bc, 0x01c1, 0x01c4, 0x01c7, 0x01ca, 0x01cd,
  0x01d0, 0x01d3, 0x01d6, 0x01d9, 0x01e0, 0x01e3, 0x01e6, 0x01ec, 0x01f1, 0x021a,
  0x0226, 0x0232, 0x023e, 0x0241, 0x0244, 0x0249, 0x024e, 0x0251, 0x0257, 0x025a,
  0x025e, 0x0263, 0x0266, 0x0269, 0x026c, 0x026f, 0x0272, 0x0277, 0x027c, 0x027f,
  0x0284, 0x0289, 0x0290, 0x0293, 0x029c, 0x029f, 0x02a6, 0x02af, 0x02b3, 0x02b6,
  0x02b9, 0x02bf, 0x02c2, 0x02c6, 0x02c9, 0x02cc, 0x02cf, 0x02d6, 0x02d9, 0x02dc,
  0x02e3, 0x02f9, 0x0304, 0x0307, 0x031c, 0x0321, 0x0326, 0x0339, 0x033e, 0x0343,
  0x0348, 0x034f, 0x0352, 0x0357, 0x035a, 0x0361, 0x0368, 0x036d, 0x0370, 0x0378,
  0x037d, 0x0381, 0x0384, 0x0387, 0x038a, 0x038d, 0x0390, 0x039b, 0x039e, 0x03a1,
  0x03a4, 0x03a9, 0x03ae, 0x03b1, 0x03b4, 0x03be, 0x03c5, 0x03ca, 0x03d0, 0x03d7,
  0x03dc, 0x03e4, 0x03e9, 0x03ee, 0x0401, 0x0406, 0x0409, 0x041a, 0x0420, 0x0426,
  0x042b, 0x0430, 0x0440, 0x044e, 0x0451, 0x0454, 0x045c, 0x045f, 0x0464, 0x046a,
  0x046d, 0x0472, 0x0479, 0x047c, 0x047f, 0x0483, 0x0486, 0x0489, 0x048e, 0x0495,
  0x0498, 0x049e, 0x04a3,
]);

const ABS3 = new Set([
  0x0d, 0x0e, 0x1d, 0x1e, 0x20, 0x2c, 0x2d, 0x2e, 0x3d, 0x3e, 0x4c, 0x4d, 0x4e,
  0x5d, 0x5e, 0x6c, 0x6d, 0x6e, 0x7d, 0x7e, 0x8c, 0x8d, 0x8e, 0x9d, 0x99, 0xac,
  0xad, 0xae, 0xbc, 0xbd, 0xbe, 0xcc, 0xcd, 0xce, 0xdc, 0xdd, 0xde, 0xec, 0xed,
  0xee, 0xfc, 0xfd, 0xfe, 0x19, 0x39, 0x59, 0x79, 0xb9, 0xd9, 0xf9,
]);

function relocPlayerImage(img, oldBase, newBase) {
  if (img.length < WORK_SIZE) {
    throw new Error(`player image too short: ${img.length}`);
  }
  const w = Buffer.from(img.subarray(0, WORK_SIZE));
  const pageDelta = (newBase >> 8) - (oldBase >> 8);
  const stats = { abs: 0, words: 0, hi: 0 };

  for (const off of ABS_SITES) {
    if (off + 2 >= WORK_SIZE) continue;
    const op = w[off];
    if (!ABS3.has(op) && op !== 0x4c) continue;
    const addr = w[off + 1] | (w[off + 2] << 8);
    if (addr >= oldBase && addr < oldBase + WORK_SIZE) {
      const neu = addr - oldBase + newBase;
      w[off + 1] = neu & 0xff;
      w[off + 2] = (neu >> 8) & 0xff;
      stats.abs++;
    }
  }

  for (let i = 0; i < 8; i++) {
    const off = 0x569 + i * 2;
    const ptr = w[off] | (w[off + 1] << 8);
    if (ptr >= oldBase && ptr < oldBase + WORK_SIZE) {
      const neu = ptr - oldBase + newBase;
      w[off] = neu & 0xff;
      w[off + 1] = (neu >> 8) & 0xff;
      stats.words++;
    }
  }

  for (const [lo, hi, cnt] of [
    [0x571, 0x588, 23],
    [0x59f, 0x5af, 16],
    [0x5bf, 0x5ef, 48],
  ]) {
    for (let i = 0; i < cnt; i++) {
      const ptr = w[lo + i] | (w[hi + i] << 8);
      if (ptr >= oldBase && ptr < oldBase + WORK_SIZE) {
        w[hi + i] = (w[hi + i] + pageDelta) & 0xff;
        stats.hi++;
      }
    }
  }

  return { image: w, stats };
}

function patchPayload(payload, load) {
  const p = Buffer.from(payload);
  const stats = {
    bankNops: 0,
    ptrDst: 0,
    jsr: 0,
    abs: 0,
    words: 0,
    hi: 0,
  };

  for (const pc of BANK_ZP_SITES) {
    const off = pc - load;
    if (p[off + 1] !== 0x01) {
      throw new Error(
        `Expected zp $01 at $${pc.toString(16)}: ${p.subarray(off, off + 2).toString("hex")}`,
      );
    }
    p[off] = 0xea;
    p[off + 1] = 0xea;
    stats.bankNops++;
  }

  for (let song = 0; song < NUM_SONGS; song++) {
    const off = PTR_TABLE - load + song * 4 + 2;
    const dst = p[off] | (p[off + 1] << 8);
    const ok =
      (dst >= WORK_OLD_A && dst < WORK_OLD_A + WORK_SIZE) ||
      (dst >= WORK_OLD_B && dst < WORK_OLD_B + WORK_SIZE);
    if (!ok) {
      throw new Error(`Song ${song} dst $${dst.toString(16)} unexpected`);
    }
    p[off] = WORK_NEW & 0xff;
    p[off + 1] = (WORK_NEW >> 8) & 0xff;
    stats.ptrDst++;
  }

  for (const [pc, old, neu] of JSR_FIXES) {
    const off = pc - load;
    const cur = p[off + 1] | (p[off + 2] << 8);
    if (p[off] !== 0x20 || cur !== old) {
      throw new Error(`JSR mismatch at $${pc.toString(16)}: got $${cur.toString(16)}`);
    }
    p[off + 1] = neu & 0xff;
    p[off + 2] = (neu >> 8) & 0xff;
    stats.jsr++;
  }

  const srcOff = SONG0_SRC - load;
  if (srcOff < 0 || srcOff + WORK_SIZE > p.length) {
    throw new Error("Song0 source image out of range");
  }
  const img = p.subarray(srcOff, srcOff + WORK_SIZE);
  if (img[0] !== 0x4c) {
    throw new Error(
      `Song0 image does not start with JMP: ${img.subarray(0, 6).toString("hex")}`,
    );
  }
  const { image, stats: rstats } = relocPlayerImage(img, WORK_OLD_B, WORK_NEW);
  image.copy(p, srcOff);
  stats.abs = rstats.abs;
  stats.words = rstats.words;
  stats.hi = rstats.hi;

  return { payload: p, stats };
}

function patch(relocatedSid) {
  const { loadaddr, payload, header, loadInData } = parsePsid(relocatedSid);
  const { payload: patched, stats } = patchPayload(payload, loadaddr);

  const hdr = Buffer.from(header);
  hdr[0x0e] = 0;
  hdr[0x0f] = 1;
  hdr[0x10] = 0;
  hdr[0x11] = 1;

  const patchedSid = rebuildPsid(hdr, patched, { loadInData, loadaddr });
  const end = WORK_NEW + WORK_SIZE - 1;
  const summary =
    `bank NOPs: ${stats.bankNops}, ptr dsts: ${stats.ptrDst}, JSRs: ${stats.jsr}\n` +
    `song0 reloc: abs=${stats.abs}, words=${stats.words}, hi-table=${stats.hi}\n` +
    `work RAM $${WORK_NEW.toString(16)}-$${end.toString(16)} (main theme only)`;

  return { patchedSid, stats, summary };
}

export default {
  id: "robocop-3",
  title: "RoboCop 3",
  phase: "post",
  matchSha256: [
    // input/RoboCop_3.sid
    "d32e0e38a9c9fcb46dc9d1cd12ddcff84684eb8351d9c5c85e3cf4fe36a273d5",
    // relocated -f -k --page 1A --sid-dest FC20
    "04f3a8ff743ec42974914e0446596517df8ca2137cb5769d5aab58dd96d7f46d",
  ],
  patch,
};
