#!/usr/bin/env node
/**
 * Hermit jsSID CPU telemetry for BeebDis.
 *
 *   node probe.mjs --sid path/to/tune.sid --out .tmp/<tune>/dis [--seconds 15] [--subtune 0]
 *
 * Writes trace.json, header.bin, payload.bin, player_src.bin, player_runtime.bin
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findRepoRoot } from "./repo.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

const SID_PATH = arg("--sid");
const OUT = arg("--out");
const SECONDS = Number(arg("--seconds", "15"));
const SUBTUNE = Number(arg("--subtune", "0"));

if (!SID_PATH || !OUT) {
  console.error("usage: node probe.mjs --sid <file.sid> --out <dir> [--seconds 15] [--subtune 0]");
  process.exit(1);
}

const REPO = findRepoRoot(process.cwd());
const { parsePsid } = await import(
  pathToFileURL(join(REPO, "src.create/src/lib/psid.js")).href
);
const JSSID = join(REPO, "src.app/vendor/hermit-jssid/jsSID.js");
if (!existsSync(JSSID)) {
  console.error("missing", JSSID);
  process.exit(1);
}

function loadJsSid(sidBytes) {
  const node = { connect() {}, disconnect() {}, onaudioprocess: null };
  let src = readFileSync(JSSID, "utf8");
  src = src
    .replace(
      "var memory = new Uint8Array(65536);",
      "var memory = new Uint8Array(65536); this._memory = memory;",
    )
    .replace(
      "var framecnt = 1, volume = 1.0, CPUtime = 0, pPC;",
      "var framecnt = 1, volume = 1.0, CPUtime = 0, pPC; this._framecnt = function(){ return framecnt; };",
    )
    .replace(
      "function CPU() //the CPU emulation for SID/PRG playback",
      "this._setOnCpu = function(fn){ onCpu = fn; }; var onCpu = null;\n function CPU() //the CPU emulation for SID/PRG playback",
    )
    .replace(
      "IR = memory[PC];",
      "if (onCpu) onCpu(PC, memory[PC]);\n IR = memory[PC];",
    )
    .replace("function play() {", "this._play = play;\n function play() {");

  const sandbox = {
    AudioContext: class {
      sampleRate = 44100;
      state = "running";
      destination = {};
      createScriptProcessor() {
        return node;
      }
      createJavaScriptNode() {
        return node;
      }
    },
    webkitAudioContext: undefined,
    console,
    Uint8Array,
    Math,
    parseInt,
    String,
    XMLHttpRequest: class {
      open() {}
      send() {
        const u8 = Uint8Array.from(sidBytes);
        this.response = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        this.onload();
      }
    },
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  const ctx = createContext(sandbox);
  runInContext(`${src}\n; this.jsSID = jsSID;`, ctx, { filename: "jsSID.js" });
  const player = new ctx.jsSID(4096, 0);
  if (!player._memory || !player._play || !player._setOnCpu) {
    throw new Error("jsSID inject failed");
  }
  return player;
}

function driveOnePlay(player) {
  for (let i = 0; i < 8000; i++) {
    const before = player._framecnt();
    player._play();
    if (player._framecnt() > before) return;
  }
  throw new Error("jsSID play call did not run");
}

function memEq(mem, dest, payload, off, n) {
  if (off + n > payload.length || dest + n > 65536) return false;
  for (let i = 0; i < n; i++) {
    if (mem[dest + i] !== payload[off + i]) return false;
  }
  return true;
}

function playHitsIn(playPcs, lo, hi) {
  let n = 0;
  for (const pc of playPcs) {
    if (pc >= lo && pc < hi) n += 1;
  }
  return n;
}

/**
 * PSID data remains at loadaddr after init — that is not "in-place play".
 * Workspace in a copied image diverges, so do not trust growSize alone.
 * Cluster page matches that share the same dest-src delta, then pick the
 * cluster that contains the most play PCs.
 */
function findCopy(mem, payload, loadaddr, playPcs) {
  const pages = [];
  for (let dest = 0; dest < 0x10000; dest += 0x100) {
    const slice = mem.subarray(dest, dest + 16);
    if (slice.length < 16 || slice.every((b) => b === 0)) continue;
    for (let off = 0; off + 16 <= payload.length; off++) {
      if (!memEq(mem, dest, payload, off, 16)) continue;
      pages.push({ dest, src: loadaddr + off, delta: dest - (loadaddr + off) });
      break;
    }
  }
  if (!pages.length) return null;

  const groups = new Map();
  for (const p of pages) {
    const g = groups.get(p.delta) ?? [];
    g.push(p);
    groups.set(p.delta, g);
  }

  const clusters = [];
  for (const [, g] of groups) {
    g.sort((a, b) => a.dest - b.dest);
    const dest = g[0].dest;
    const src = g[0].src;
    const last = g[g.length - 1].dest + 0x100;
    const size = Math.min(last - dest, payload.length - (src - loadaddr), 0x10000 - dest);
    const hits = playHitsIn(playPcs, dest, dest + size);
    const inPlace = dest === loadaddr && src === loadaddr;
    clusters.push({
      src,
      dest,
      size,
      hits,
      match: inPlace ? "in-place" : "ram",
    });
  }

  if (playPcs.length) {
    clusters.sort((a, b) => {
      const aP = a.match === "in-place" ? 0 : 1;
      const bP = b.match === "in-place" ? 0 : 1;
      return b.hits - a.hits || bP - aP || b.size - a.size;
    });
    return clusters[0];
  }
  clusters.sort((a, b) => {
    const aP = a.match === "in-place" ? 0 : 1;
    const bP = b.match === "in-place" ? 0 : 1;
    return bP - aP || b.size - a.size;
  });
  return clusters[0];
}

const sidBytes = readFileSync(resolve(SID_PATH));
const psid = parsePsid(sidBytes);
const { loadaddr, initaddr, playaddr, payload, header, loadInData } = psid;

const execBits = new Uint8Array((payload.length + 7) >> 3);
const jsr = new Map();
const jmp = new Map();
const playPcs = [];
let cpuSteps = 0;
let copy = null;
let afterInit = false;

function markFile(addr) {
  const off = addr - loadaddr;
  if (off < 0 || off >= payload.length) return;
  execBits[off >> 3] |= 1 << (off & 7);
}

function fileAddr(pc) {
  if (pc >= loadaddr && pc < loadaddr + payload.length) return pc;
  if (copy && pc >= copy.dest && pc < copy.dest + copy.size) {
    return copy.src + (pc - copy.dest);
  }
  return null;
}

const player = loadJsSid(sidBytes);
const mem = player._memory;

player._setOnCpu((pc, ir) => {
  cpuSteps += 1;
  if (afterInit) playPcs.push(pc);
  const mapped = fileAddr(pc);
  if (mapped != null) markFile(mapped);
  if (ir === 0x20 || ir === 0x4c) {
    const target = mem[pc + 1] | (mem[pc + 2] << 8);
    const bag = ir === 0x20 ? jsr : jmp;
    bag.set(target, (bag.get(target) ?? 0) + 1);
  } else if (ir === 0x6c) {
    const ind = mem[pc + 1] | (mem[pc + 2] << 8);
    const target = mem[ind] | (mem[ind + 1] << 8);
    jmp.set(target, (jmp.get(target) ?? 0) + 1);
  }
});

player.loadinit("probe.sid", SUBTUNE);
afterInit = true;
copy = findCopy(mem, payload, loadaddr, []);

for (let f = 0; f < SECONDS * 50; f++) driveOnePlay(player);

copy = findCopy(mem, payload, loadaddr, playPcs) ?? copy;

let execBytes = 0;
for (let i = 0; i < payload.length; i++) {
  if (execBits[i >> 3] & (1 << (i & 7))) execBytes += 1;
}

const outDir = resolve(OUT);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "payload.bin"), payload);
writeFileSync(join(outDir, "header.bin"), header);

const srcOff = copy ? copy.src - loadaddr : 0;
const size = copy ? copy.size : payload.length;
writeFileSync(join(outDir, "player_src.bin"), payload.subarray(srcOff, srcOff + size));
if (copy) {
  writeFileSync(
    join(outDir, "player_runtime.bin"),
    Buffer.from(mem.subarray(copy.dest, copy.dest + copy.size)),
  );
}

const knownEx = join(HERE, "known.symbols.example");
const knownOut = join(outDir, "known.symbols");
if (!existsSync(knownOut) && existsSync(knownEx)) {
  writeFileSync(knownOut, readFileSync(knownEx));
}
const sidSym = join(HERE, "sid.symbols");
const sidOut = join(outDir, "sid.symbols");
if (!existsSync(sidOut) && existsSync(sidSym)) {
  writeFileSync(sidOut, readFileSync(sidSym));
}

const toHits = (map) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([addr, count]) => ({ addr, count }));

const trace = {
  sidPath: resolve(SID_PATH),
  seconds: SECONDS,
  subtune: SUBTUNE,
  loadaddr,
  initaddr,
  playaddr,
  loadInData,
  payloadLen: payload.length,
  copy,
  cpuSteps,
  execBytes,
  jsr: toHits(jsr),
  jmp: toHits(jmp),
  execBitsB64: Buffer.from(execBits).toString("base64"),
};

writeFileSync(join(outDir, "trace.json"), JSON.stringify(trace, null, 2));
console.log(
  `probe ${SECONDS}s subtune=${SUBTUNE} load=$${loadaddr.toString(16)} init=$${initaddr.toString(16)} play=$${playaddr.toString(16)}`,
);
console.log(
  copy
    ? `copy $${copy.src.toString(16)} → $${copy.dest.toString(16)} size=$${copy.size.toString(16)} (${copy.match})`
    : "copy none — check RAM / play PCs",
);
console.log(
  `exec ${execBytes}/${payload.length} file bytes  jsr ${jsr.size}  jmp ${jmp.size}  steps ${cpuSteps}`,
);
console.log(`wrote ${join(outDir, "trace.json")}`);
