/**
 * Head Over Heels — BeebSID hardware patch (banking / $B600 work RAM / SID).
 * Auto-selected when convert matches the original or relocated SID SHA-256.
 */

import { parsePsid, rebuildPsid } from "../lib/psid.js";

const B6_LO = 0xb600;
const B6_HI = 0xbfff;
const B6_NEW = 0x3d00;
const B6_PAGES = 0x0a;
const SID_OLD = 0xd400;
const SID_NEW = 0xfc20;

const BANK_SITES = [0x3a02, 0x3a09, 0x3a0e];
const UNPACK_START_IMM = 0x2e86;
const UNPACK_END_IMM = 0x2e9f;

const WORD_RELOC_RANGES = [
  [0x2a87, 0x2adf],
  [0x3000, 0x39ff],
];

const ABS3 = new Set([
  0x0d, 0x0e, 0x1d, 0x1e, 0x20, 0x2c, 0x2d, 0x2e, 0x3d, 0x3e, 0x4c, 0x4d, 0x4e,
  0x5d, 0x5e, 0x6c, 0x6d, 0x6e, 0x7d, 0x7e, 0x8c, 0x8d, 0x8e, 0x9d, 0x99, 0xac,
  0xad, 0xae, 0xbc, 0xbd, 0xbe, 0xcc, 0xcd, 0xce, 0xdc, 0xdd, 0xde, 0xec, 0xed,
  0xee, 0xfc, 0xfd, 0xfe,
]);

function patchPayload(payload, load) {
  const p = Buffer.from(payload);
  const stats = { bankNops: 0, unpack: 0, b6Words: 0, sidAbs: 0 };

  for (const pc of BANK_SITES) {
    const off = pc - load;
    p[off] = 0xea;
    p[off + 1] = 0xea;
    stats.bankNops++;
  }

  const endPage = (B6_NEW >> 8) + B6_PAGES;
  p[UNPACK_START_IMM - load] = B6_NEW >> 8;
  p[UNPACK_END_IMM - load] = endPage;
  stats.unpack = 2;

  for (const [lo, hi] of WORD_RELOC_RANGES) {
    let i = lo - load;
    const end = hi - load;
    while (i < end) {
      const addr = p[i] | (p[i + 1] << 8);
      if (addr >= B6_LO && addr <= B6_HI) {
        const neu = addr - B6_LO + B6_NEW;
        p[i] = neu & 0xff;
        p[i + 1] = (neu >> 8) & 0xff;
        stats.b6Words++;
        i += 2;
      } else {
        i += 1;
      }
    }
  }

  let i = 0;
  while (i < p.length - 2) {
    const op = p[i];
    if (ABS3.has(op)) {
      const addr = p[i + 1] | (p[i + 2] << 8);
      if (addr >= SID_OLD && addr <= SID_OLD + 0x1f) {
        const neu = addr - SID_OLD + SID_NEW;
        p[i + 1] = neu & 0xff;
        p[i + 2] = (neu >> 8) & 0xff;
        stats.sidAbs++;
      }
      i += 3;
      continue;
    }
    i += 1;
  }

  return { payload: p, stats };
}

function patch(relocatedSid) {
  const { loadaddr, payload, header, loadInData } = parsePsid(relocatedSid);
  const startImm = payload[UNPACK_START_IMM - loadaddr];
  if (startImm !== 0xb6 && startImm !== B6_NEW >> 8) {
    throw new Error(
      `Unexpected unpacker imm at $${UNPACK_START_IMM.toString(16)}: $${startImm
        .toString(16)
        .padStart(2, "0")}`,
    );
  }

  const { payload: patched, stats } = patchPayload(payload, loadaddr);
  const patchedSid = rebuildPsid(header, patched, {
    loadInData,
    loadaddr,
  });

  const end = B6_NEW + (B6_HI - B6_LO);
  const summary =
    `bank NOPs: ${stats.bankNops}, ` +
    `unpacker: $${(B6_NEW >> 8).toString(16).padStart(2, "0")}-$${(end >> 8)
      .toString(16)
      .padStart(2, "0")}, ` +
    `B6 words: ${stats.b6Words}, ` +
    `D4 abs: ${stats.sidAbs}\n` +
    `work RAM $${B6_NEW.toString(16)}-$${end.toString(16)}`;

  return { patchedSid, stats, summary };
}

export default {
  id: "head-over-heels",
  title: "Head Over Heels",
  phase: "post",
  matchSha256: [
    // input/Head_Over_Heels.sid
    "9aa3ba35ab2fb503fa64a9eec4073d570ab1559d8f12e2382df4ffea46832406",
    // relocated -f -k --page 1A --sid-dest FC20
    "24d073e0a1d4298795867766103c329346b449020111a1a4aada96f53c3a3b84",
  ],
  patch,
};
