/* JavaScript port of sidreloc 1.0 reloc.h (DOM/BRK variant).
 *
 * Original C sources: Copyright (c) 2012 Linus Akesson, MIT licence.
 * DOM/BRK variant: Dominic Beesley (sidreloc-1.0-dom, sidplay-build / Stardot).
 *
 * This module corresponds to reloc.h: the shared tagged-byte representation,
 * the global analysis state and the source-list ("arena") allocator helpers.
 */

export const RELEASE = '1.0';

export const PBF_DONT_RELOC = 0x01;
export const PBF_RELOC = 0x02;
export const PBF_USED_IN_ZP = 0x04;
export const PBF_USED_IN_MSB = 0x08;
export const PBF_USED_FOR_SID = 0x10;
export const PBF_USED_FOR_SIDBRK = 0x20;

export const RET_SUCCESS = 0;
export const RET_HEADER = 1;
export const RET_RSID = 2;
export const RET_MUS = 3;
export const RET_BASIC = 4;
export const RET_PSID = 5;
export const RET_PARAM = 6;
export const RET_IO = 7;
export const RET_CONSTR = 8;
export const RET_ZPFULL = 9;
export const RET_VERIFY = 10;
export const RET_PLAYADDR = 11;
export const RET_RANGE = 12;
export const RET_CYCLES = 13;

export const ERR_OK = 0;
export const ERR_BRK = 1;
export const ERR_INTERNAL = 2;
export const ERR_ILLEGAL = 3;
export const ERR_CYCLES = 4;

export const emulate_err = [
  'BRK instruction',
  'Internal CPU emulator error',
  'Illegal opcode',
  'Max cycles exhausted (infinite loop?)',
];

/* The C program keeps these as file-scope globals shared between
 * sidreloc.c, cpu.c and solver.c. */
export const R = {
  pbFlags: null, // Uint8Array(progsize + 2)          progbytes[i].flags
  pbZp: null, // Uint8Array((progsize + 2) * 32)   progbytes[i].zpaddr
  pbConstr: null, // Array((progsize + 2))             progbytes[i].constr
  progsize: 0,
  progbyteOrg: 0,

  relocStart: 0,
  relocEnd: 0,
  sidSource: 0xd400,
  sidDest: 0xd400,

  addConstraints: 0,
  verbose: 0,
  doZpReloc: 1,
};

/* --- captured program output ------------------------------------------- */

export const io = {
  progName: 'sidreloc',
  out: [],
  err: [],
};

export class ExitError extends Error {
  constructor(code) {
    super(`exit ${code}`);
    this.code = code;
  }
}

export function putOut(s) {
  io.out.push(s);
}

export function putErr(s) {
  io.err.push(s);
}

/** errx(3): print "progname: message" on stderr and terminate. */
export function errx(code, msg) {
  putErr(`${io.progName}: ${msg}\n`);
  throw new ExitError(code);
}

export function resetIo(progName) {
  io.progName = progName;
  io.out = [];
  io.err = [];
}

/* --- printf helpers ----------------------------------------------------- */

export function hex2(n) {
  return (n & 0xff).toString(16).padStart(2, '0');
}

export function hex4(n) {
  return (n & 0xffff).toString(16).padStart(4, '0');
}

/* --- core --------------------------------------------------------------- */

/* The C emulator indexes memory[] with expressions such as PC + 1 and
 * (byte)(zp + 1) that are not truncated to 16 bits, so a couple of slack
 * entries are allocated past the end of the address space. */
const CORE_SLACK = 4;

export function makeCore() {
  return {
    mem: new Uint8Array(65536 + CORE_SLACK),
    src: new Array(65536 + CORE_SLACK).fill(null),
    read: new Uint8Array(65536 + CORE_SLACK),
    written: new Uint8Array(65536 + CORE_SLACK),
  };
}

export function clearCore(core) {
  core.mem.fill(0);
  core.src.fill(null);
  core.read.fill(0);
  core.written.fill(0);
}

/* --- source lists ------------------------------------------------------- */

export class Src {
  constructor(offset, next) {
    this.offset = offset;
    this.next = next;
  }
}

/* cons_src() hands out a shared singleton whenever the list would have a
 * single element; those cells are never mutated afterwards. */
let prealloc = null;

export function prealloc_cons_cells() {
  prealloc = new Array(0x10000);
  for (let i = 0; i < 0x10000; i++) prealloc[i] = new Src(i, null);
}

export function cons_src(offset, cdr) {
  if (!R.addConstraints) return null;

  if (R.pbFlags[offset] & PBF_DONT_RELOC) {
    // This progbyte can't possibly be relocatable, so
    // there's no need to add it to the list.
    return cdr;
  }

  if (!cdr) return prealloc[offset];

  for (let s = cdr; s; s = s.next) {
    if (s.offset === offset) {
      for (s = s.next; s; s = s.next) {
        if (s.offset === offset) {
          // No need to add the same program byte more than twice to a list.
          return cdr;
        }
      }
      break;
    }
  }

  return new Src(offset, cdr);
}

/* The arena exists in C purely to make allocation cheap and to allow bulk
 * reclamation; the JS port relies on the garbage collector instead. */
export function gc_arena(_core) {}
export function free_arena() {}

/* --- relocation flags --------------------------------------------------- */

export function dont_reloc_at(offset) {
  R.pbFlags[offset] |= PBF_DONT_RELOC;
}

export function dont_reloc(src) {
  if (R.addConstraints) {
    while (src) {
      R.pbFlags[src.offset] |= PBF_DONT_RELOC;
      src = src.next;
    }
  }
}
