#!/usr/bin/env node
/**
 * Assemble SIDPLAY / SIDPELK with BeebAsm → out/.
 * Golden compares live in test/ (npm test).
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeMode7RleAsm } from "./mo72asm.js";
import {
  beebasmExists,
  beebasmHint,
  resolveBeebasm,
} from "./resolve-beebasm.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const SRC = join(ROOT, "src");
const BBC = join(SRC, "platform/bbc");
const ELK = join(SRC, "platform/elk");
const OUT = join(ROOT, "out");
const BEEBASM = resolveBeebasm();

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    ...opts,
  });
}

if (!beebasmExists(BEEBASM)) {
  console.error(beebasmHint(BEEBASM));
  process.exit(1);
}

mkdirSync(join(OUT, "obj"), { recursive: true });

// Mode 7 dumps are source of truth; RLE asm is generated into out/
writeMode7RleAsm(
  join(BBC, "resources/frame.bin"),
  join(OUT, "play_screen.asm"),
  "play_screen",
);
writeMode7RleAsm(
  join(BBC, "resources/menu.bin"),
  join(OUT, "menu_screen.asm"),
  "menu_screen",
);
console.log("Generated out/play_screen.asm out/menu_screen.asm from Mode 7 .bin");

const targets = [
  { name: "sidpl", dir: BBC, asm: "player.asm" },
  { name: "sidpelk", dir: ELK, asm: "player.asm" },
];

for (const { name, dir } of targets) {
  try {
    rmSync(join(OUT, `${name}.o`));
  } catch {
    /* missing ok */
  }
  try {
    rmSync(join(dir, `${name}.o`));
  } catch {
    /* missing ok */
  }
}

for (const { name, dir, asm } of targets) {
  const lst = join(OUT, `${name}.lst`);
  const r = run(BEEBASM, ["-i", asm, "-v"], {
    cwd: dir,
    encoding: "utf8",
  });
  writeFileSync(lst, (r.stdout || "") + (r.stderr || ""));
  if (r.status !== 0) {
    console.error(`beebasm ${asm} failed:`);
    console.error(
      readFileSync(lst, "utf8").split("\n").slice(-40).join("\n"),
    );
    process.exit(1);
  }
  const built = join(dir, `${name}.o`);
  if (!existsSync(built)) {
    console.error(`${name}.o not produced; see out/${name}.lst`);
    process.exit(1);
  }
  copyFileSync(built, join(OUT, `${name}.o`));
  rmSync(built);
}

console.log("Built:");
for (const f of ["sidpl.o", "sidpelk.o"]) {
  const p = join(OUT, f);
  console.log(`  ${readFileSync(p).length}\t${p}`);
}
