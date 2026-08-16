#!/usr/bin/env node
/**
 * Traces → BeebDis ctl → BeebAsm → byte-compare the original SID.
 *
 *   node from-traces.mjs --out .tmp/<tune>/dis [--sid path/to/tune.sid]
 *
 * Reads probe output in --out. Runtime org and image size come from trace.copy
 * (or in-place loadaddr + full payload). Do not hard-code another SID's map.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { findRepoRoot, resolveTool } from "./repo.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

const OUT = arg("--out");
const SID_ARG = arg("--sid");
if (!OUT) {
  console.error("usage: node from-traces.mjs --out <dir> [--sid <file.sid>]");
  process.exit(1);
}

const DIS = resolve(OUT);
const REPO = findRepoRoot(process.cwd());
const { rebuildPsid } = await import(
  pathToFileURL(join(REPO, "src.create/src/lib/psid.js")).href
);

const BEEBDIS = resolveTool("BEEBDIS", "BeebDis");
const BEEBASM = resolveTool("BEEBASM", "beebasm");
const BRANCH_OPS = /\b(BPL|BMI|BEQ|BNE|BCC|BCS|BVC|BVS)\b/;

/** Official 6502 sizes; 0 = illegal (stop the walk). BRK is 2 bytes. */
const OP_LEN = Uint8Array.from([
  2, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 0, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3,
  0, 0, 0, 3, 3, 0, 3, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0,
  0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3,
  3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 1, 2, 0, 0, 0, 2, 2, 0,
  1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 0, 2,
  0, 0, 2, 2, 2, 0, 1, 0, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0,
  0, 3, 0, 0, 2, 2, 2, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 2, 2,
  2, 0, 1, 3, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
  2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 2, 2, 0, 0, 2, 2, 2, 0, 1, 2,
  1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,
]);

const STOP_OPS = new Set([0x00, 0x40, 0x4c, 0x60, 0x6c]);
const BRANCH_OP = new Set([0x10, 0x30, 0x50, 0x70, 0x90, 0xb0, 0xd0, 0xf0]);

function hex4(n) {
  return "$" + (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function bitTest(bits, off) {
  return (bits[off >> 3] & (1 << (off & 7))) !== 0;
}

function loadKnownSymbols(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*\$([0-9A-Fa-f]+)/);
    if (m) map.set(parseInt(m[2], 16), m[1]);
  }
  return map;
}

const tracePath = join(DIS, "trace.json");
const playerPath = join(DIS, "player_src.bin");
if (!existsSync(tracePath) || !existsSync(playerPath)) {
  console.error("missing probe output — run probe.mjs --sid … --out", DIS);
  process.exit(1);
}

const trace = JSON.parse(readFileSync(tracePath, "utf8"));
const playerBin = readFileSync(playerPath);
const PLAYER_ORG = trace.copy?.dest ?? trace.loadaddr;
const PLAYER_SIZE = playerBin.length;
const ORIG_SID = resolve(SID_ARG || trace.sidPath);
if (!existsSync(ORIG_SID)) {
  console.error("original SID not found:", ORIG_SID);
  process.exit(1);
}

function inPlayer(addr) {
  return addr >= PLAYER_ORG && addr < PLAYER_ORG + PLAYER_SIZE;
}

function dataHoles(codeBits) {
  const raw = [];
  let i = 0;
  while (i < PLAYER_SIZE) {
    if (bitTest(codeBits, i)) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < PLAYER_SIZE && !bitTest(codeBits, i)) i += 1;
    raw.push({ addr: PLAYER_ORG + start, len: i - start });
  }
  return raw;
}

function walkPlayer(bin, seeds) {
  const codeBits = Buffer.alloc((PLAYER_SIZE + 7) >> 3);
  const insnStarts = new Set();
  const queue = [...seeds];
  const seen = new Set();
  while (queue.length) {
    const start = queue.pop();
    if (seen.has(start) || !inPlayer(start)) continue;
    seen.add(start);
    let pc = start;
    while (inPlayer(pc) && !insnStarts.has(pc)) {
      const off = pc - PLAYER_ORG;
      const ir = bin[off];
      const n = OP_LEN[ir];
      if (!n || off + n > PLAYER_SIZE) break;
      insnStarts.add(pc);
      for (let k = 0; k < n; k++) codeBits[(off + k) >> 3] |= 1 << ((off + k) & 7);
      if (BRANCH_OP.has(ir)) {
        const rel = bin[off + 1];
        const dest = (pc + 2 + (rel < 128 ? rel : rel - 256)) & 0xffff;
        if (inPlayer(dest)) queue.push(dest);
      } else if (ir === 0x20 || ir === 0x4c) {
        const dest = bin[off + 1] | (bin[off + 2] << 8);
        if (inPlayer(dest)) queue.push(dest);
      } else if (ir === 0x6c) {
        const ind = bin[off + 1] | (bin[off + 2] << 8);
        if (inPlayer(ind) && ind + 1 < PLAYER_ORG + PLAYER_SIZE) {
          const ioff = ind - PLAYER_ORG;
          const dest = bin[ioff] | (bin[ioff + 1] << 8);
          if (inPlayer(dest)) queue.push(dest);
        }
      }
      if (STOP_OPS.has(ir)) break;
      pc += n;
    }
  }
  return { codeBits, insnStarts, blocks: seen };
}

function resumeEntriesAfterHoles(insnStarts, holes, entries) {
  for (const h of holes) {
    const resume = h.addr + h.len;
    if (!insnStarts.has(resume) || entries.has(resume)) continue;
    entries.set(resume, `code_${resume.toString(16).toUpperCase().padStart(4, "0")}`);
  }
}

function writeCtl(entries, byteHoles) {
  const ctlPath = join(DIS, "player.ctl");
  const holeLines = byteHoles.map(
    (h) => `BYTE ${hex4(h.addr)} ${h.len}  ; not in 6502 walk`,
  );
  writeFileSync(
    ctlPath,
    [
      `; BeebDis control file (runtime ${hex4(PLAYER_ORG)}, ${PLAYER_SIZE} bytes)`,
      "; Generated by from-traces.mjs",
      "",
      "CPU 6502",
      "VERBOSE 1",
      "",
      `LOAD ${hex4(PLAYER_ORG)} player_src.bin`,
      "SAVE player.asm",
      "SYMBOLS sid.symbols",
      "SYMBOLS sampled.symbols",
      "",
      "; Data holes: bytes not reached by a 6502 walk from trusted ENTRYs",
      ...holeLines,
      holeLines.length ? "" : "; (no holes)",
      "",
      "; --- code entry points ---",
      ...[...entries.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([addr, name]) => `ENTRY ${hex4(addr)} ${name}`),
      "",
      "NEWSYM player.symbols",
      "",
    ].join("\n"),
  );
  return ctlPath;
}

function findMissingLabels(asm) {
  const defined = new Set(
    [
      ...asm.matchAll(/^\.([A-Za-z_][\w]*)/gm),
      ...asm.matchAll(/^([A-Za-z_][\w]*)\s*=/gm),
    ].map((m) => m[1]),
  );
  const branch = new Set();
  const absolute = new Set();
  for (const line of asm.split(/\r?\n/)) {
    for (const m of line.matchAll(/\b(L[0-9A-Fa-f]{4})\b/g)) {
      const name = m[1];
      if (defined.has(name)) continue;
      if (BRANCH_OPS.test(line)) branch.add(name);
      else absolute.add(name);
    }
  }
  return { branch: [...branch].sort(), absolute: [...absolute].sort() };
}

function labelsFromAsm(asm) {
  const found = new Map();
  const flow = /\b(BPL|BMI|BEQ|BNE|BCC|BCS|BVC|BVS|JMP|JSR)\b/;
  for (const line of asm.split(/\r?\n/)) {
    if (!flow.test(line)) continue;
    for (const m of line.matchAll(/\bL([0-9A-Fa-f]{4})\b/g)) {
      const addr = parseInt(m[1], 16);
      if (inPlayer(addr)) found.set(addr, `L${m[1].toUpperCase()}`);
    }
  }
  return found;
}

function prepareBuildAsm(asm) {
  let out = asm.replace(/\r\n/g, "\n");
  const if0 = out.indexOf("\nif(0)\n");
  if (if0 >= 0) out = out.slice(0, if0) + "\n";

  const org = `        org     ${hex4(PLAYER_ORG)}\n`;
  if (!out.includes(".BeebDisStartAddr")) {
    out = out.replace(org, `${org}.BeebDisStartAddr\n`);
  }
  out = out.replace(
    /SAVE "[^"]+",BeebDisStartAddr,BeebDisEndAddr/,
    'SAVE "player.rebuilt.bin",BeebDisStartAddr,BeebDisEndAddr',
  );

  const { absolute } = findMissingLabels(out);
  if (absolute.length) {
    const equs = absolute
      .map((name) => {
        const m = name.match(/^L([0-9A-Fa-f]{4})$/);
        return m ? `${name} = $${m[1].toUpperCase()}` : null;
      })
      .filter(Boolean);
    out = out.replace(org, `${equs.join("\n")}\n${org}`);
    console.log(`assemble prep: ${equs.length} missing abs labels → EQU`);
  }
  return out;
}

function whichOrPath(cmd) {
  if (cmd.includes("/") || cmd.startsWith(".")) return existsSync(cmd);
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 && !!(r.stdout || "").trim();
}

function runBeebDis() {
  if (!whichOrPath(BEEBDIS)) {
    console.error(`BeebDis not found (${BEEBDIS}). Set BEEBDIS=/path/to/BeebDis`);
    process.exit(1);
  }
  console.log("running BeebDis…");
  const r = spawnSync(BEEBDIS, ["player.ctl"], { cwd: DIS, encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error("BeebDis failed");
    process.exit(r.status ?? 1);
  }
  console.log(`wrote: ${join(DIS, "player.asm")}`);
}

function assemble() {
  if (!whichOrPath(BEEBASM)) {
    console.error(`beebasm not found (${BEEBASM}). Set BEEBASM=/path/to/beebasm`);
    return false;
  }
  const asm = prepareBuildAsm(readFileSync(join(DIS, "player.asm"), "utf8"));
  writeFileSync(join(DIS, "player.build.asm"), asm);
  const still = findMissingLabels(asm);
  if (still.branch.length) {
    console.error("FAIL: missing branch labels:", still.branch.join(", "));
    return false;
  }
  console.log("assembling with beebasm…");
  const r = spawnSync(BEEBASM, ["-i", "player.build.asm"], { cwd: DIS, encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error("FAIL: beebasm did not compile player.build.asm");
    return false;
  }
  if (!existsSync(join(DIS, "player.rebuilt.bin"))) {
    console.error("FAIL: player.rebuilt.bin missing");
    return false;
  }
  return true;
}

function comparePlayer() {
  const a = readFileSync(join(DIS, "player_src.bin"));
  const b = readFileSync(join(DIS, "player.rebuilt.bin"));
  if (a.length !== b.length) {
    console.error(`FAIL: player length original=${a.length} rebuilt=${b.length}`);
    return false;
  }
  let diffs = 0;
  let first = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      diffs += 1;
      if (first < 0) first = i;
    }
  }
  if (diffs === 0) {
    console.log("OK: player.rebuilt.bin matches player_src.bin");
    return true;
  }
  console.error(
    `FAIL: ${diffs} player byte(s) differ; first at +${first} (mem ${hex4(PLAYER_ORG + first)})`,
  );
  return false;
}

function rebuildSidFromPlayer(playerBinName, outSidName) {
  const header = readFileSync(join(DIS, "header.bin"));
  const payload = readFileSync(join(DIS, "payload.bin"));
  const srcOff = (trace.copy?.src ?? trace.loadaddr) - trace.loadaddr;
  const size = PLAYER_SIZE;
  writeFileSync(join(DIS, "stub.bin"), payload.subarray(0, srcOff));
  writeFileSync(join(DIS, "tail.bin"), payload.subarray(srcOff + size));
  writeFileSync(
    join(DIS, "sid.build.asm"),
    [
      `; SID payload at ${hex4(trace.loadaddr)} (stub + player + tail; empty stub/tail OK)`,
      `        org     ${hex4(trace.loadaddr)}`,
      ".Start",
      '        INCBIN  "stub.bin"',
      `        INCBIN  "${playerBinName}"`,
      '        INCBIN  "tail.bin"',
      ".End",
      '        SAVE    "payload.rebuilt.bin",Start,End',
      "",
    ].join("\n"),
  );
  console.log(`assembling SID payload glue (${playerBinName})…`);
  const r = spawnSync(BEEBASM, ["-i", "sid.build.asm"], { cwd: DIS, encoding: "utf8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error("FAIL: beebasm did not compile sid.build.asm");
    return false;
  }
  const rebuiltPayload = readFileSync(join(DIS, "payload.rebuilt.bin"));
  if (!payload.equals(rebuiltPayload)) {
    console.error(
      `FAIL: glued payload ${rebuiltPayload.length} vs original ${payload.length}`,
    );
    return false;
  }
  const sid = rebuildPsid(header, rebuiltPayload, {
    loadInData: !!trace.loadInData,
    loadaddr: trace.loadaddr,
  });
  writeFileSync(join(DIS, outSidName), sid);
  const orig = readFileSync(ORIG_SID);
  if (orig.equals(sid)) {
    console.log(`OK: ${outSidName} matches original SID (byte-identical)`);
    return true;
  }
  console.error(`FAIL: rebuilt SID ${sid.length} vs original ${orig.length}`);
  return false;
}

if (!existsSync(join(DIS, "sid.symbols"))) {
  copyFileSync(join(HERE, "sid.symbols"), join(DIS, "sid.symbols"));
}

const named = loadKnownSymbols(join(DIS, "known.symbols"));
if (playerBin[0] === 0x4c) {
  named.set(PLAYER_ORG, named.get(PLAYER_ORG) ?? "player_init");
}
if (PLAYER_SIZE > 3 && playerBin[3] === 0x4c) {
  named.set(PLAYER_ORG + 3, named.get(PLAYER_ORG + 3) ?? "player_play");
}

for (const h of trace.jsr ?? []) {
  if (inPlayer(h.addr) && !named.has(h.addr)) {
    named.set(h.addr, `jsr_${h.addr.toString(16).toUpperCase().padStart(4, "0")}`);
  }
}
for (const h of trace.jmp ?? []) {
  if (inPlayer(h.addr) && !named.has(h.addr)) {
    named.set(h.addr, `jmp_${h.addr.toString(16).toUpperCase().padStart(4, "0")}`);
  }
}

const entries = new Map();
for (const [addr, name] of named) {
  if (inPlayer(addr)) entries.set(addr, name);
}

function warnTruncatedWindow() {
  const below = [];
  const note = (addr, why) => {
    if (addr >= PLAYER_ORG - 0x100 && addr < PLAYER_ORG) {
      below.push(`${hex4(addr)} (${why})`);
    }
  };
  for (const [addr, name] of named) note(addr, name);
  for (const h of trace.jsr ?? []) note(h.addr, `jsr×${h.count}`);
  for (const h of trace.jmp ?? []) note(h.addr, `jmp×${h.count}`);
  if (!below.length) return;
  console.error(
    "WARN: flow targets sit in the page below LOAD org — the copy window is probably short.\n" +
      "      A byte-identical SID can still be a truncated listing (mid-instruction start).\n" +
      "      " +
      [...new Set(below)].join(", "),
  );
}

warnTruncatedWindow();

function writeSymbols() {
  writeFileSync(
    join(DIS, "sampled.symbols"),
    [
      `; Generated by from-traces.mjs (runtime ${hex4(PLAYER_ORG)})`,
      "; Edit known.symbols for stable names; re-run from-traces.mjs",
      "",
      ...[...named.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([addr, name]) => `${name} = ${hex4(addr)}`),
      "",
    ].join("\n"),
  );
}

let lastWalk = { insnStarts: new Set(), blocks: new Set() };

function disassemblePass() {
  lastWalk = walkPlayer(playerBin, [...entries.keys()]);
  for (const addr of lastWalk.blocks) {
    if (!entries.has(addr)) {
      const name = `code_${addr.toString(16).toUpperCase().padStart(4, "0")}`;
      entries.set(addr, name);
      named.set(addr, name);
    }
  }
  const holes = dataHoles(lastWalk.codeBits);
  resumeEntriesAfterHoles(lastWalk.insnStarts, holes, entries);
  for (const [addr, name] of entries) {
    if (!named.has(addr)) named.set(addr, name);
  }
  writeSymbols();
  const ctlPath = writeCtl(entries, holes);
  console.log(
    `player ${hex4(PLAYER_ORG)}  ${entries.size} ENTRYs  ${holes.length} BYTE hole(s)  ${lastWalk.insnStarts.size} insns`,
  );
  console.log(`wrote: ${ctlPath}`);
  runBeebDis();
}

if (!rebuildSidFromPlayer("player_src.bin", "rebuilt.sid")) process.exit(1);

for (let pass = 0; pass < 8; pass++) {
  disassemblePass();
  const asm = readFileSync(join(DIS, "player.asm"), "utf8");
  let added = 0;
  for (const [addr, name] of labelsFromAsm(asm)) {
    if (entries.has(addr) || !lastWalk.insnStarts.has(addr)) continue;
    entries.set(addr, name);
    named.set(addr, name);
    added += 1;
  }
  const missing = findMissingLabels(asm);
  for (const name of missing.branch) {
    const m = name.match(/^L([0-9A-Fa-f]{4})$/);
    if (!m) continue;
    const addr = parseInt(m[1], 16);
    if (!inPlayer(addr) || entries.has(addr) || !lastWalk.insnStarts.has(addr)) continue;
    entries.set(addr, name);
    named.set(addr, name);
    added += 1;
  }
  if (added === 0) break;
  console.log(`BeebDis pass ${pass + 1}: +${added} walked ENTRYs`);
}

if (!assemble()) process.exit(1);
if (!comparePlayer()) process.exit(1);
if (!rebuildSidFromPlayer("player.rebuilt.bin", "rebuilt.sid")) process.exit(1);
process.exit(0);
