#!/usr/bin/env node
/**
 * Dump player workspace at play N on Hermit ($9000) and the listing SSD ($4000).
 *
 *   node bin/dump-play.mjs [--play 963]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContext, runInContext } from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const TUNE = join(HERE, "..");
const GA = join(TUNE, "../goldenaxe");
const REPO = join(TUNE, "../..");
const PLAY_N = Number(process.argv.includes("--play")
  ? process.argv[process.argv.indexOf("--play") + 1]
  : "963");

function loadHermit(sidBytes) {
  const JSSID = join(REPO, "src.app/vendor/hermit-jssid/jsSID.js");
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
      [
        "this._setOnPlayStart = function(fn){ onPlayStart = fn; };",
        "var onPlayStart = null;",
        "function CPU() //the CPU emulation for SID/PRG playback",
      ].join("\n "),
    )
    .replace(
      "framecnt = frame_sampleperiod;\n finished = 0;\n PC = playaddr;",
      "framecnt = frame_sampleperiod;\n if (onPlayStart) onPlayStart();\n finished = 0;\n PC = playaddr;",
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
  return new ctx.jsSID(4096, 0);
}

function snap(mem, base, zp) {
  return {
    base,
    zp: Array.from(zp),
    img: Buffer.from(mem),
  };
}

function fields(img) {
  const at = (a) => img[a - 0x9000];
  const w = (a) => at(a) | (at(a + 1) << 8);
  return {
    L9066: at(0x9066),
    L9067: at(0x9067),
    L90CD: at(0x90cd),
    L90D9: [at(0x90d9), at(0x90da), at(0x90db)],
    L90DC: [at(0x90dc), at(0x90dd), at(0x90de)],
    L90F4: [at(0x90f4), at(0x90f5), at(0x90f6)],
    L9069: [at(0x9069), at(0x906a), at(0x906b)],
    L906C: [at(0x906c), at(0x906d), at(0x906e)],
    L9170: w(0x9171),
    L90EE: [at(0x90ee), at(0x90ef), at(0x90f0)],
    L90E5: [at(0x90e5), at(0x90e6), at(0x90e7)],
  };
}

function hex(n, w = 2) {
  return n.toString(16).padStart(w, "0");
}

const sid = readFileSync(join(GA, "original/Golden_Axe.sid"));
const player = loadHermit(sid);
let playI = -1;
let c64 = null;
player._setOnPlayStart(() => {
  playI += 1;
  if (playI === PLAY_N) {
    c64 = snap(player._memory.subarray(0x9000, 0xa000), 0x9000, player._memory.subarray(0x1f, 0x22));
  }
});
player.loadinit("sid", 0);
const max = PLAY_N * 2000 + 8000;
for (let i = 0; i < max && !c64; i++) player._play();
if (!c64) throw new Error("C64 did not reach play " + PLAY_N);

const { MachineSession } = createRequire(join(REPO, "src.create/package.json"))("jsbeeb/machine-session");
const { bootToMenu } = await import(pathToFileURL(join(REPO, "src.create/src/preview/beebMenu.js")).href);
const { pressReturn, BEEBSID_BASE } = await import(
  pathToFileURL(join(REPO, "src.create/src/preview/node/index.js")).href
);
const { BBC_CPU_HZ } = await import(pathToFileURL(join(REPO, "src.create/src/preview/fastsid.js")).href);
const ssd = join(TUNE, "out/goldenaxe.ssd");
if (!existsSync(ssd)) throw new Error("missing " + ssd);

const session = new MachineSession("B1770", { discImage: ssd });
await session.initialise();
await session.boot(30);
await bootToMenu(session, { timeoutMs: 60_000, expectTune0: "Golden Axe" });
const cpu = session._machine.processor;
let plays = 0;
let last = -1e18;
let beeb = null;
const hook = cpu.debugWrite.add((addr) => {
  if (addr < BEEBSID_BASE || addr >= BEEBSID_BASE + 25) return false;
  const now = cpu.cycleSeconds * BBC_CPU_HZ + cpu.currentCycles;
  if (now - last > 16000 && plays >= 0) {
    if (plays === PLAY_N + 1) {
      beeb = snap(session.readMemory(0x4000, 0x1000), 0x4000, session.readMemory(0x001f, 3));
    }
    plays += 1;
  }
  last = now;
  return false;
});
await pressReturn(session);
for (let i = 0; i < PLAY_N + 40 && !beeb; i++) {
  await session.runFor(BBC_CPU_HZ / 50);
}
hook.remove();
session.destroy();
if (!beeb) throw new Error(`Beeb did not reach play ${PLAY_N} (saw ${plays})`);

const fa = fields(c64.img);
const fb = fields(beeb.img);
console.log(`play ${PLAY_N}`);
console.log("c64 zp20", [...c64.zp].map((b) => hex(b)).join(" "), "beeb", [...beeb.zp].map((b) => hex(b)).join(" "));
console.log("c64", fa);
console.log("beeb", fb);

const diffs = [];
for (let i = 0; i < 0x1000; i++) {
  if (c64.img[i] === beeb.img[i]) continue;
  diffs.push({
    off: i,
    c64a: 0x9000 + i,
    beeba: 0x4000 + i,
    c64: c64.img[i],
    beeb: beeb.img[i],
  });
}
console.log(`4K diffs ${diffs.length}`);
for (const d of diffs.slice(0, 40)) {
  console.log(
    `  $${hex(d.c64a, 4)}/$${hex(d.beeba, 4)}  c64 ${hex(d.c64)}  beeb ${hex(d.beeb)}`,
  );
}

writeFileSync(join(TUNE, "out/dump-c64.bin"), c64.img);
writeFileSync(join(TUNE, "out/dump-beeb.bin"), beeb.img);
