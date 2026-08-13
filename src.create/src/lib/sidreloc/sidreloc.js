/* JavaScript port of sidreloc 1.0 sidreloc.c (DOM/BRK variant).
 *
 * Original C source: Copyright (c) 2012 Linus Akesson, MIT licence.
 * DOM/BRK output: Dominic Beesley (sidreloc-1.0-dom, sidplay-build / Stardot).
 *
 * The command-line front end becomes relocateSid(), which returns the output
 * file image together with the text the C program would have written to stdout
 * and stderr and the process exit status.
 */

import {
  R,
  io,
  ExitError,
  errx,
  putOut,
  putErr,
  resetIo,
  hex2,
  hex4,
  makeCore,
  cons_src,
  prealloc_cons_cells,
  gc_arena,
  free_arena,
  emulate_err,
  ERR_CYCLES,
  PBF_RELOC,
  PBF_USED_IN_ZP,
  PBF_USED_IN_MSB,
  PBF_USED_FOR_SID,
  PBF_USED_FOR_SIDBRK,
  RET_SUCCESS,
  RET_HEADER,
  RET_RSID,
  RET_MUS,
  RET_BASIC,
  RET_PSID,
  RET_PARAM,
  RET_CONSTR,
  RET_ZPFULL,
  RET_VERIFY,
  RET_PLAYADDR,
  RET_RANGE,
  RET_CYCLES,
} from './reloc.js';
import {
  check_reloc_range,
  finalise_constraints,
  free_progbytes,
  init_progbytes,
  reloc_map,
  resetSolver,
  solver,
  trivially_inconsistent,
} from './solver.js';
import { emulate } from './cpu.js';

const RETF_OUTOFBOUNDS = 0x20;
const RETF_TOLERANCE = 0x40;

/* Unmasked hex, matching printf("%04x") on a value that C leaves as an int. */
function hx4(n) {
  return n.toString(16).padStart(4, '0');
}

function cstr(bytes, off, len) {
  let end = off;
  const max = off + len;
  while (end < max && bytes[end] !== 0) end++;
  let s = '';
  for (let i = off; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * Relocate a PSID/RSID file.
 *
 * @param {Uint8Array|Buffer|ArrayBuffer} inputBuffer  contents of the input .sid
 * @param {object} [options]
 * @param {number} [options.page=0x10]        first page (-p / --page)
 * @param {boolean} [options.keepZp=false]    -k / --no-zp-reloc (keep original zp addresses)
 * @param {number} [options.zpFirst=0x80]     -z / --zp-reloc lower bound
 * @param {number} [options.zpLast=0xff]      -z / --zp-reloc upper bound
 * @param {number} [options.relocStartPage]   -r / --reloc lower page
 * @param {number} [options.relocEndPage]     -r / --reloc upper page
 * @param {number} [options.tolerance=2]      -t / --tolerance
 * @param {boolean} [options.strict=false]    -s / --strict
 * @param {boolean} [options.force=false]     -f / --force
 * @param {number} [options.verbose=0]        -v / --verbose (repeatable)
 * @param {boolean} [options.quiet=false]     -q / --quiet
 * @param {number} [options.frames=100000]    --frames
 * @param {number} [options.nmiCalls=200]     --nmi-calls
 * @param {number} [options.initCycles=1000000] --init-cycles
 * @param {number} [options.playCycles=20000] --play-cycles
 * @param {number} [options.nmiCycles=1000]   --nmi-cycles
 * @param {number} [options.sidSource]        --sid-source-address
 * @param {number} [options.sidDest]          --sid-dest-address
 * @param {string} [options.progName='sidreloc'] name used in errx() messages
 * @returns {{relSid: Uint8Array|null, brkText: string, errText: string, exitCode: number}}
 */
export function relocateSid(inputBuffer, options = {}) {
  const progName = options.progName ?? 'sidreloc';
  resetIo(progName);
  resetSolver();

  let exitCode = RET_SUCCESS;
  let relSid = null;

  try {
    relSid = run(inputBuffer, options);
  } catch (e) {
    if (e instanceof ExitError) {
      exitCode = e.code;
    } else {
      throw e;
    }
  }

  if (relSid) exitCode = RET_SUCCESS | exitbits;

  return {
    relSid,
    brkText: io.out.join(''),
    errText: io.err.join(''),
    exitCode,
  };
}

let exitbits = 0;
let nmi_reported = 0;
let quiet = 0;
let force = 0;
let cycles_init = 1000000;
let cycles_play = 20000;
let play_calls = 100000;
let nmi_calls = 200;
let cycles_nmi = 1000;

const oldcore = makeCore();
const newcore = makeCore();

/* struct zeropage zeropage[256] */
const zpLink = new Uint8Array(256);
const zpReloc = new Uint8Array(256);
const zpFree = new Uint8Array(256);

function readheader(head, data, filesize) {
  if (filesize <= 0x80) return 1;
  if (data[0] === 0x50 /* 'P' */) {
    head.rsid = 0;
  } else if (data[0] === 0x52 /* 'R' */) {
    head.rsid = 1;
  } else return 1;
  if (data[1] !== 0x53 /* 'S' */) return 1;
  if (data[2] !== 0x49 /* 'I' */) return 1;
  if (data[3] !== 0x44 /* 'D' */) return 1;
  head.version = ((data[4] << 8) | data[5]) & 0xffff;
  if (head.version < 1 || head.version > 2) return 1;
  head.dataoffset = ((data[6] << 8) | data[7]) & 0xffff;
  if (head.version === 1 && head.dataoffset !== 0x76) return 1;
  if (head.version === 2 && head.dataoffset !== 0x7c) return 1;
  head.loadaddr = ((data[8] << 8) | data[9]) & 0xffff;
  if (!head.loadaddr) {
    head.loadaddr = (data[head.dataoffset] | (data[head.dataoffset + 1] << 8)) & 0xffff;
    head.dataoffset = (head.dataoffset + 2) & 0xffff;
  }
  head.loadsize = (filesize - head.dataoffset) & 0xffff;
  if (head.loadaddr < 0x7e8 && head.rsid) errx(RET_RSID, 'RSID standard violation');
  head.initaddr = ((data[0x0a] << 8) | data[0x0b]) & 0xffff;
  if (!head.initaddr) head.initaddr = head.loadaddr;
  head.playaddr = ((data[0x0c] << 8) | data[0x0d]) & 0xffff;
  /* nsubtune and defsubtune are uint8_t in the C struct, hence the truncation. */
  head.nsubtune = ((data[0x0e] << 8) | data[0x0f]) & 0xff;
  head.defsubtune = ((data[0x10] << 8) | data[0x11]) & 0xff;
  head.title = cstr(data, 0x16, 31);
  head.author = cstr(data, 0x36, 31);
  head.released = cstr(data, 0x56, 31);
  if (head.version > 1) {
    const flags = ((data[0x76] << 8) | data[0x77]) & 0xffff;
    if (flags & 1) errx(RET_MUS, 'MUS format not supported');
    if (head.rsid && flags & 2) errx(RET_BASIC, 'BASIC tunes not supported');
    if (!head.rsid && flags & 2) errx(RET_PSID, 'PSID tunes not supported');
  }
  return 0;
}

/* Note: read[]/written[] are deliberately not cleared here, matching the C
 * version where init_core() only memsets core->memory. */
function init_core(core, data, dataStart, loadaddr, loadsize) {
  core.mem.fill(0);
  core.src.fill(null);

  for (let i = 0xea31; i <= 0xea86; i++) {
    core.mem[i] = 0x68; // pla
  }

  const limit = core.mem.length;
  for (let i = 0; i < loadsize; i++) {
    const a = loadaddr + i;
    if (a >= limit) break;
    core.mem[a] = data[dataStart + i];
    core.src[a] = cons_src(i + 2, null);
  }
}

function get_from_vector(core, fallback, vaddr) {
  const vector = (core.mem[vaddr] | (core.mem[vaddr + 1] << 8)) & 0xffff;
  if (vector) {
    check_reloc_range(null, vector, core.src[vaddr], null, core.src[vaddr + 1]);
    return vector;
  }
  return fallback;
}

function init_tune(core, initaddr, tune) {
  const errcode = emulate(core, initaddr, tune, cycles_init);
  if (errcode === ERR_CYCLES) {
    errx(RET_CYCLES | exitbits, 'Max cycles exhausted during init routine. Infinite loop?');
  }
  if (errcode) putErr(`${emulate_err[errcode - 1]}\n`);
}

function play_step(core, playaddr, errprefix) {
  let allow_digi = 1;

  playaddr = get_from_vector(core, playaddr, 0x0314);
  playaddr = get_from_vector(core, playaddr, 0xfffe);

  if (!playaddr) {
    playaddr = get_from_vector(core, playaddr, 0x0318);
    playaddr = get_from_vector(core, playaddr, 0xfffa);
    allow_digi = 0;
  }

  if (!playaddr) {
    errx(RET_PLAYADDR, `${errprefix}Couldn't determine address of playroutine.`);
  }

  let errcode = emulate(core, playaddr, 0, cycles_play);
  if (errcode === ERR_CYCLES && !force) {
    errx(RET_CYCLES | exitbits, 'Max cycles exhausted during playroutine. Infinite loop?');
  }
  if (errcode) {
    putErr(`${errprefix}${emulate_err[errcode - 1]}\n`);
  } else if (allow_digi) {
    let digiaddr = get_from_vector(core, 0, 0x0318);
    digiaddr = get_from_vector(core, digiaddr, 0xfffa);
    if (digiaddr) {
      if (!nmi_reported) {
        putErr('Use of digis detected. NMI routine will also be relocated.\n');
        nmi_reported = 1;
      }
      for (let i = 0; i < nmi_calls; i++) {
        errcode = emulate(core, digiaddr, 0, cycles_nmi);
        if (errcode === ERR_CYCLES && !force) {
          errx(RET_CYCLES | exitbits, 'Max cycles exhausted during NMI routine. Infinite loop?');
        }
        if (errcode) break;
      }
    }
  }

  return errcode;
}

function verify_sidstate(oldmem, newmem, frame, counters) {
  const badp = [0, 0, 0];
  const badpw = [0, 0, 0];

  for (let i = 0; i < 29; i++) {
    if (oldmem[R.sidSource + i] !== newmem[R.sidDest + i]) {
      if (i < 21 && i % 7 < 2) {
        badp[(i / 7) | 0] = 1;
      } else if (i < 21 && i % 7 < 4) {
        badpw[(i / 7) | 0] = 1;
      } else {
        let msg = 'Wrong SID state! ';
        if (frame >= 0) {
          msg += `At time ${frame}, `;
        } else {
          msg += 'After the init routine, ';
        }
        msg +=
          `$${hex2(R.sidDest >> 8)}${hex2(i)} should be $${hex2(oldmem[R.sidSource + i])},` +
          ` but the relocated code has written $${hex2(newmem[R.sidDest + i])}.\n`;
        putErr(msg);
        if (!force) throw new ExitError(RET_VERIFY | exitbits);
      }
    }
  }
  counters.badpitch += badp[0] + badp[1] + badp[2];
  counters.badpw += badpw[0] + badpw[1] + badpw[2];
}

function zeropage_map() {
  let s = 'Old zero-page addresses:  ';
  for (let i = 2; i < 256; i++) {
    if (oldcore.written[i]) s += ` ${hex2(i)}`;
  }
  s += '\nNew zero-page addresses:  ';
  for (let i = 2; i < 256; i++) {
    if (oldcore.written[i]) s += ` ${hex2((i + zpReloc[i]) & 0xff)}`;
  }
  s += '\n';
  putErr(s);
}

function report_oob(first, last) {
  if (!quiet && first !== 0xd400) {
    if (first === last) {
      putErr(`Warning: Write out of bounds at address $${hex4(first)}\n`);
    } else {
      putErr(`Warning: Write out of bounds at address $${hex4(first)}-$${hex4(last)}\n`);
    }
  }
}

function checkParam(ok, msg) {
  if (!ok) errx(RET_PARAM, msg);
}

function run(inputBuffer, options) {
  /* --- reset globals (the C program is a fresh process each time) --- */
  exitbits = 0;
  nmi_reported = 0;
  zpLink.fill(0);
  zpReloc.fill(0);
  zpFree.fill(0);
  oldcore.read.fill(0);
  oldcore.written.fill(0);
  newcore.read.fill(0);
  newcore.written.fill(0);

  R.sidSource = 0xd400;
  R.sidDest = 0xd400;
  R.addConstraints = 0;
  R.doZpReloc = 1;
  R.verbose = 0;
  R.relocStart = 0;
  R.relocEnd = 0;

  cycles_init = 1000000;
  cycles_play = 20000;
  play_calls = 100000;
  nmi_calls = 200;
  cycles_nmi = 1000;
  quiet = 0;
  force = 0;

  /* --- option handling (getopt_long equivalent) --- */

  let first_zp = 0x80;
  let last_zp = 0xff;
  let given_reloc_start = -1;
  let given_reloc_end = -1;
  let given_sid_source = -1;
  let given_sid_dest = -1;
  let dest_page = 0x10;
  let tolerance = 2;
  let strictpw = 0;

  if (options.page !== undefined) {
    dest_page = options.page | 0;
    checkParam(
      dest_page >= 0x00 && dest_page <= 0xff,
      'Invalid page number (should be a hexadecimal number in the range 00-ff)'
    );
  }
  if (options.zpFirst !== undefined || options.zpLast !== undefined) {
    first_zp = (options.zpFirst ?? 0x80) | 0;
    last_zp = (options.zpLast ?? 0xff) | 0;
    checkParam(
      first_zp >= 0x02 && first_zp <= 0xff && last_zp >= 0x02 && last_zp <= 0xff && first_zp <= last_zp,
      'Invalid zero-page address range (should be two hexadecimal numbers in the range 02-ff)'
    );
    putErr(`Relocating zp ${hex2(first_zp)}-${hex2(last_zp)}\n`);
  }
  if (options.keepZp) R.doZpReloc = 0;
  if (options.relocStartPage !== undefined || options.relocEndPage !== undefined) {
    given_reloc_start = (options.relocStartPage ?? -1) | 0;
    given_reloc_end = (options.relocEndPage ?? -1) | 0;
    checkParam(
      given_reloc_start >= 0x01 &&
        given_reloc_start <= 0xff &&
        given_reloc_end >= 0x01 &&
        given_reloc_end <= 0xff &&
        given_reloc_start <= given_reloc_end,
      'Invalid relocation range (should be two hexadecimal numbers in the range 01-ff)'
    );
  }
  if (options.tolerance !== undefined) {
    tolerance = options.tolerance | 0;
    checkParam(
      tolerance >= 0 && tolerance < 100,
      'Invalid tolerance percentage (should be an integer in the range 0-100)'
    );
  }
  if (options.strict) strictpw = 1;
  if (options.force) force = 1;
  if (options.verbose) R.verbose = options.verbose | 0;
  if (options.quiet) quiet = 1;
  if (options.frames !== undefined) {
    play_calls = options.frames | 0;
    checkParam(play_calls >= 0, 'Invalid number of calls to the playroutine.');
  }
  if (options.nmiCalls !== undefined) {
    nmi_calls = options.nmiCalls | 0;
    checkParam(nmi_calls >= 0, 'Invalid number of calls to the NMI routine.');
  }
  if (options.initCycles !== undefined) {
    cycles_init = options.initCycles | 0;
    checkParam(cycles_init >= 0, 'Invalid cycle limit for the init routine.');
  }
  if (options.playCycles !== undefined) {
    cycles_play = options.playCycles | 0;
    checkParam(cycles_play >= 0, 'Invalid cycle limit for the playroutine.');
  }
  if (options.nmiCycles !== undefined) {
    cycles_nmi = options.nmiCycles | 0;
    checkParam(cycles_nmi >= 0, 'Invalid cycle limit for the NMI routine.');
  }
  if (options.sidSource !== undefined) {
    given_sid_source = options.sidSource | 0;
    checkParam(
      given_sid_source >= 0x0100 && given_sid_source <= 0xffe0,
      'Invalid SID source address.'
    );
  }
  if (options.sidDest !== undefined) {
    given_sid_dest = options.sidDest | 0;
    checkParam(given_sid_dest >= 0x0100 && given_sid_dest <= 0xffe0, 'Invalid SID destination address.');
  }

  /* --- read the SID file --- */

  const input =
    inputBuffer instanceof ArrayBuffer
      ? new Uint8Array(inputBuffer)
      : ArrayBuffer.isView(inputBuffer)
        ? new Uint8Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.byteLength)
        : Uint8Array.from(inputBuffer);
  const data = new Uint8Array(65536);
  const filesize = Math.min(input.length, 65536);
  data.set(input.subarray(0, filesize));

  const head = {};
  if (readheader(head, data, filesize)) errx(RET_HEADER, 'Bad SID file header');
  if (R.verbose >= 0) {
    putErr(
      `${head.title}, ${head.author}, ${head.released}, ` +
        `$${hx4(head.loadaddr)}-$${hx4(head.loadaddr + head.loadsize - 1)}, ` +
        `${head.nsubtune} subtunes\n`
    );
  }

  /* --- determine the relocation area --- */

  R.relocStart = head.loadaddr & 0xff00;
  R.relocEnd = (head.loadaddr + head.loadsize - 1) | 0x00ff;
  R.relocEnd &= 0xffff;

  for (let i = 0; i < 64 && R.relocEnd !== 0xcfff && R.relocEnd !== 0xffff; i++) {
    R.relocEnd = (R.relocEnd + 0x100) & 0xffff;
  }

  if (given_reloc_start >= 0) {
    R.relocStart = (given_reloc_start << 8) & 0xffff;
    R.relocEnd = ((given_reloc_end << 8) | 0xff) & 0xffff;
    if (R.relocStart > head.loadaddr || R.relocEnd < head.loadaddr + head.loadsize - 1) {
      errx(
        RET_RANGE,
        'Relocation range (-r) must contain all the SID data! ' +
          `(SID loads at $${hx4(head.loadaddr)}-$${hx4(head.loadaddr + head.loadsize - 1)})`
      );
    }
  }

  if (given_sid_source >= 0) R.sidSource = given_sid_source;
  if (given_sid_dest >= 0) R.sidDest = given_sid_dest;

  const reloc_offset = ((dest_page << 8) - R.relocStart) & 0xffff;
  const sid_offset = (R.sidDest - R.sidSource) & 0xffff;

  putErr(
    `Relocating from $${hex4(R.relocStart)}-$${hex4(R.relocEnd)} to ` +
      `$${hex4((R.relocStart + reloc_offset) & 0xffff)}-$${hex4((R.relocEnd + reloc_offset) & 0xffff)}\n`
  );

  if (
    R.relocStart < 0x100 ||
    R.relocEnd < R.relocStart ||
    ((R.relocStart + reloc_offset) & 0xffff) < 0x100 ||
    ((R.relocEnd + reloc_offset) & 0xffff) < ((R.relocStart + reloc_offset) & 0xffff)
  ) {
    errx(
      RET_RANGE,
      'Neither the source nor the destination relocation range may overlap with the zero-page.'
    );
  }

  prealloc_cons_cells();

  /* --- visit all subtunes --- */

  init_progbytes(head.loadaddr, head.loadsize);
  R.addConstraints = 1;

  for (let i = 0; i < head.nsubtune; i++) {
    putErr(`Analysing subtune ${i + 1}\n`);
    nmi_reported = 0;
    init_core(oldcore, data, head.dataoffset, head.loadaddr, head.loadsize);
    init_tune(oldcore, head.initaddr, i);
    for (let j = 0; j < play_calls; j++) {
      if (play_step(oldcore, head.playaddr, '')) break;
    }
    gc_arena(oldcore);
  }

  /* --- report bad memory accesses, possibly remove some zero-page addresses --- */

  let oobchunk = R.sidSource;
  let ooblast = R.sidSource;
  for (let i = 0; i < 65536; i++) {
    if (i >= head.loadaddr && i < head.loadaddr + head.loadsize) {
      /* Inside tune, ok */
    } else if (i >= R.sidSource && i <= R.sidSource + 0x1f) {
      /* SID register area */
    } else if (i >= 2 && i < 0x100) {
      if (oldcore.read[i] && !oldcore.written[i]) {
        if (!quiet) {
          putErr(
            `Warning: Zero-page address $${hex2(i)} read but never written.` +
              `${R.doZpReloc ? ' Not relocating it.' : ''}\n`
          );
        }
        for (let j = 0; j < R.progsize; j++) {
          const pb = j + 2;
          if (R.pbFlags[pb] & PBF_USED_IN_ZP && R.pbZp[pb * 32 + (i >> 3)] & (1 << (i & 7))) {
            R.pbZp[pb * 32 + (i >> 3)] &= ~(1 << (i & 7));
            let k;
            for (k = 0; k < 32; k++) if (R.pbZp[pb * 32 + k]) break;
            if (k === 32) R.pbFlags[pb] &= ~(PBF_RELOC | PBF_USED_IN_ZP);
          }
        }
      }
    } else {
      if (oldcore.written[i]) {
        exitbits |= RETF_OUTOFBOUNDS;
        if (ooblast !== i - 1) {
          report_oob(oobchunk, ooblast);
          oobchunk = i;
        }
        ooblast = i;
      }
    }
  }
  report_oob(oobchunk, ooblast);

  finalise_constraints(oldcore);

  /* --- find a solution to the set of constraints --- */

  if (trivially_inconsistent() || solver()) errx(RET_CONSTR | exitbits, 'No solution found');

  /* --- map the zero-page addresses to new locations --- */

  for (let i = 0; i < 256; i++) {
    zpLink[i] = i;
    zpFree[i] = i >= first_zp && i <= last_zp ? 1 : 0;
  }

  for (let i = 0; i < R.progsize; i++) {
    const pb = i + 2;
    if ((R.pbFlags[pb] & (PBF_RELOC | PBF_USED_IN_ZP)) === (PBF_RELOC | PBF_USED_IN_ZP)) {
      let first = -1;
      for (let j = 0; j < 256; j++) {
        if (R.pbZp[pb * 32 + (j >> 3)] & (1 << (j & 7))) {
          if (first !== -1) {
            // One relocated program byte contributes to
            // several zero-page addresses. Link them.
            if (zpLink[j] > zpLink[first]) {
              zpLink[j] = zpLink[first];
            } else {
              zpLink[first] = zpLink[j];
            }
          } else {
            first = j;
          }
        }
      }
    }
  }

  for (let i = 0; i < 256; i++) {
    if (zpLink[i] !== zpLink[zpLink[i]]) {
      zpLink[i] = zpLink[zpLink[i]];
    }
  }

  if (R.doZpReloc) {
    for (let chunk = 2; chunk < 0x100; chunk++) {
      if (oldcore.written[chunk] && zpLink[chunk] === chunk) {
        // We have a chunk to place somewhere.
        let dest;
        for (dest = first_zp; dest <= last_zp; dest++) {
          // Try to put it at dest.
          let i;
          for (i = chunk; i < 0x100; i++) {
            if (zpLink[i] === chunk) {
              if (!zpFree[(dest + i - chunk) & 0xff]) break;
            }
          }
          if (i === 0x100) {
            // It fits!
            for (i = chunk; i < 0x100; i++) {
              if (zpLink[i] === chunk) {
                zpReloc[i] = (dest - chunk) & 0xff;
                zpFree[dest + i - chunk] = 0;
              }
            }
            break;
          }
        }
        if (dest > last_zp) {
          errx(
            RET_ZPFULL | exitbits,
            `Can't fit all zero-page addresses into specified range ($${hex2(first_zp)}-$${hex2(last_zp)}).`
          );
        }
      }
    }
  }

  /* --- draw a map --- */

  if (R.verbose >= 1) {
    reloc_map(oldcore, reloc_offset);
    zeropage_map();
  }

  /* --- perform the relocation --- */

  const newdata = new Uint8Array(65536);
  newdata.set(data);
  for (let i = 0; i < R.progsize; i++) {
    const pb = i + 2;
    const flags = R.pbFlags[pb];
    if (flags & PBF_USED_FOR_SIDBRK) {
      putOut(`----DOM:BRK:${hx4(i)}:${hex2(newdata[head.dataoffset + i])}\n`);
    } else if (flags & PBF_RELOC) {
      if (flags & PBF_USED_FOR_SID) {
        if (flags & PBF_USED_IN_MSB) {
          newdata[head.dataoffset + i] = (newdata[head.dataoffset + i] + (sid_offset >> 8)) & 0xff;
        } else {
          newdata[head.dataoffset + i] = (newdata[head.dataoffset + i] + (sid_offset & 255)) & 0xff;
        }
      } else if (flags & PBF_USED_IN_MSB) {
        newdata[head.dataoffset + i] = (newdata[head.dataoffset + i] + (reloc_offset >> 8)) & 0xff;
      } else {
        let j;
        for (j = 2; j < 256; j++) {
          if (R.pbZp[pb * 32 + ((j / 8) | 0)] & (1 << (j & 7))) break;
        }
        if (j < 256) {
          putErr(` --- ZP : ${hx4(i)} => ${hex2(zpReloc[j])}\n`);
          newdata[head.dataoffset + i] = (newdata[head.dataoffset + i] + zpReloc[j]) & 0xff;
        }
      }
    }
  }

  /* --- verify the relocated subtunes --- */

  free_arena();
  free_progbytes();
  R.addConstraints = 0;

  const counters = { badpitch: 0, badpw: 0 };
  let n_check = 0;

  for (let i = 0; i < head.nsubtune; i++) {
    putErr(`Verifying relocated subtune ${i + 1}\n`);
    init_core(oldcore, data, head.dataoffset, head.loadaddr, head.loadsize);
    init_core(newcore, newdata, head.dataoffset, (head.loadaddr + reloc_offset) & 0xffff, head.loadsize);

    init_tune(oldcore, head.initaddr, i);

    R.relocStart = (R.relocStart + reloc_offset) & 0xffff;
    R.relocEnd = (R.relocEnd + reloc_offset) & 0xffff;

    init_tune(newcore, (head.initaddr + reloc_offset) & 0xffff, i);

    n_check += 3;
    verify_sidstate(oldcore.mem, newcore.mem, -1, counters);

    for (let j = 0; j < play_calls; j++) {
      R.relocStart = (R.relocStart - reloc_offset) & 0xffff;
      R.relocEnd = (R.relocEnd - reloc_offset) & 0xffff;

      let errcode = play_step(oldcore, head.playaddr, 'Old version: ');
      if (errcode) break;

      R.relocStart = (R.relocStart + reloc_offset) & 0xffff;
      R.relocEnd = (R.relocEnd + reloc_offset) & 0xffff;

      errcode = play_step(
        newcore,
        head.playaddr ? (head.playaddr + reloc_offset) & 0xffff : 0,
        'New version: '
      );
      if (errcode) {
        if (force) {
          break;
        } else {
          errx(RET_VERIFY | exitbits, 'Verification failed');
        }
      }

      n_check += 3;
      verify_sidstate(oldcore.mem, newcore.mem, j, counters);
    }

    R.relocStart = (R.relocStart - reloc_offset) & 0xffff;
    R.relocEnd = (R.relocEnd - reloc_offset) & 0xffff;
  }

  if (!n_check) n_check = 1;
  const perc_badpitch = Math.round((counters.badpitch * 100.0) / n_check);
  const perc_badpw = Math.round((counters.badpw * 100.0) / n_check);
  putErr(`Bad pitches:               ${counters.badpitch}, ${perc_badpitch}%\n`);
  putErr(`Bad pulse widths:          ${counters.badpw}, ${perc_badpw}%\n`);
  if (counters.badpitch || counters.badpw) {
    exitbits |= RETF_TOLERANCE;
    if (!force) {
      if (counters.badpitch && (!tolerance || perc_badpitch > tolerance)) {
        errx(RET_VERIFY | exitbits, 'Relocation failed; too many mismatching pitches.\n');
      } else if (counters.badpw && strictpw) {
        errx(
          RET_VERIFY | exitbits,
          'Relocation failed; mismatching pulse widths and strict flag given.\n'
        );
      }
    }
  }
  if (counters.badpitch) {
    putErr('Relocation successful with some mismatching pitches.\n');
  } else if (counters.badpw) {
    putErr('Relocation successful with some mismatching pulse widths.\n');
  } else {
    putErr('Relocation successful.\n');
  }

  /* --- relocate all pointers in the header --- */

  if (newdata[0x08] | newdata[0x09]) {
    newdata[0x08] = (newdata[0x08] + (reloc_offset >> 8)) & 0xff;
  } else {
    newdata[head.dataoffset - 1] = (newdata[head.dataoffset - 1] + (reloc_offset >> 8)) & 0xff;
  }
  if (newdata[0x0a] | newdata[0x0b]) {
    newdata[0x0a] = (newdata[0x0a] + (reloc_offset >> 8)) & 0xff;
  }
  if (newdata[0x0c] | newdata[0x0d]) {
    newdata[0x0c] = (newdata[0x0c] + (reloc_offset >> 8)) & 0xff;
  }

  /* --- determine where replayer code could go --- */

  const page_used = new Uint8Array(256);
  if (head.version > 1) {
    for (let i = 0; i < 256; i++) {
      if (
        (i >= 0x00 && i <= 0x03) ||
        (i >= 0xa0 && i <= 0xbf) ||
        (i >= 0xd0 && i <= 0xff) ||
        (i >= ((head.loadaddr + reloc_offset) & 0xffff) >> 8 &&
          i <= ((head.loadaddr + head.loadsize - 1 + reloc_offset) & 0xffff) >> 8)
      ) {
        page_used[i] = 1;
      } else {
        for (let j = 0; j < 256; j++) {
          if (newcore.read[(i << 8) | j] || newcore.written[(i << 8) | j]) {
            page_used[i] = 1;
            break;
          }
        }
      }
    }
    let best_start = 0;
    let curr_start = 0;
    let best_n = 0;
    let curr_n = 0;
    for (let i = 0; i < 256; i++) {
      if (page_used[i]) {
        if (curr_n > best_n) {
          best_start = curr_start;
          best_n = curr_n;
        }
        curr_start = i + 1;
        curr_n = 0;
      } else {
        curr_n++;
      }
    }
    if (curr_n > best_n) {
      best_start = curr_start;
      best_n = curr_n;
    }
    if (best_n) {
      if (R.verbose >= 1) {
        putErr(`Largest unused region:     $${hex2(best_start)}00-$${hex2(best_start + best_n - 1)}ff\n`);
      }
      newdata[0x78] = best_start;
      newdata[0x79] = best_n;
    } else {
      if (R.verbose >= 1) {
        putErr('No space left for replay routine!\n');
      }
      newdata[0x78] = 0xff;
      newdata[0x79] = 0;
    }
  }

  /* --- write the relocated SID file --- */

  return newdata.subarray(0, filesize).slice();
}
