/**
 * BeebAsm module objects must match ca65 CODE0 from an optional SIDPlayer tree.
 * Set SIDPLAYER_GOLDEN=/path/to/sidplayer (with mul.o etc). Skipped if absent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeMode7RleAsm } from "../bin/build/mo72asm.js";
import { beebasmExists, resolveBeebasm } from "../bin/build/resolve-beebasm.js";
import { firstDiffLines } from "./lib/diff.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "out");
const GOLDEN_CA65 = process.env.SIDPLAYER_GOLDEN || "";
const BEEBASM = resolveBeebasm();

function mustRun(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${r.status})`);
  }
  return r;
}

function extractCa65Code0(obj, bin, needZp) {
  const stub = mkdtempSync(join(tmpdir(), "sidplayer-"));
  const cfg = join(stub, "link.cfg");
  writeFileSync(
    cfg,
    `MEMORY {
    ZP:  start = $0000, size = $0100, type = rw, define = yes;
    RAM: start = $0200, size = $7E00, file = %O;
}
SEGMENTS {
    ZEROPAGE: load = ZP,  type = zp, optional = yes;
    CODE0:    load = RAM, type = ro;
}
`,
  );
  try {
    if (needZp) {
      const zpS = join(stub, "zp.s");
      writeFileSync(
        zpS,
        `        .exportzp zTMP1, zTMP2, zTMP3
        .segment "ZEROPAGE"
zTMP1:  .res 1
zTMP2:  .res 1
zTMP3:  .res 1
`,
      );
      const zpO = join(stub, "zp.o");
      mustRun("ca65", ["-o", zpO, zpS]);
      mustRun("ld65", ["-o", bin, "-C", cfg, obj, zpO]);
    } else {
      mustRun("ld65", ["-o", bin, "-C", cfg, obj]);
    }
  } finally {
    rmSync(stub, { recursive: true, force: true });
  }
}

function assembleModule(name, srcPath) {
  const tmp = join(OUT, "obj", `${name}.asm`);
  const parts = ["ORG &0000"];
  if (name === "mul") {
    parts.push("zTMP1 = &00", "zTMP2 = &01", "zTMP3 = &02");
  }
  parts.push(".start", readFileSync(srcPath, "utf8"), ".end");
  parts.push(`SAVE "${name}.bin", start, end`);
  writeFileSync(tmp, parts.join("\n") + "\n");
  mustRun(BEEBASM, ["-i", `${name}.asm`], {
    cwd: join(OUT, "obj"),
    stdio: "ignore",
  });
  copyFileSync(join(OUT, "obj", `${name}.bin`), join(OUT, "obj", `${name}.o`));
  rmSync(join(OUT, "obj", `${name}.bin`));
}

const haveTools =
  !!GOLDEN_CA65 &&
  beebasmExists(BEEBASM) &&
  existsSync(join(GOLDEN_CA65, "mul.o")) &&
  spawnSync("ca65", ["--version"], { encoding: "utf8" }).status === 0;

test(
  "module objects match ca65 CODE0",
  {
    skip:
      !haveTools &&
      "need beebasm, ca65, and SIDPLAYER_GOLDEN=/path/to/sidplayer",
  },
  () => {
    mkdirSync(join(OUT, "obj"), { recursive: true });
    mustRun("make", ["-C", GOLDEN_CA65, "all"], { stdio: "ignore" });

    writeMode7RleAsm(
      join(SRC, "platform/bbc/resources/frame.bin"),
      join(OUT, "play_screen.asm"),
      "play_screen",
    );
    writeMode7RleAsm(
      join(SRC, "platform/bbc/resources/menu.bin"),
      join(OUT, "menu_screen.asm"),
      "menu_screen",
    );

    extractCa65Code0(
      join(GOLDEN_CA65, "mul.o"),
      join(OUT, "obj", "mul.ca65.bin"),
      true,
    );
    extractCa65Code0(
      join(GOLDEN_CA65, "play_screen.o"),
      join(OUT, "obj", "play_screen.ca65.bin"),
      false,
    );
    extractCa65Code0(
      join(GOLDEN_CA65, "menu_screen.o"),
      join(OUT, "obj", "menu_screen.ca65.bin"),
      false,
    );

    assembleModule("mul", join(SRC, "lib/mul.asm"));
    assembleModule("play_screen", join(OUT, "play_screen.asm"));
    assembleModule("menu_screen", join(OUT, "menu_screen.asm"));

    for (const m of ["mul", "play_screen", "menu_screen"]) {
      const bePath = join(OUT, "obj", `${m}.o`);
      const be = readFileSync(bePath);
      const ca = readFileSync(join(OUT, "obj", `${m}.ca65.bin`)).subarray(
        0,
        be.length,
      );
      const trim = join(OUT, "obj", `${m}.ca65.trim`);
      writeFileSync(trim, ca);
      if (!be.equals(ca)) {
        assert.fail(
          `out/obj/${m}.o differs from ca65 ${m}.o CODE0\n` +
            firstDiffLines(bePath, trim).join("\n"),
        );
      }
    }
  },
);
