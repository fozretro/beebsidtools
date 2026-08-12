/* JavaScript port of the sidreloc 1.0 6510 emulator (cpu.c).
 *
 * Original C source: heavily modified 6510 emulator by Linus Akesson, based on
 * lib6502 by Ian Piumarta. MIT licence.
 *
 * The C version is written as a set of preprocessor macros combined into a
 * computed-goto dispatch loop. Here the instruction and addressing-mode macros
 * become two switch statements driven by decode tables, which keeps the
 * side-effect ordering (ticks, read marks, prefetch, constraint calls) exactly
 * as the macros expanded it.
 */

import {
  R,
  ERR_OK,
  ERR_BRK,
  ERR_ILLEGAL,
  ERR_CYCLES,
  cons_src,
  dont_reloc,
  putErr,
  hex2,
  hex4,
} from './reloc.js';
import { check_reloc_range, reloc_alike, used_for_zp_addr } from './solver.js';

const flagN = 1 << 7;
const flagV = 1 << 6;
const flagD = 1 << 3;
const flagI = 1 << 2;
const flagZ = 1 << 1;
const flagC = 1 << 0;

/* --- decode tables ------------------------------------------------------ */

const M_IMPLIED = 0;
const M_IMMEDIATE = 1;
const M_ABS = 2;
const M_RELATIVE = 3;
const M_INDIRECT = 4;
const M_ABSX = 5;
const M_ABSY = 6;
const M_ZP = 7;
const M_ZPX = 8;
const M_ZPY = 9;
const M_INDX = 10;
const M_INDY = 11;

const MODEID = {
  implied: M_IMPLIED,
  immediate: M_IMMEDIATE,
  abs: M_ABS,
  relative: M_RELATIVE,
  indirect: M_INDIRECT,
  absx: M_ABSX,
  absy: M_ABSY,
  zp: M_ZP,
  zpx: M_ZPX,
  zpy: M_ZPY,
  indx: M_INDX,
  indy: M_INDY,
};

const OP_ILL = 0;
const OP_BRK = 1;
const OP_ORA = 2;
const OP_AND = 3;
const OP_EOR = 4;
const OP_ADC = 5;
const OP_SBC = 6;
const OP_CMP = 7;
const OP_CPX = 8;
const OP_CPY = 9;
const OP_DEC = 10;
const OP_INC = 11;
const OP_DEX = 12;
const OP_DEY = 13;
const OP_INX = 14;
const OP_INY = 15;
const OP_BIT = 16;
const OP_ASL = 17;
const OP_ASLA = 18;
const OP_LSR = 19;
const OP_LSRA = 20;
const OP_ROL = 21;
const OP_ROLA = 22;
const OP_ROR = 23;
const OP_RORA = 24;
const OP_TAX = 25;
const OP_TXA = 26;
const OP_TAY = 27;
const OP_TYA = 28;
const OP_TSX = 29;
const OP_TXS = 30;
const OP_LDA = 31;
const OP_LDX = 32;
const OP_LDY = 33;
const OP_STA = 34;
const OP_STX = 35;
const OP_STY = 36;
const OP_BCC = 37;
const OP_BCS = 38;
const OP_BNE = 39;
const OP_BEQ = 40;
const OP_BPL = 41;
const OP_BMI = 42;
const OP_BVC = 43;
const OP_BVS = 44;
const OP_JMP = 45;
const OP_JSR = 46;
const OP_RTS = 47;
const OP_RTI = 48;
const OP_NOP = 49;
const OP_PHA = 50;
const OP_PHP = 51;
const OP_PLA = 52;
const OP_PLP = 53;
const OP_CLC = 54;
const OP_CLD = 55;
const OP_CLI = 56;
const OP_CLV = 57;
const OP_SEC = 58;
const OP_SED = 59;
const OP_SEI = 60;

const OPID = {
  ill: OP_ILL, brk: OP_BRK, ora: OP_ORA, and: OP_AND, eor: OP_EOR, adc: OP_ADC,
  sbc: OP_SBC, cmp: OP_CMP, cpx: OP_CPX, cpy: OP_CPY, dec: OP_DEC, inc: OP_INC,
  dex: OP_DEX, dey: OP_DEY, inx: OP_INX, iny: OP_INY, bit: OP_BIT, asl: OP_ASL,
  asla: OP_ASLA, lsr: OP_LSR, lsra: OP_LSRA, rol: OP_ROL, rola: OP_ROLA,
  ror: OP_ROR, rora: OP_RORA, tax: OP_TAX, txa: OP_TXA, tay: OP_TAY, tya: OP_TYA,
  tsx: OP_TSX, txs: OP_TXS, lda: OP_LDA, ldx: OP_LDX, ldy: OP_LDY, sta: OP_STA,
  stx: OP_STX, sty: OP_STY, bcc: OP_BCC, bcs: OP_BCS, bne: OP_BNE, beq: OP_BEQ,
  bpl: OP_BPL, bmi: OP_BMI, bvc: OP_BVC, bvs: OP_BVS, jmp: OP_JMP, jsr: OP_JSR,
  rts: OP_RTS, rti: OP_RTI, nop: OP_NOP, pha: OP_PHA, php: OP_PHP, pla: OP_PLA,
  plp: OP_PLP, clc: OP_CLC, cld: OP_CLD, cli: OP_CLI, clv: OP_CLV, sec: OP_SEC,
  sed: OP_SED, sei: OP_SEI,
};

/* Transcribed verbatim from the do_insns() table in cpu.c.
 * (Instruction timing is wrong for the undocumented nops, as in the original.) */
const INSNS = [
  'brk implied 7',   'ora indx 6',      'ill implied 2',   'ill implied 2',
  'nop zp 3',        'ora zp 3',        'asl zp 5',        'ill implied 2',
  'php implied 3',   'ora immediate 3', 'asla implied 2',  'ill implied 2',
  'nop abs 4',       'ora abs 4',       'asl abs 6',       'ill implied 2',
  'bpl relative 2',  'ora indy 5',      'ill implied 3',   'ill implied 2',
  'nop zpx 3',       'ora zpx 4',       'asl zpx 6',       'ill implied 2',
  'clc implied 2',   'ora absy 4',      'nop implied 2',   'ill implied 2',
  'nop absx 4',      'ora absx 4',      'asl absx 7',      'ill implied 2',
  'jsr abs 6',       'and indx 6',      'ill implied 2',   'ill implied 2',
  'bit zp 3',        'and zp 3',        'rol zp 5',        'ill implied 2',
  'plp implied 4',   'and immediate 3', 'rola implied 2',  'ill implied 2',
  'bit abs 4',       'and abs 4',       'rol abs 6',       'ill implied 2',
  'bmi relative 2',  'and indy 5',      'ill implied 3',   'ill implied 2',
  'nop zpx 4',       'and zpx 4',       'rol zpx 6',       'ill implied 2',
  'sec implied 2',   'and absy 4',      'nop implied 2',   'ill implied 2',
  'nop absx 4',      'and absx 4',      'rol absx 7',      'ill implied 2',
  'rti implied 6',   'eor indx 6',      'ill implied 2',   'ill implied 2',
  'nop zp 2',        'eor zp 3',        'lsr zp 5',        'ill implied 2',
  'pha implied 3',   'eor immediate 3', 'lsra implied 2',  'ill implied 2',
  'jmp abs 3',       'eor abs 4',       'lsr abs 6',       'ill implied 2',
  'bvc relative 2',  'eor indy 5',      'ill implied 3',   'ill implied 2',
  'nop zpx 2',       'eor zpx 4',       'lsr zpx 6',       'ill implied 2',
  'cli implied 2',   'eor absy 4',      'nop implied 3',   'ill implied 2',
  'nop absx 2',      'eor absx 4',      'lsr absx 7',      'ill implied 2',
  'rts implied 6',   'adc indx 6',      'ill implied 2',   'ill implied 2',
  'nop zp 3',        'adc zp 3',        'ror zp 5',        'ill implied 2',
  'pla implied 4',   'adc immediate 3', 'rora implied 2',  'ill implied 2',
  'jmp indirect 5',  'adc abs 4',       'ror abs 6',       'ill implied 2',
  'bvs relative 2',  'adc indy 5',      'ill implied 3',   'ill implied 2',
  'nop zpx 4',       'adc zpx 4',       'ror zpx 6',       'ill implied 2',
  'sei implied 2',   'adc absy 4',      'nop implied 4',   'ill implied 2',
  'nop absx 6',      'adc absx 4',      'ror absx 7',      'ill implied 2',
  'nop immediate 2', 'sta indx 6',      'nop immediate 2', 'ill implied 2',
  'sty zp 2',        'sta zp 2',        'stx zp 2',        'ill implied 2',
  'dey implied 2',   'nop immediate 2', 'txa implied 2',   'ill implied 2',
  'sty abs 4',       'sta abs 4',       'stx abs 4',       'ill implied 2',
  'bcc relative 2',  'sta indy 6',      'ill implied 3',   'ill implied 2',
  'sty zpx 4',       'sta zpx 4',       'stx zpy 4',       'ill implied 2',
  'tya implied 2',   'sta absy 5',      'txs implied 2',   'ill implied 2',
  'ill implied 4',   'sta absx 5',      'ill implied 5',   'ill implied 2',
  'ldy immediate 3', 'lda indx 6',      'ldx immediate 3', 'ill implied 2',
  'ldy zp 3',        'lda zp 3',        'ldx zp 3',        'ill implied 2',
  'tay implied 2',   'lda immediate 3', 'tax implied 2',   'ill implied 2',
  'ldy abs 4',       'lda abs 4',       'ldx abs 4',       'ill implied 2',
  'bcs relative 2',  'lda indy 5',      'ill implied 3',   'ill implied 2',
  'ldy zpx 4',       'lda zpx 4',       'ldx zpy 4',       'ill implied 2',
  'clv implied 2',   'lda absy 4',      'tsx implied 2',   'ill implied 2',
  'ldy absx 4',      'lda absx 4',      'ldx absy 4',      'ill implied 2',
  'cpy immediate 3', 'cmp indx 6',      'nop immediate 2', 'ill implied 2',
  'cpy zp 3',        'cmp zp 3',        'dec zp 5',        'ill implied 2',
  'iny implied 2',   'cmp immediate 3', 'dex implied 2',   'ill implied 2',
  'cpy abs 4',       'cmp abs 4',       'dec abs 6',       'ill implied 2',
  'bne relative 2',  'cmp indy 5',      'ill implied 3',   'ill implied 2',
  'nop zpx 2',       'cmp zpx 4',       'dec zpx 6',       'ill implied 2',
  'cld implied 2',   'cmp absy 4',      'nop implied 3',   'ill implied 2',
  'nop absx 2',      'cmp absx 4',      'dec absx 7',      'ill implied 2',
  'cpx immediate 3', 'sbc indx 6',      'nop immediate 2', 'ill implied 2',
  'cpx zp 3',        'sbc zp 3',        'inc zp 5',        'ill implied 2',
  'inx implied 2',   'sbc immediate 3', 'nop implied 2',   'ill implied 2',
  'cpx abs 4',       'sbc abs 4',       'inc abs 6',       'ill implied 2',
  'beq relative 2',  'sbc indy 5',      'ill implied 3',   'ill implied 2',
  'nop zpx 2',       'sbc zpx 4',       'inc zpx 6',       'ill implied 2',
  'sed implied 2',   'sbc absy 4',      'nop implied 4',   'ill implied 2',
  'nop absx 2',      'sbc absx 4',      'inc absx 7',      'ill implied 2',
];

const OPS = new Uint8Array(256);
const MODES = new Uint8Array(256);
const TICKS = new Uint8Array(256);

for (let i = 0; i < 256; i++) {
  const [op, mode, ticks] = INSNS[i].split(' ');
  OPS[i] = OPID[op];
  MODES[i] = MODEID[mode];
  TICKS[i] = Number(ticks);
}

/* --- machine state ------------------------------------------------------ */

let mem = null;
let msrc = null;
let mread = null;
let mwritten = null;

let PC = 0;
let ea = 0;
let Av = 0, Asrc = null;
let Xv = 0, Xsrc = null;
let Yv = 0, Ysrc = null;
let P = 0;
let S = 0xff;
let opcode = 0;
let maxCycles = 0;
let srcPcMsb = null;
let srcEaMsb = null;
let AC = 0; // cached R.addConstraints; constant for the duration of a run

function fetch() {
  const s = msrc[PC];
  mread[PC] = 1;
  opcode = mem[PC];
  PC = (PC + 1) & 0xffff;
  if (s !== null) dont_reloc(s);
}

/* Addressing modes. Return 1 when the cycle budget is exhausted. */
function applyMode(mode, ticks) {
  if (maxCycles < ticks) return 1;
  maxCycles -= ticks;

  switch (mode) {
    case M_IMPLIED:
      return 0;

    case M_IMMEDIATE:
      srcEaMsb = srcPcMsb;
      ea = PC;
      PC = (PC + 1) & 0xffff;
      return 0;

    case M_ABS: {
      mread[PC] = 1;
      mread[PC + 1] = 1;
      srcEaMsb = msrc[PC + 1];
      ea = mem[PC] + (mem[PC + 1] << 8);
      if (AC) check_reloc_range(msrc[(PC - 1) & 0xffff], ea, msrc[PC], null, srcEaMsb);
      PC = (PC + 2) & 0xffff;
      return 0;
    }

    case M_RELATIVE: {
      mread[PC] = 1;
      const s = msrc[PC];
      if (s !== null) dont_reloc(s);
      srcEaMsb = srcPcMsb;
      ea = mem[PC];
      PC = (PC + 1) & 0xffff;
      if (ea & 0x80) ea = (ea - 0x100) & 0xffff;
      return 0;
    }

    case M_INDIRECT: {
      mread[PC] = 1;
      mread[PC + 1] = 1;
      const tmp = mem[PC] + (mem[PC + 1] << 8);
      if (AC) check_reloc_range(msrc[(PC - 1) & 0xffff], tmp, msrc[PC], null, msrc[PC + 1]);
      mread[tmp] = 1;
      mread[tmp + 1] = 1;
      srcEaMsb = msrc[tmp + 1];
      ea = (mem[tmp] + (mem[tmp + 1] << 8)) & 0xffff;
      if (AC) check_reloc_range(msrc[(PC - 1) & 0xffff], ea, msrc[tmp], null, srcEaMsb);
      PC = (PC + 2) & 0xffff;
      return 0;
    }

    case M_ABSX: {
      mread[PC] = 1;
      mread[PC + 1] = 1;
      srcEaMsb = msrc[PC + 1];
      ea = (mem[PC] + (mem[PC + 1] << 8) + Xv) & 0xffff;
      if (AC) check_reloc_range(msrc[(PC - 1) & 0xffff], ea, msrc[PC], Xsrc, srcEaMsb);
      PC = (PC + 2) & 0xffff;
      return 0;
    }

    case M_ABSY: {
      mread[PC] = 1;
      mread[PC + 1] = 1;
      srcEaMsb = msrc[PC + 1];
      ea = (mem[PC] + (mem[PC + 1] << 8) + Yv) & 0xffff;
      if (AC) check_reloc_range(msrc[(PC - 1) & 0xffff], ea, msrc[PC], Ysrc, srcEaMsb);
      PC = (PC + 2) & 0xffff;
      return 0;
    }

    case M_ZP: {
      mread[PC] = 1;
      srcEaMsb = null;
      ea = mem[PC];
      if (AC) used_for_zp_addr(msrc[PC], null, ea);
      PC = (PC + 1) & 0xffff;
      return 0;
    }

    case M_ZPX: {
      mread[PC] = 1;
      srcEaMsb = null;
      ea = (mem[PC] + Xv) & 0xff;
      if (AC) used_for_zp_addr(msrc[PC], Xsrc, ea);
      PC = (PC + 1) & 0xffff;
      return 0;
    }

    case M_ZPY: {
      mread[PC] = 1;
      srcEaMsb = null;
      ea = (mem[PC] + Yv) & 0xff;
      if (AC) used_for_zp_addr(msrc[PC], Ysrc, ea);
      PC = (PC + 1) & 0xffff;
      return 0;
    }

    case M_INDX: {
      const tmp = (mem[PC] + Xv) & 0xff;
      mread[PC] = 1;
      if (AC) {
        used_for_zp_addr(msrc[PC], Xsrc, tmp);
        used_for_zp_addr(msrc[PC], Xsrc, tmp + 1);
      }
      mread[tmp] = 1;
      mread[tmp + 1] = 1;
      srcEaMsb = msrc[tmp + 1];
      ea = (mem[tmp] + (mem[tmp + 1] << 8)) & 0xffff;
      if (AC) check_reloc_range(msrc[(PC - 1) & 0xffff], ea, msrc[tmp], null, srcEaMsb);
      PC = (PC + 1) & 0xffff;
      return 0;
    }

    case M_INDY: {
      const tmp = mem[PC];
      mread[PC] = 1;
      if (AC) {
        used_for_zp_addr(msrc[PC], null, tmp);
        used_for_zp_addr(msrc[PC], null, tmp + 1);
      }
      PC = (PC + 1) & 0xffff;
      mread[tmp] = 1;
      mread[tmp + 1] = 1;
      srcEaMsb = msrc[tmp + 1];
      ea = (mem[tmp] + (mem[tmp + 1] << 8) + Yv) & 0xffff;
      if (AC) check_reloc_range(msrc[(PC - 1) & 0xffff], ea, msrc[tmp], Ysrc, srcEaMsb);
      return 0;
    }

    default:
      return 0;
  }
}

function i8(v) {
  return v & 0x80 ? v - 0x100 : v;
}

function setNZ(n, z) {
  P = (P & ~(flagN | flagZ)) | n | (z << 1);
}

function setNZC(n, z, c) {
  P = (P & ~(flagN | flagZ | flagC)) | n | (z << 1) | c;
}

function setNVZC(n, v, z, c) {
  P = (P & ~(flagN | flagV | flagZ | flagC)) | n | (v << 6) | (z << 1) | c;
}

function doCmp(rv, rsrc) {
  const bv = mem[ea];
  const bsrc = msrc[ea];
  mread[ea] = 1;
  const d = (rv - bv) & 0xff;
  if (AC) reloc_alike(bv, bsrc, rv, rsrc);
  setNZC(d & 0x80, d ? 0 : 1, rv >= bv ? 1 : 0);
}

/** Corresponds to emulate() in cpu.c. */
export function emulate(core, start_addr, acc, max_cycles) {
  mem = core.mem;
  msrc = core.src;
  mread = core.read;
  mwritten = core.written;
  AC = R.addConstraints;

  srcPcMsb = cons_src(1, 0);
  srcEaMsb = null;

  PC = start_addr & 0xffff;
  Av = acc & 0xff;
  Asrc = null;
  Xv = 0;
  Xsrc = null;
  Yv = 0;
  Ysrc = null;
  P = 0;
  S = 0xff;
  maxCycles = max_cycles;

  fetch();

  for (;;) {
    const op = OPS[opcode];
    const mode = MODES[opcode];
    const ticks = TICKS[opcode];

    switch (op) {
      /* --- arithmetic --- */

      case OP_ADC: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        const Bv = mem[ea];
        const Bsrc = msrc[ea];
        mread[ea] = 1;
        if (!(P & flagD)) {
          const c = Av + Bv + (P & flagC);
          const v = i8(Av) + i8(Bv) + (P & flagC);
          fetch();
          Av = c & 0xff;
          if (AC) for (let s = Bsrc; s; s = s.next) Asrc = cons_src(s.offset, Asrc);
          setNVZC(
            Av & 0x80,
            ((Av & 0x80) > 0 ? 1 : 0) ^ (v < 0 ? 1 : 0),
            Av === 0 ? 1 : 0,
            (c & 0x100) > 0 ? 1 : 0
          );
        } else {
          /* inelegant & slow, but consistent with the hw for illegal digits */
          let l = (Av & 0x0f) + (Bv & 0x0f) + (P & flagC);
          let h = (Av & 0xf0) + (Bv & 0xf0);
          if (l >= 0x0a) { l -= 0x0a; h += 0x10; }
          if (h >= 0xa0) { h -= 0xa0; }
          fetch();
          const s = h | (l & 0x0f);
          setNVZC(
            s & 0x80,
            ((Av ^ Bv) & 0x80) && ((Av ^ s) & 0x80) ? 0 : 1,
            s ? 0 : 1,
            h & 0x80 ? 1 : 0
          );
          Av = s & 0xff;
          Asrc = null;
          if (maxCycles < 1) return ERR_CYCLES;
          maxCycles -= 1;
        }
        continue;
      }

      case OP_SBC: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        let Bv = mem[ea];
        mread[ea] = 1;
        if (!(P & flagD)) {
          const b = 1 - (P & 0x01);
          const c = Av - Bv - b;
          const v = i8(Av) - i8(Bv) - b;
          fetch();
          Av = c & 0xff;
          setNVZC(
            Av & 0x80,
            ((Av & 0x80) > 0 ? 1 : 0) ^ ((v & 0x100) !== 0 ? 1 : 0),
            Av === 0 ? 1 : 0,
            c >= 0 ? 1 : 0
          );
        } else {
          /* this is verbatim ADC, with a 10's complemented operand */
          Bv = (0x99 - Bv) & 0xff;
          let l = (Av & 0x0f) + (Bv & 0x0f) + (P & flagC);
          let h = (Av & 0xf0) + (Bv & 0xf0);
          if (l >= 0x0a) { l -= 0x0a; h += 0x10; }
          if (h >= 0xa0) { h -= 0xa0; }
          fetch();
          const s = h | (l & 0x0f);
          setNVZC(
            s & 0x80,
            ((Av ^ Bv) & 0x80) && ((Av ^ s) & 0x80) ? 0 : 1,
            s ? 0 : 1,
            h & 0x80 ? 1 : 0
          );
          Av = s & 0xff;
          Asrc = null;
          if (maxCycles < 1) return ERR_CYCLES;
          maxCycles -= 1;
        }
        continue;
      }

      case OP_CMP:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        doCmp(Av, Asrc);
        continue;

      case OP_CPX:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        doCmp(Xv, Xsrc);
        continue;

      case OP_CPY:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        doCmp(Yv, Ysrc);
        continue;

      case OP_DEC: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        const bv = (mem[ea] - 1) & 0xff;
        mread[ea] = 1;
        mem[ea] = bv;
        mwritten[ea] = 1;
        setNZ(bv & 0x80, bv ? 0 : 1);
        continue;
      }

      case OP_INC: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        const bv = (mem[ea] + 1) & 0xff;
        mread[ea] = 1;
        mem[ea] = bv;
        mwritten[ea] = 1;
        setNZ(bv & 0x80, bv ? 0 : 1);
        continue;
      }

      case OP_DEX:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Xv = (Xv - 1) & 0xff;
        setNZ(Xv & 0x80, Xv ? 0 : 1);
        continue;

      case OP_DEY:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Yv = (Yv - 1) & 0xff;
        setNZ(Yv & 0x80, Yv ? 0 : 1);
        continue;

      case OP_INX:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Xv = (Xv + 1) & 0xff;
        setNZ(Xv & 0x80, Xv ? 0 : 1);
        continue;

      case OP_INY:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Yv = (Yv + 1) & 0xff;
        setNZ(Yv & 0x80, Yv ? 0 : 1);
        continue;

      /* --- logic --- */

      case OP_BIT: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        const bv = mem[ea];
        mread[ea] = 1;
        P = (P & ~(flagN | flagV | flagZ)) | (bv & 0xc0) | (((Av & bv) === 0 ? 1 : 0) << 1);
        continue;
      }

      case OP_EOR: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        const bv = mem[ea];
        const bsrc = msrc[ea];
        mread[ea] = 1;
        if (AC) reloc_alike(Av, Asrc, bv, bsrc);
        Av ^= bv;
        Asrc = null;
        setNZ(Av & 0x80, Av ? 0 : 1);
        continue;
      }

      case OP_AND:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        Av &= mem[ea];
        mread[ea] = 1;
        Asrc = null;
        setNZ(Av & 0x80, Av ? 0 : 1);
        continue;

      case OP_ORA:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        Av |= mem[ea];
        mread[ea] = 1;
        Asrc = null;
        setNZ(Av & 0x80, Av ? 0 : 1);
        continue;

      /* --- shifts --- */

      case OP_ASL: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        const i = mem[ea] << 1;
        mread[ea] = 1;
        mem[ea] = i & 0xff;
        msrc[ea] = null;
        mwritten[ea] = 1;
        fetch();
        setNZC(i & 0x80, i ? 0 : 1, i >> 8);
        continue;
      }

      case OP_ASLA: {
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        fetch();
        const c = Av >> 7;
        Av = (Av << 1) & 0xff;
        Asrc = null;
        setNZC(Av & 0x80, Av ? 0 : 1, c);
        continue;
      }

      case OP_LSR: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        const bv = mem[ea];
        mread[ea] = 1;
        const c = bv & 1;
        fetch();
        const nv = bv >> 1;
        mem[ea] = nv;
        msrc[ea] = null;
        mwritten[ea] = 1;
        setNZC(0, nv ? 0 : 1, c);
        continue;
      }

      case OP_LSRA: {
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        fetch();
        const c = Av & 1;
        Av >>= 1;
        Asrc = null;
        setNZC(0, Av ? 0 : 1, c);
        continue;
      }

      case OP_ROL: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        const vv = mem[ea];
        mread[ea] = 1;
        const b = ((vv << 1) | (P & flagC)) & 0xffff;
        fetch();
        mem[ea] = b & 0xff;
        msrc[ea] = null;
        mwritten[ea] = 1;
        setNZC(b & 0x80, b & 0xff ? 0 : 1, b >> 8);
        continue;
      }

      case OP_ROLA: {
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        fetch();
        const b = ((Av << 1) | (P & flagC)) & 0xffff;
        Av = b & 0xff;
        Asrc = null;
        setNZC(Av & 0x80, Av ? 0 : 1, b >> 8);
        continue;
      }

      case OP_ROR: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        const c = P & flagC;
        const mv = mem[ea];
        mread[ea] = 1;
        const b = ((c << 7) | (mv >> 1)) & 0xff;
        fetch();
        mem[ea] = b;
        msrc[ea] = null;
        mwritten[ea] = 1;
        setNZC(b & 0x80, b ? 0 : 1, mv & 1);
        continue;
      }

      case OP_RORA: {
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        const ci = P & flagC;
        const co = Av & 1;
        fetch();
        Av = ((ci << 7) | (Av >> 1)) & 0xff;
        Asrc = null;
        setNZC(Av & 0x80, Av ? 0 : 1, co);
        continue;
      }

      /* --- transfers --- */

      case OP_TAX:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Xv = Av;
        Xsrc = Asrc;
        setNZ(Xv & 0x80, Av ? 0 : 1);
        continue;

      case OP_TXA:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Av = Xv;
        Asrc = Xsrc;
        setNZ(Av & 0x80, Xv ? 0 : 1);
        continue;

      case OP_TAY:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Yv = Av;
        Ysrc = Asrc;
        setNZ(Yv & 0x80, Av ? 0 : 1);
        continue;

      case OP_TYA:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Av = Yv;
        Asrc = Ysrc;
        setNZ(Av & 0x80, Yv ? 0 : 1);
        continue;

      case OP_TSX:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        Xv = S;
        Xsrc = null;
        setNZ(S & 0x80, S ? 0 : 1);
        continue;

      case OP_TXS:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        if (Xsrc !== null) dont_reloc(Xsrc);
        S = Xv;
        continue;

      /* --- loads and stores --- */

      case OP_LDA:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        Av = mem[ea];
        Asrc = msrc[ea];
        mread[ea] = 1;
        setNZ(Av & 0x80, Av ? 0 : 1);
        continue;

      case OP_LDX:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        Xv = mem[ea];
        Xsrc = msrc[ea];
        mread[ea] = 1;
        setNZ(Xv & 0x80, Xv ? 0 : 1);
        continue;

      case OP_LDY:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        Yv = mem[ea];
        Ysrc = msrc[ea];
        mread[ea] = 1;
        setNZ(Yv & 0x80, Yv ? 0 : 1);
        continue;

      case OP_STA:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        mem[ea] = Av;
        msrc[ea] = Asrc;
        mwritten[ea] = 1;
        continue;

      case OP_STX:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        mem[ea] = Xv;
        msrc[ea] = Xsrc;
        mwritten[ea] = 1;
        continue;

      case OP_STY:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        mem[ea] = Yv;
        msrc[ea] = Ysrc;
        mwritten[ea] = 1;
        continue;

      /* --- branches --- */

      case OP_BCC:
      case OP_BCS:
      case OP_BNE:
      case OP_BEQ:
      case OP_BPL:
      case OP_BMI:
      case OP_BVC:
      case OP_BVS: {
        let cond;
        switch (op) {
          case OP_BCC: cond = !(P & flagC); break;
          case OP_BCS: cond = !!(P & flagC); break;
          case OP_BNE: cond = !(P & flagZ); break;
          case OP_BEQ: cond = !!(P & flagZ); break;
          case OP_BPL: cond = !(P & flagN); break;
          case OP_BMI: cond = !!(P & flagN); break;
          case OP_BVC: cond = !(P & flagV); break;
          default: cond = !!(P & flagV); break;
        }
        if (cond) {
          if (applyMode(M_RELATIVE, ticks)) return ERR_CYCLES;
          PC = (PC + ea) & 0xffff;
          if (maxCycles < 1) return ERR_CYCLES;
          maxCycles -= 1;
        } else {
          if (maxCycles < ticks) return ERR_CYCLES;
          maxCycles -= ticks;
          PC = (PC + 1) & 0xffff;
        }
        fetch();
        continue;
      }

      /* --- jumps, calls and returns --- */

      case OP_JMP:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        PC = ea;
        srcPcMsb = srcEaMsb;
        fetch();
        continue;

      case OP_JSR: {
        PC = (PC + 1) & 0xffff;
        mem[0x0100 + S] = (PC >> 8) & 0xff;
        msrc[0x0100 + S] = srcPcMsb;
        S = (S - 1) & 0xff;
        mem[0x0100 + S] = PC & 0xff;
        msrc[0x0100 + S] = null;
        S = (S - 1) & 0xff;
        PC = (PC - 1) & 0xffff;
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        PC = ea;
        srcPcMsb = srcEaMsb;
        fetch();
        continue;
      }

      case OP_RTS: {
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        if (S >= 0xfe) return ERR_OK;
        S = (S + 1) & 0xff;
        const lsbv = mem[0x0100 + S];
        const lsbs = msrc[0x0100 + S];
        S = (S + 1) & 0xff;
        const msbv = mem[0x0100 + S];
        const msbs = msrc[0x0100 + S];
        PC = (lsbv | (msbv << 8)) & 0xffff;
        srcPcMsb = msbs;
        if (AC) check_reloc_range(null, PC, lsbs, null, msbs);
        PC = (PC + 1) & 0xffff;
        fetch();
        continue;
      }

      case OP_RTI: {
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        if (S >= 0xfd) return ERR_OK;
        S = (S + 1) & 0xff;
        const statusv = mem[0x0100 + S];
        const statuss = msrc[0x0100 + S];
        S = (S + 1) & 0xff;
        const lsbv = mem[0x0100 + S];
        const lsbs = msrc[0x0100 + S];
        S = (S + 1) & 0xff;
        const msbv = mem[0x0100 + S];
        const msbs = msrc[0x0100 + S];
        P = statusv;
        PC = (lsbv | (msbv << 8)) & 0xffff;
        srcPcMsb = msbs;
        if (statuss !== null) dont_reloc(statuss);
        if (AC) check_reloc_range(null, PC, lsbs, null, msbs);
        fetch();
        continue;
      }

      case OP_BRK:
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        return ERR_BRK;

      /* --- stack --- */

      case OP_PHA:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        mem[0x0100 + S] = Av;
        msrc[0x0100 + S] = Asrc;
        S = (S - 1) & 0xff;
        continue;

      case OP_PHP:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        mem[0x0100 + S] = P;
        msrc[0x0100 + S] = null;
        S = (S - 1) & 0xff;
        continue;

      case OP_PLA:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        if (S >= 0xff) return ERR_OK;
        S = (S + 1) & 0xff;
        Av = mem[0x0100 + S];
        Asrc = msrc[0x0100 + S];
        setNZ(Av & 0x80, Av ? 0 : 1);
        continue;

      case OP_PLP: {
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        if (S >= 0xff) return ERR_OK;
        S = (S + 1) & 0xff;
        const vv = mem[0x0100 + S];
        const vs = msrc[0x0100 + S];
        if (vs !== null) dont_reloc(vs);
        P = vv;
        continue;
      }

      /* --- flags --- */

      case OP_CLC:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        P &= ~flagC;
        continue;

      case OP_CLD:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        P &= ~flagD;
        continue;

      case OP_CLI:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        P &= ~flagI;
        continue;

      case OP_CLV:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        P &= ~flagV;
        continue;

      case OP_SEC:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        P |= flagC;
        continue;

      case OP_SED:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        P |= flagD;
        continue;

      case OP_SEI:
        fetch();
        if (maxCycles < ticks) return ERR_CYCLES;
        maxCycles -= ticks;
        P |= flagI;
        continue;

      /* --- misc --- */

      case OP_NOP:
        if (applyMode(mode, ticks)) return ERR_CYCLES;
        fetch();
        continue;

      default:
        putErr(`Illegal opcode: $${hex2(opcode)} (PC = $${hex4(PC)})\n`);
        return ERR_ILLEGAL;
    }
  }
}
