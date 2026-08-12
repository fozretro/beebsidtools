#!/usr/bin/env node
/**
 * Convert a Mode 7 screen dump (.bin) to a BeebAsm EQUB RLE block.
 * Port of tools/SIDPlayer/sidplayer/mo72asm.pl
 *
 *   node mo72asm.js <in.bin> <out.asm> <label>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** @param {Buffer} data @param {string} asmLabel */
export function mode7ToRleAsm(data, asmLabel) {
  const lines = [`.${asmLabel}`];

  let lastCh = -1;
  let lastChCount = 0;
  let count = 0;
  let i = 0;

  const flush = (ch, n) => {
    if (lastChCount > 1 || (lastCh >= 0 && lastCh < 32)) {
      lines.push(`        EQUB ${lastChCount}`);
      lines.push(`        EQUB ${lastCh}`);
    } else if (lastCh !== -1) {
      lines.push(`        EQUB ${lastCh}`);
    }

    if (n === 0) {
      while (count < 1000) {
        let ct = 1024 - count;
        if (ct > 31) ct = 31;
        lines.push(`        EQUB ${ct}`);
        lines.push(`        EQUB 0`);
        count += ct;
      }
    }
    lastCh = ch;
    lastChCount = 1;
  };

  while (count <= 1000) {
    const n = i < data.length ? 1 : 0;
    const ch = n ? data[i++] : 0;
    if (lastChCount >= 31 || ch !== lastCh || count === 1024 || n === 0) {
      flush(ch, n);
      if (n === 0) break;
    } else {
      lastChCount++;
    }
    count++;
  }

  return lines.join("\n") + "\n";
}

export function writeMode7RleAsm(inPath, outPath, asmLabel) {
  writeFileSync(outPath, mode7ToRleAsm(readFileSync(inPath), asmLabel));
}

function usage() {
  console.error("mo72asm <in.bin> <out.asm> <label>");
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 5) usage();
  const [, , fnIn, fnOut, asmLabel] = process.argv;
  writeMode7RleAsm(fnIn, fnOut, asmLabel);
}
