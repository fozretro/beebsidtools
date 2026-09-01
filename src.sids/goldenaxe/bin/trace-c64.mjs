#!/usr/bin/env node
/**
 * Hermit jsSID: 50 Hz SID snapshots + every store to $D400–$D418 per play().
 *
 *   node src.sids/goldenaxe/bin/trace-c64.mjs [--seconds 8] [--subtune 0]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import {
  FRAME_HZ,
  REG_COUNT,
  arg,
  encodeWavMonoS16le,
  flag,
  floatsToS16le,
  snapshotSchema,
  writeTrace,
} from "./lib/sidtrace.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TUNE = join(HERE, "..");
const REPO = join(TUNE, "../..");
const JSSID = join(REPO, "src.app/vendor/hermit-jssid/jsSID.js");

const SID_PATH = resolve(arg("--sid", join(TUNE, "original/Golden_Axe.sid")));
const OUT_DIR = resolve(arg("--out", join(TUNE, "out")));
const SECONDS = Number(arg("--seconds", "8"));
const SUBTUNE = Number(arg("--subtune", "0"));
const WANT_WAV = !flag("--no-wav");
const SAMPLE_RATE = 44100;

if (!existsSync(SID_PATH)) {
  console.error(`missing SID ${SID_PATH}`);
  process.exit(1);
}
if (!existsSync(JSSID)) {
  console.error(`missing ${JSSID}`);
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
      [
        "this._setOnSidStore = function(fn){ onSidStore = fn; };",
        "this._setOnPlayStart = function(fn){ onPlayStart = fn; };",
        "var onSidStore = null, onPlayStart = null;",
        `function touchSid(a){ if (onSidStore && a >= 0xD400 && a < 0xD400 + ${REG_COUNT}) onSidStore(a - 0xD400, memory[a] & 0xff); }`,
        "function CPU() //the CPU emulation for SID/PRG playback",
      ].join("\n "),
    )
    .replaceAll("storadd = addr;", "storadd = addr; touchSid(addr);")
    .replaceAll("memory[addr] = T;", "memory[addr] = T; touchSid(addr);")
    .replace(
      "memory[addr]--;\n memory[addr] &= 0xFF;",
      "memory[addr]--;\n memory[addr] &= 0xFF;\n touchSid(addr);",
    )
    .replace(
      "memory[addr]++;\n memory[addr] &= 0xFF;",
      "memory[addr]++;\n memory[addr] &= 0xFF;\n touchSid(addr);",
    )
    .replace(
      "memory[storadd & 0xD41F] = memory[storadd];",
      "memory[storadd & 0xD41F] = memory[storadd]; touchSid(storadd & 0xD41F);",
    )
    .replace(
      "framecnt = frame_sampleperiod;\n finished = 0;\n PC = playaddr;",
      "framecnt = frame_sampleperiod;\n if (onPlayStart) onPlayStart();\n finished = 0;\n PC = playaddr;",
    )
    .replace("function play() {", "this._play = play;\n function play() {");

  const sandbox = {
    AudioContext: class {
      sampleRate = SAMPLE_RATE;
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
        this.response = u8.buffer.slice(
          u8.byteOffset,
          u8.byteOffset + u8.byteLength,
        );
        this.onload();
      }
    },
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  const ctx = createContext(sandbox);
  runInContext(`${src}\n; this.jsSID = jsSID;`, ctx, { filename: "jsSID.js" });
  const player = new ctx.jsSID(4096, 0);
  if (
    !player._memory ||
    !player._play ||
    !player._framecnt ||
    !player._setOnSidStore ||
    !player._setOnPlayStart
  ) {
    throw new Error("jsSID inject failed (need memory / play / SID-store hooks)");
  }
  return player;
}

const sidBytes = readFileSync(SID_PATH);
const player = loadJsSid(sidBytes);

const plays = [];
let cur = [];
player._setOnSidStore((r, v) => {
  cur.push([r, v]);
});
player._setOnPlayStart(() => {
  if (plays.length || cur.length) {
    plays.push(cur);
    cur = [];
  }
});

player.loadinit("sid", SUBTUNE);
const initPokes = cur;
cur = [];

const needFrames = Math.round(SECONDS * FRAME_HZ);
const frames = [];
const pcm = [];
let lastFc = player._framecnt();
const maxSamples = SECONDS * SAMPLE_RATE + SAMPLE_RATE;
for (let i = 0; i < maxSamples && frames.length < needFrames; i++) {
  const mix = player._play();
  if (WANT_WAV) pcm.push(mix);
  const fc = player._framecnt();
  if (fc > lastFc) {
    frames.push(Array.from(player._memory.subarray(0xd400, 0xd400 + REG_COUNT)));
  }
  lastFc = fc;
}
if (cur.length) plays.push(cur);

mkdirSync(OUT_DIR, { recursive: true });
const jsonPath = join(OUT_DIR, "c64.sidtrace.json");
writeTrace(
  jsonPath,
  snapshotSchema({
    source: "c64-hermit",
    sid: SID_PATH,
    subtune: SUBTUNE,
    seconds: frames.length / FRAME_HZ,
    frames,
    init: initPokes,
    plays,
  }),
);
const pokeN = plays.reduce((n, p) => n + p.length, 0);
console.log(
  `wrote ${jsonPath} (${frames.length} frames, ${plays.length} plays, ${pokeN} pokes, init ${initPokes.length})`,
);

if (WANT_WAV && pcm.length) {
  const wavPath = join(OUT_DIR, "c64.wav");
  writeFileSync(wavPath, encodeWavMonoS16le(floatsToS16le(pcm), SAMPLE_RATE));
  console.log(`wrote ${wavPath}`);
}
