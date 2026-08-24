/**
 * Golden Axe (Jeroen Tel) — BeebSID hardware patch.
 *
 * Init copies a 4K player image under C64 I/O/BASIC ($9000 / $A000 / $A100)
 * with $01 banking. sidreloc maps that to $9000–$B0FF, which is sideways ROM
 * on the Beeb, so the copy does not stick and play never writes BeebSID.
 *
 * The ripped tune already fills $19F8–$5396; the gap before SIDPLAY is only
 * 3K, and $0800–$17FF is NMI/DFS/OS workspace, so the 4K window goes at
 * $4000 (over later song images — songs 0–6 stay intact). $01 banking is a
 * no-op here and would smash BBC ZP.
 *
 * First listenable patch (workspace $4000). A later reloc pass that
 * also fixed leftover $90xx ops and the $995B curve was a regression
 * and was dropped.
 */

import { parsePsid, rebuildPsid } from "../lib/psid.js";

const WORK_NEW = 0x4000;
const WORK_SIZE = 0x1000;
const SID_OLD = 0xd400;
const SID_NEW = 0xfc20;

const PTR_TABLE = 0x1a80;
const NUM_SLOTS = 9;

const IMAGES = [
  { src: 0x1af0, old: 0x9000, codeEnd: 0x900 },
  { src: 0x2ae1, old: 0xa100, codeEnd: 0x900 },
  { src: 0x3976, old: 0x9000, codeEnd: 0x900 },
  { src: 0x4616, old: 0xa000, codeEnd: 0 },
];

const BANK_ZP_SITES = [0x1a02, 0x1a71, 0x1a76, 0x1a7d];

const DEST_ABS = [
  [0x1a5b, 0xa000],
  [0x1a61, 0xa001],
  [0x1a67, 0xa002],
];

const ABS3 = new Set([
  0x0d, 0x0e, 0x1d, 0x1e, 0x20, 0x2c, 0x2d, 0x2e, 0x3d, 0x3e, 0x4c, 0x4d, 0x4e,
  0x5d, 0x5e, 0x6c, 0x6d, 0x6e, 0x7d, 0x7e, 0x8c, 0x8d, 0x8e, 0x9d, 0x99, 0xac,
  0xad, 0xae, 0xbc, 0xbd, 0xbe, 0xcc, 0xcd, 0xce, 0xdc, 0xdd, 0xde, 0xec, 0xed,
  0xee, 0xfc, 0xfd, 0xfe, 0x19, 0x39, 0x59, 0x79, 0xb9, 0xd9, 0xf9,
]);

function relocPlayerImage(img, oldBase, newBase, codeEnd) {
  const w = Buffer.from(img);
  const delta = newBase - oldBase;
  const pageDelta = (newBase >> 8) - (oldBase >> 8);
  const dataBase = oldBase + Math.max(0, codeEnd);
  const oldHi0 = dataBase >> 8;
  const oldHi1 = (oldBase + WORK_SIZE) >> 8;
  const stats = { abs: 0, sid: 0, words: 0, hi: 0 };
  const marked = new Uint8Array(w.length);
  const walkEnd = Math.min(w.length - 2, codeEnd);

  let i = 0;
  while (i < walkEnd) {
    if (!ABS3.has(w[i])) {
      i += 1;
      continue;
    }
    const addr = w[i + 1] | (w[i + 2] << 8);
    if (addr >= oldBase && addr < oldBase + WORK_SIZE) {
      const neu = addr + delta;
      w[i + 1] = neu & 0xff;
      w[i + 2] = (neu >> 8) & 0xff;
      marked[i] = marked[i + 1] = marked[i + 2] = 1;
      stats.abs++;
    } else if (addr >= SID_OLD && addr <= SID_OLD + 0x1f) {
      const neu = addr - SID_OLD + SID_NEW;
      w[i + 1] = neu & 0xff;
      w[i + 2] = (neu >> 8) & 0xff;
      marked[i] = marked[i + 1] = marked[i + 2] = 1;
      stats.sid++;
    }
    i += 3;
  }

  const MEM_ABS = new Set([
    0x20, 0x4c, 0x8c, 0x8d, 0x8e, 0x9d, 0x99, 0xad, 0xae, 0xac, 0xbd, 0xb9,
    0xce, 0xee, 0xde, 0xfe, 0xcd, 0xdd,
  ]);
  for (i = 0; i < walkEnd; i++) {
    if (marked[i] || marked[i + 1] || marked[i + 2]) continue;
    if (!MEM_ABS.has(w[i])) continue;
    const addr = w[i + 1] | (w[i + 2] << 8);
    if (addr < oldBase || addr >= oldBase + WORK_SIZE) continue;
    const neu = addr + delta;
    w[i + 1] = neu & 0xff;
    w[i + 2] = (neu >> 8) & 0xff;
    marked[i] = marked[i + 1] = marked[i + 2] = 1;
    stats.abs++;
  }

  const isOldHi = (b) => b >= oldHi0 && b < oldHi1;
  i = Math.max(0, codeEnd);
  while (i < w.length) {
    if (!isOldHi(w[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < w.length && isOldHi(w[j])) j += 1;
    if (j - i >= 3) {
      for (let k = i; k < j; k++) {
        w[k] = (w[k] + pageDelta) & 0xff;
        marked[k] = 1;
        stats.hi++;
      }
    }
    i = j;
  }

  for (i = Math.max(0, codeEnd); i < w.length - 1; i++) {
    if (marked[i] || marked[i + 1]) continue;
    const addr = w[i] | (w[i + 1] << 8);
    if (addr < dataBase || addr >= oldBase + WORK_SIZE) continue;
    const neu = addr + delta;
    w[i] = neu & 0xff;
    w[i + 1] = (neu >> 8) & 0xff;
    marked[i] = marked[i + 1] = 1;
    stats.words++;
  }

  return { image: w, stats };
}

function patchPayload(payload, load) {
  const p = Buffer.from(payload);
  const fileEnd = load + p.length;
  const stats = { bankNops: 0, ptrDst: 0, destAbs: 0, images: [] };

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

  for (let slot = 0; slot < NUM_SLOTS; slot++) {
    const off = PTR_TABLE - load + slot * 4 + 2;
    const dst = p[off] | (p[off + 1] << 8);
    const ok =
      (dst >= 0x9000 && dst < 0xa000) ||
      (dst >= 0xa000 && dst < 0xb100);
    if (!ok) {
      throw new Error(`Slot ${slot} dst $${dst.toString(16)} unexpected`);
    }
    p[off] = WORK_NEW & 0xff;
    p[off + 1] = (WORK_NEW >> 8) & 0xff;
    stats.ptrDst++;
  }

  for (const [pc, old] of DEST_ABS) {
    const off = pc - load;
    const cur = p[off + 1] | (p[off + 2] << 8);
    if (p[off] !== 0x8d || cur !== old) {
      throw new Error(
        `STA mismatch at $${pc.toString(16)}: got $${cur.toString(16)}`,
      );
    }
    const neu = WORK_NEW + (old - 0xa000);
    p[off + 1] = neu & 0xff;
    p[off + 2] = (neu >> 8) & 0xff;
    stats.destAbs++;
  }

  for (const im of IMAGES) {
    const srcOff = im.src - load;
    const size = Math.min(WORK_SIZE, Math.max(0, fileEnd - im.src));
    if (srcOff < 0 || size < 16) {
      throw new Error(`Image at $${im.src.toString(16)} out of range`);
    }
    const { image, stats: rstats } = relocPlayerImage(
      p.subarray(srcOff, srcOff + size),
      im.old,
      WORK_NEW,
      im.codeEnd,
    );
    image.copy(p, srcOff);
    stats.images.push({
      src: im.src,
      old: im.old,
      ...rstats,
    });
  }

  return { payload: p, stats };
}

function patch(relocatedSid) {
  const { loadaddr, payload, header, loadInData } = parsePsid(
    Buffer.from(relocatedSid),
  );
  const { payload: patched, stats } = patchPayload(payload, loadaddr);
  const patchedSid = rebuildPsid(header, patched, { loadInData, loadaddr });
  const end = WORK_NEW + WORK_SIZE - 1;
  const img = stats.images
    .map(
      (im) =>
        `$${im.src.toString(16)}: abs=${im.abs} words=${im.words} hi=${im.hi} sid=${im.sid}`,
    )
    .join(", ");
  const summary =
    `bank NOPs: ${stats.bankNops}, ptr dsts: ${stats.ptrDst}, ` +
    `STA dests: ${stats.destAbs}\n` +
    `images: ${img}\n` +
    `work RAM $${WORK_NEW.toString(16)}-$${end.toString(16)}`;

  return { patchedSid, stats, summary };
}

export default {
  id: "golden-axe",
  title: "Golden Axe",
  phase: "post",
  matchSha256: [
    // HVSC MUSICIANS/T/Tel_Jeroen/Golden_Axe.sid
    "c20e8eef9c9af543644defdf5d5daca48098336be85f208424dfc0ece76e0694",
    // relocated -f -k --page 1A --sid-dest FC20
    "1c7288c6611c384bd5211d0d66fdb1ff112e2ebafe089c0937693d0000e8c3fb",
  ],
  patch,
};
