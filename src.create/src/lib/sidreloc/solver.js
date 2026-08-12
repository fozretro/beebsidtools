/* JavaScript port of sidreloc 1.0 solver.c (DOM/BRK variant).
 *
 * Original C source: Copyright (c) 2012 Linus Akesson, MIT licence.
 */

import {
  R,
  PBF_DONT_RELOC,
  PBF_RELOC,
  PBF_USED_IN_ZP,
  PBF_USED_IN_MSB,
  PBF_USED_FOR_SID,
  PBF_USED_FOR_SIDBRK,
  RET_CONSTR,
  ExitError,
  cons_src,
  dont_reloc,
  dont_reloc_at,
  putErr,
  hex4,
} from './reloc.js';

const HASHSIZE = 8192;

const C_EXACTLY_ONE = 1;
const C_ALIKE = 2;

/* A constraint list is stored as a JS array in insertion order. The C code
 * prepends to a singly linked list, so every traversal here walks the array
 * backwards to visit the most recently added constraint first. */
let hashconstr = null; // Array(HASHSIZE) of Array(constraint)
let zpconstr = null; // Array(0x100)   of Array(constraint)

export function resetSolver() {
  hashconstr = new Array(HASHSIZE);
  for (let i = 0; i < HASHSIZE; i++) hashconstr[i] = null;
  zpconstr = new Array(0x100);
  for (let i = 0; i < 0x100; i++) zpconstr[i] = null;
}

function makeConstraint(kind, n1, n2) {
  return { check_needed: 1, kind, n1, n2, vars: new Array(n1 + n2) };
}

function sortRange(vars, from, count) {
  if (count > 1) {
    const part = vars.slice(from, from + count).sort((a, b) => a - b);
    for (let i = 0; i < count; i++) vars[from + i] = part[i];
  }
}

function print_constraint(constr) {
  const org = R.progbyteOrg;
  let s;
  if (constr.kind === C_EXACTLY_ONE) {
    s = 'Exactly one reloc: {';
    for (let i = 0; i < constr.n1; i++) {
      s += `${i ? ', ' : ''}$${hex4(constr.vars[i] + org)}`;
    }
    s += '}\n';
  } else if (constr.kind === C_ALIKE) {
    s = 'Reloc alike: {';
    for (let i = 0; i < constr.n1; i++) {
      s += `${i ? ', ' : ''}$${hex4(constr.vars[i] + org)}`;
    }
    s += '}, {';
    for (let i = 0; i < constr.n2; i++) {
      s += `${i ? ', ' : ''}$${hex4(constr.vars[constr.n1 + i] + org)}`;
    }
    s += '}\n';
  } else {
    s = 'Unknown constraint!\n';
  }
  putErr(s);
}

function add_constraint_ref(offset, c) {
  let list = R.pbConstr[offset];
  if (!list) {
    list = [];
    R.pbConstr[offset] = list;
  }
  list.push(c);
}

function constrainthash(c) {
  let h = 0;
  const n = c.n1 + c.n2;
  for (let i = 0; i < n; i++) {
    h += c.vars[i];
    h %= HASHSIZE;
  }
  return h;
}

function sameConstraint(a, b) {
  if (a.kind !== b.kind || a.n1 !== b.n1 || a.n2 !== b.n2) return false;
  if (a.check_needed !== b.check_needed) return false;
  const n = a.n1 + a.n2;
  for (let i = 0; i < n; i++) if (a.vars[i] !== b.vars[i]) return false;
  return true;
}

/* bucket === null selects the global hash table (a "for real" addition). */
function add_or_free_constraint(bucket, constr) {
  let for_real = 0;

  sortRange(constr.vars, 0, constr.n1);
  sortRange(constr.vars, constr.n1, constr.n2);

  if (!bucket) {
    const h = constrainthash(constr);
    if (!hashconstr[h]) hashconstr[h] = [];
    bucket = hashconstr[h];
    for_real = 1;
  }

  for (let i = bucket.length - 1; i >= 0; i--) {
    const other = bucket[i];
    if (other.kind === constr.kind && other.n1 === constr.n1 && other.n2 === constr.n2) {
      if (sameConstraint(other, constr)) return;
    }
  }

  if (for_real && R.verbose >= 2) {
    putErr('Adding constraint: ');
    print_constraint(constr);
  }

  bucket.push(constr);
}

function zpBucket(zpaddr) {
  if (!zpconstr[zpaddr]) zpconstr[zpaddr] = [];
  return zpconstr[zpaddr];
}

export function finalise_constraints(core) {
  for (let zp = 0; zp < 0x100; zp++) {
    const bucket = zpconstr[zp];
    if (!bucket) continue;
    if (core.written[zp]) {
      for (let i = bucket.length - 1; i >= 0; i--) {
        add_or_free_constraint(null, bucket[i]);
      }
    }
    zpconstr[zp] = null;
  }

  for (let h = 0; h < HASHSIZE; h++) {
    const bucket = hashconstr[h];
    if (!bucket) continue;
    for (let k = bucket.length - 1; k >= 0; k--) {
      const constr = bucket[k];
      const n = constr.n1 + constr.n2;
      for (let i = 0; i < n; i++) {
        add_constraint_ref(constr.vars[i], constr);
      }
    }
  }
}

function markCheckNeeded(offset) {
  const list = R.pbConstr[offset];
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i--) list[i].check_needed = 1;
}

function enforce_dont(offset) {
  const flags = R.pbFlags;
  if (flags[offset] & PBF_RELOC) {
    return 1;
  } else if (!(flags[offset] & PBF_DONT_RELOC)) {
    flags[offset] |= PBF_DONT_RELOC;
    markCheckNeeded(offset);
  }
  return 0;
}

function enforce_do(offset) {
  const flags = R.pbFlags;
  if (flags[offset] & PBF_DONT_RELOC) {
    return 1;
  } else if (!(flags[offset] & PBF_RELOC)) {
    flags[offset] |= PBF_RELOC;
    markCheckNeeded(offset);
  }
  return 0;
}

function propagate(c) {
  const flags = R.pbFlags;
  c.check_needed = 0;

  if (c.kind === C_EXACTLY_ONE) {
    let n_do = 0,
      n_dont = 0,
      n_unknown = 0;
    let last_do = 0,
      last_unknown = 0;

    for (let i = 0; i < c.n1; i++) {
      const f = flags[c.vars[i]];
      if (f & PBF_RELOC) {
        n_do++;
        last_do = i;
      } else if (f & PBF_DONT_RELOC) {
        n_dont++;
      } else {
        n_unknown++;
        last_unknown = i;
      }
    }

    if (n_do === 1) {
      for (let i = 0; i < c.n1; i++) {
        if (i !== last_do) {
          if (enforce_dont(c.vars[i])) return 1;
        }
      }
      return 0;
    } else if (n_do > 1) {
      return 1;
    } else {
      // n_do == 0, exactly one of the unknown vars must be reloced
      if (n_unknown === 0) {
        return 1;
      } else if (n_unknown === 1) {
        return enforce_do(c.vars[last_unknown]);
      } else {
        // We cannot propagate; leave the rest to search.
        return 0;
      }
    }
  } else if (c.kind === C_ALIKE) {
    let n1_do = 0,
      n2_do = 0;

    for (let i = 0; i < c.n1; i++) {
      if (flags[c.vars[i]] & PBF_RELOC) n1_do++;
    }

    /* Note: the original indexes vars[i] rather than vars[n1 + i] here. The
     * behaviour is reproduced verbatim so that results stay identical. */
    for (let i = 0; i < c.n2; i++) {
      if (flags[c.vars[i]] & PBF_RELOC) n2_do++;
    }

    if (n1_do > 1 || n2_do > 1) return 1;
    return n1_do !== n2_do ? 1 : 0;
  } else {
    return 1;
  }
}

export function trivially_inconsistent() {
  const flags = R.pbFlags;

  for (let i = 0; i < R.progsize + 2; i++) {
    if ((flags[i] & (PBF_USED_IN_ZP | PBF_USED_IN_MSB)) === (PBF_USED_IN_ZP | PBF_USED_IN_MSB)) {
      // If a byte contributes to both a zero-page address and an msb, it cannot
      // be relocatable.
      flags[i] |= PBF_DONT_RELOC;
    }

    if ((flags[i] & (PBF_RELOC | PBF_DONT_RELOC)) === (PBF_RELOC | PBF_DONT_RELOC)) {
      putErr(
        `Inconsistency detected! Byte at $${hex4(i + R.progbyteOrg)} can't be both relocated and not relocated at the same time.\n`
      );
      return 1;
    }
  }

  return 0;
}

export function solver() {
  const flags = R.pbFlags;
  let done;
  let pboffs = -1;

  /* Propagate. */

  do {
    done = 1;
    for (let h = 0; h < HASHSIZE; h++) {
      const bucket = hashconstr[h];
      if (!bucket) continue;
      for (let i = bucket.length - 1; i >= 0; i--) {
        const c = bucket[i];
        if (c.check_needed) {
          done = 0;
          if (propagate(c)) return 1;
        }
      }
    }
  } while (!done);

  /* Search -- select a variable */

  outer: for (let h = 0; h < HASHSIZE; h++) {
    const bucket = hashconstr[h];
    if (!bucket) continue;
    for (let k = bucket.length - 1; k >= 0; k--) {
      const c = bucket[k];
      const n = c.n1 + c.n2;
      for (let i = 0; i < n; i++) {
        if (!(flags[c.vars[i]] & (PBF_RELOC | PBF_DONT_RELOC))) {
          pboffs = c.vars[i];
          break outer;
        }
      }
    }
  }

  if (pboffs >= 0) {
    /* Search -- select a value */

    const btsize = R.progsize + 2;
    const backtrack = flags.slice(0, btsize);

    if (R.verbose >= 2) {
      putErr(`Guessing that $${hex4(pboffs + R.progbyteOrg)} should not be relocated.\n`);
    }

    if (enforce_dont(pboffs) || solver()) {
      if (R.verbose >= 2) putErr('Backtracking.\n');
      flags.set(backtrack, 0);
      if (R.verbose >= 2) {
        putErr(`Assuming that $${hex4(pboffs + R.progbyteOrg)} should be relocated.\n`);
      }
      return enforce_do(pboffs) || solver();
    } else {
      return 0;
    }
  } else return 0;
}

/* Fast routines that are called during analysis (emulation). Contradictions are not
 * checked at this stage. */

function do_reloc_at(offset) {
  R.pbFlags[offset] |= PBF_RELOC;
}

function progbyte_for_zp(offset, zpaddr) {
  R.pbFlags[offset] |= PBF_USED_IN_ZP;
  R.pbZp[offset * 32 + (zpaddr >> 3)] |= 1 << (zpaddr & 7);
}

function progbyte_for_msb(offset) {
  R.pbFlags[offset] |= PBF_USED_IN_MSB;
}

function progbyte_for_sid(offset) {
  R.pbFlags[offset] |= PBF_USED_FOR_SID;
}

function progbyte_for_sidbrk(offset) {
  R.pbFlags[offset] |= PBF_USED_FOR_SIDBRK;
}

function reloc_exactly_one(src, zpaddr) {
  const flags = R.pbFlags;
  let n_unknown = 0,
    n_dont = 0,
    n_do = 0;
  let last_do = 0,
    last_unknown = 0;

  for (let s = src; s; s = s.next) {
    for (let s2 = s.next; s2; s2 = s2.next) {
      if (s.offset === s2.offset) {
        // The same progbyte contributes more than once. It cannot be relocated.
        if (R.verbose >= 2) {
          putErr(
            `Byte at $${hex4(s.offset + R.progbyteOrg)} contributes more than once to a sum and won't be relocated.\n`
          );
        }
        dont_reloc_at(s.offset);
      }
    }
  }

  for (let s = src; s; s = s.next) {
    if (flags[s.offset] & PBF_DONT_RELOC) {
      n_dont++;
    } else if (flags[s.offset] & PBF_RELOC) {
      n_do++;
      last_do = s.offset;
    } else {
      n_unknown++;
      last_unknown = s.offset;
    }
  }

  if (zpaddr) {
    const constr = makeConstraint(C_EXACTLY_ONE, n_do + n_unknown, 0);
    let pos = 0;
    for (let s = src; s; s = s.next) {
      if (!(flags[s.offset] & PBF_DONT_RELOC)) constr.vars[pos++] = s.offset;
    }
    add_or_free_constraint(zpBucket(zpaddr), constr);
  } else {
    if (n_do) {
      // n_do is typically 1 here.
      // If n_do > 1, this will introduce an inconsistency which we can detect later.
      for (let s = src; s; s = s.next) {
        if (s.offset !== last_do) dont_reloc_at(s.offset);
      }
    } else {
      // n_do is 0, so one of the unknown vars must be relocated.
      if (n_unknown === 1) {
        do_reloc_at(last_unknown);
      } else if (n_unknown === 0) {
        let msg = 'Inconsistency: Want to relocate one of {';
        for (let s = src; s; s = s.next) {
          msg += `$${hex4(s.offset + R.progbyteOrg)}${s.next ? ', ' : ''}`;
        }
        msg += '} but this would contradict other equations.\n';
        putErr(msg);
        throw new ExitError(RET_CONSTR);
      } else {
        const constr = makeConstraint(C_EXACTLY_ONE, n_unknown, 0);
        let pos = 0;
        for (let s = src; s; s = s.next) {
          if (!(flags[s.offset] & (PBF_RELOC | PBF_DONT_RELOC))) constr.vars[pos++] = s.offset;
        }
        add_or_free_constraint(null, constr);
      }
    }
  }
}

export function reloc_alike(v1value, v1src, v2value, v2src) {
  if (!R.addConstraints) return;

  const lo = R.relocStart >> 8;
  const hi = R.relocEnd >> 8;
  if (v1value >= lo && v1value <= hi && v2value >= lo && v2value <= hi) {
    let n1 = 0,
      n2 = 0;
    for (let s = v1src; s; s = s.next) n1++;
    for (let s = v2src; s; s = s.next) n2++;

    const constr = makeConstraint(C_ALIKE, n1, n2);
    let pos = 0;
    for (let s = v1src; s; s = s.next) constr.vars[pos++] = s.offset;
    for (let s = v2src; s; s = s.next) constr.vars[pos++] = s.offset;

    add_or_free_constraint(null, constr);
  }
}

export function used_for_zp_addr(src1, src2, zpaddr) {
  if (!R.addConstraints) return;

  zpaddr &= 0xff;
  for (let s = src1; s; s = s.next) progbyte_for_zp(s.offset, zpaddr);
  for (let s = src2; s; s = s.next) progbyte_for_zp(s.offset, zpaddr);

  if (R.doZpReloc) {
    let list = src1;
    for (let s = src2; s; s = s.next) list = cons_src(s.offset, list);
    reloc_exactly_one(list, zpaddr);
  }
}

function used_for_sid(lsb1, lsb2, msb) {
  if (!R.addConstraints) return;
  for (let s = lsb1; s; s = s.next) progbyte_for_sid(s.offset);
  for (let s = lsb2; s; s = s.next) progbyte_for_sid(s.offset);
  for (let s = msb; s; s = s.next) progbyte_for_sid(s.offset);
}

export function check_reloc_range(inst, addr, lsb1, lsb2, msb) {
  if (!R.addConstraints) return;

  for (let s = msb; s; s = s.next) progbyte_for_msb(s.offset);

  if (addr >= R.relocStart && addr <= R.relocEnd) {
    dont_reloc(lsb1);
    if (lsb2) dont_reloc(lsb2);
    reloc_exactly_one(msb, 0);
  } else if (addr >= R.sidSource && addr <= R.sidSource + 0x1f) {
    if (R.sidSource !== R.sidDest) {
      used_for_sid(lsb1, lsb2, msb);
      reloc_exactly_one(lsb1, 0);
      if (lsb2) dont_reloc(lsb2);
      reloc_exactly_one(msb, 0);
      if (inst) progbyte_for_sidbrk(inst.offset);
    }
  } else if (addr < 0x100) {
    dont_reloc(msb);
    used_for_zp_addr(lsb1, lsb2, addr);
  } else {
    dont_reloc(msb);
    dont_reloc(lsb1);
    if (lsb2) dont_reloc(lsb2);
  }
}

export function init_progbytes(loadaddr, loadsize) {
  R.progbyteOrg = (loadaddr - 2) & 0xffff;
  R.progsize = loadsize;
  const n = R.progsize + 2;
  R.pbFlags = new Uint8Array(n);
  R.pbZp = new Uint8Array(n * 32);
  R.pbConstr = new Array(n).fill(null);
  R.pbFlags[0] = PBF_DONT_RELOC;
  R.pbFlags[1] = PBF_RELOC | PBF_USED_IN_MSB;
}

export function free_progbytes() {
  R.pbFlags = null;
  R.pbZp = null;
  R.pbConstr = null;
}

export function reloc_map(oldcore, reloc_offs) {
  const flags = R.pbFlags;
  let n_reloc = 0,
    n_zp = 0,
    n_dont = 0,
    n_unused = 0,
    n_unknown = 0;
  let n_relocsid = 0,
    n_relocsidl = 0;

  let s = 'Program map:';
  const org = (R.progbyteOrg + 2) & 0xffff;
  for (let addr = org & 0xffc0; addr <= ((org + R.progsize - 1) | 0x003f); addr++) {
    if (!(addr & 0x3f)) {
      s += `\n${hex4(addr)}, ${hex4((addr + reloc_offs) & 0xffff)}:  `;
    }
    if (addr < org || addr >= org + R.progsize) {
      s += ' ';
    } else {
      const i = addr - R.progbyteOrg;
      if (flags[i] & PBF_RELOC) {
        if (flags[i] & PBF_USED_FOR_SID) {
          if (flags[i] & PBF_USED_IN_MSB) {
            s += 'S';
            n_relocsid++;
          } else {
            s += 's';
            n_relocsidl++;
          }
        } else if (flags[i] & PBF_USED_IN_MSB) {
          s += 'R';
          n_reloc++;
        } else if (flags[i] & PBF_USED_IN_ZP) {
          s += 'Z';
          n_zp++;
        } else {
          s += 'e'; // internal error
        }
      } else if (flags[i] & PBF_DONT_RELOC) {
        s += '=';
        n_dont++;
      } else if (!(oldcore.read[addr] | oldcore.written[addr])) {
        s += '.';
        n_unused++;
      } else {
        s += '?';
        n_unknown++;
      }
    }
  }
  s += '\n';
  s += `MSB relocations       (R): ${n_reloc}\n`;
  if (R.sidSource !== R.sidDest) {
    s += `SID MSB relocations   (S): ${n_relocsid}\n`;
    s += `SID LSB relocations   (s); ${n_relocsidl}\n`;
  }
  s += `Zero-page relocations (Z): ${n_zp}\n`;
  s += `Static bytes          (=): ${n_dont}\n`;
  s += `Status undetermined   (?): ${n_unknown}\n`;
  s += `Unused bytes          (.): ${n_unused}\n`;
  putErr(s);
}
