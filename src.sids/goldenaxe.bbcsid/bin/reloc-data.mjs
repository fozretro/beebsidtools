#!/usr/bin/env node
/**
 * Rewrite only known pointer high bytes ($9x → $4x). No word scan —
 * that treated L996B pitch values ($95,$9B) as $9B95 and smashed $9B→$4B.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: reloc-data.mjs <player.bin>");
  process.exit(1);
}

const w = Buffer.from(readFileSync(path));
if (w.length !== 0x1000) throw new Error(`need 4K, got ${w.length}`);

const his = new Set();

function addHi(addr) {
  his.add(addr - 0x9000);
}

// L9907 is LO of the first word; HIs are the odd bytes through L9942.
for (let a = 0x9908; a <= 0x9942; a += 2) addHi(a);
// L9943/L9944: B7 9B / BE 9B / C2 9B
for (const a of [0x9944, 0x9946, 0x9948]) addHi(a);
// L994B: $42,$9C $61,$9C $7F,$9C (other-song LDA abs)
for (const a of [0x994d, 0x994f, 0x9951]) addHi(a);
// L995B, L9966, L998B, L99AF[0..3]
for (let a = 0x995b; a < 0x9961; a++) addHi(a);
for (let a = 0x9966; a < 0x996b; a++) addHi(a);
for (let a = 0x998b; a < 0x99ab; a++) addHi(a);
for (let a = 0x99af; a < 0x99b3; a++) addHi(a);

let n = 0;
for (const off of his) {
  const b = w[off];
  if (b < 0x90 || b > 0x9f) {
    throw new Error(`$${ (0x9000 + off).toString(16) } is $${b.toString(16)}, not a $9x page`);
  }
  w[off] = (b - 0x50) & 0xff;
  n++;
}

writeFileSync(path, w);
console.log(`reloc-data: ${n} pointer pages $9x→$4x (no word scan)`);
