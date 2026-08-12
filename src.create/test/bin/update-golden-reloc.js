#!/usr/bin/env node
/**
 * Rebuild reloc goldens (*.rel.sid, *.brk, *.reloc.exit) from JS sidreloc.
 *
 *   npm run update:golden-reloc
 *
 * Uses DEFAULT_RELOC_OPTS (no pre-patch). RoboCop without pre-patch is expected
 * to fail — we commit exit code only for that case.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { relocateSid } from "../../src/lib/sidreloc/index.js";
import { DEFAULT_RELOC_OPTS } from "../../src/stages/relocate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "../golden");

function brkLines(text) {
  return (text || "")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("----DOM:BRK:"))
    .join("\n");
}

function sidStems() {
  return readdirSync(GOLDEN)
    .filter(
      (n) =>
        n.endsWith(".sid") &&
        !n.endsWith(".rel.sid") &&
        !n.endsWith(".patched.sid"),
    )
    .map((n) => basename(n, ".sid"))
    .sort();
}

if (!existsSync(GOLDEN)) {
  console.error(`missing ${GOLDEN}`);
  process.exit(1);
}

for (const stem of sidStems()) {
  const sidPath = join(GOLDEN, `${stem}.sid`);
  const r = relocateSid(readFileSync(sidPath), DEFAULT_RELOC_OPTS);
  const ok = (r.exitCode & ~0x60) === 0 && r.relSid;

  writeFileSync(join(GOLDEN, `${stem}.reloc.exit`), `${r.exitCode}\n`);

  const brkPath = join(GOLDEN, `${stem}.brk`);
  const relPath = join(GOLDEN, `${stem}.rel.sid`);

  if (ok) {
    writeFileSync(relPath, Buffer.from(r.relSid));
    const brk = brkLines(r.brkText);
    writeFileSync(brkPath, brk ? brk + "\n" : "");
    console.log(
      `OK  ${stem}: exit=${r.exitCode} rel=${r.relSid.length}B brk=${brk.split("\n").filter(Boolean).length}`,
    );
  } else {
    if (existsSync(relPath)) unlinkSync(relPath);
    // Keep a stub .brk absent on failure (rip goldens use patched+brk for success cases)
    if (existsSync(brkPath) && stem === "RoboCop") unlinkSync(brkPath);
    console.log(`FAIL ${stem}: exit=${r.exitCode} (no .rel.sid — expected for unpatched RSID)`);
  }
}
