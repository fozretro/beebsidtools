#!/usr/bin/env node
/**
 * SIDPLAY on jsbeeb: 50 Hz $FC20 snapshots + every store per play() burst.
 *
 * Packs Golden Axe with the create patch unless --ssd is given.
 * $FC20+r is stored as register r (same index as $D400+r).
 *
 *   node src.sids/goldenaxe/bin/trace-beeb.mjs [--seconds 8]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  FRAME_HZ,
  PLAY_GAP_CYCLES,
  REG_COUNT,
  arg,
  encodeWavMonoS16le,
  flag,
  snapshotSchema,
  writeTrace,
} from "./lib/sidtrace.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TUNE = join(HERE, "..");
const REPO = join(TUNE, "../..");
const CREATE = join(REPO, "src.create/src");

const SID_PATH = resolve(arg("--sid", join(TUNE, "original/Golden_Axe.sid")));
const OUT_DIR = resolve(arg("--out", join(TUNE, "out")));
const SECONDS = Number(arg("--seconds", "8"));
const WANT_WAV = !flag("--no-wav");
const REBUILD = flag("--rebuild");
const SSD_ARG = arg("--ssd", "");

const { MachineSession } = createRequire(
  join(REPO, "src.create/package.json"),
)("jsbeeb/machine-session");

const { createSsd } = await import(pathToFileURL(join(CREATE, "index.js")).href);
const { bootToMenu } = await import(
  pathToFileURL(join(CREATE, "preview/beebMenu.js")).href
);
const {
  pressReturn,
  BEEBSID_BASE,
  createFastSid,
  SAMPLE_RATE,
} = await import(pathToFileURL(join(CREATE, "preview/node/index.js")).href);
const { BBC_CPU_HZ } = await import(
  pathToFileURL(join(CREATE, "preview/fastsid.js")).href
);

function cpuCycles(cpu) {
  return cpu.cycleSeconds * BBC_CPU_HZ + cpu.currentCycles;
}

function loadPlayerAssets() {
  const sidplay = [
    join(REPO, "src.player/out/sidpl.o"),
    join(REPO, "src.player/test/golden/sidpl.o"),
  ].find((p) => existsSync(p));
  if (!sidplay) throw new Error("missing sidpl.o — npm run build:player");
  const hex = join(
    REPO,
    "src.player/src/platform/elk/resources/hexdigs.bin",
  );
  const assets = { sidplay: readFileSync(sidplay) };
  if (existsSync(hex)) assets.hex = readFileSync(hex);
  return assets;
}

async function packSsd(ssdPath) {
  if (existsSync(ssdPath) && !REBUILD) {
    console.error(`reusing ${ssdPath} (pass --rebuild to convert again)`);
    return;
  }
  if (!existsSync(SID_PATH)) throw new Error(`missing SID ${SID_PATH}`);
  console.error("converting + packing Golden Axe…");
  const sid = readFileSync(SID_PATH);
  const out = await createSsd([{ sid, baseName: "Golden_Axe" }], {
    assets: loadPlayerAssets(),
    title: "GOLDENAXE",
  });
  if (!out.ssd) throw new Error("createSsd produced no image (convert skipped?)");
  mkdirSync(dirname(ssdPath), { recursive: true });
  writeFileSync(ssdPath, out.ssd);
  console.error(`wrote ${ssdPath}`);
}

const ssdPath = SSD_ARG ? resolve(SSD_ARG) : join(OUT_DIR, "goldenaxe-beeb.ssd");
mkdirSync(OUT_DIR, { recursive: true });
if (!SSD_ARG) await packSsd(ssdPath);
if (!existsSync(ssdPath)) throw new Error(`missing SSD ${ssdPath}`);

const session = new MachineSession("B1770", { discImage: ssdPath });
await session.initialise();
await session.boot(30);
await bootToMenu(session, { timeoutMs: 60_000, expectTune0: "Golden Axe" });

const cpu = session._machine.processor;
const regs = new Uint8Array(REG_COUNT);
const frames = [];
const needFrames = Math.round(SECONDS * FRAME_HZ);
const frameCycles = BBC_CPU_HZ / FRAME_HZ;

const sid = WANT_WAV ? await createFastSid({ sampleRate: SAMPLE_RATE }) : null;
sid?.reset();
let lastCycles = cpuCycles(cpu);
let sampleAcc = 0;
const pcmChunks = [];

function flushPcm(cycles) {
  if (!sid) return;
  const delta = cycles - lastCycles;
  if (delta <= 0) return;
  lastCycles = cycles;
  sampleAcc += (delta * SAMPLE_RATE) / BBC_CPU_HZ;
  const n = Math.floor(sampleAcc);
  if (n <= 0) return;
  sampleAcc -= n;
  pcmChunks.push(sid.generate(n));
}

const plays = [];
let cur = [];
let lastPokeCycle = Number.NEGATIVE_INFINITY;
const playGap = Number(arg("--gap", String(PLAY_GAP_CYCLES)));

const hook = cpu.debugWrite.add((addr, val) => {
  if (addr >= BEEBSID_BASE && addr < BEEBSID_BASE + REG_COUNT) {
    const now = cpuCycles(cpu);
    flushPcm(now);
    const r = addr - BEEBSID_BASE;
    const v = val & 0xff;
    regs[r] = v;
    sid?.poke(r, v);
    if (now - lastPokeCycle > playGap && (plays.length || cur.length)) {
      plays.push(cur);
      cur = [];
    }
    cur.push([r, v]);
    lastPokeCycle = now;
  }
  return false;
});

await pressReturn(session);
for (let waited = 0; regs.every((b) => b === 0) && waited < 40; waited++) {
  await session.runFor(frameCycles);
}

for (let i = 0; i < needFrames; i++) {
  await session.runFor(frameCycles);
  flushPcm(cpuCycles(cpu));
  frames.push(Array.from(regs));
}

if (cur.length) plays.push(cur);
hook.remove();
session.destroy();

const jsonPath = join(OUT_DIR, "beeb.sidtrace.json");
writeTrace(
  jsonPath,
  snapshotSchema({
    source: "beebsid-jsbeeb",
    sid: SID_PATH,
    subtune: 0,
    seconds: frames.length / FRAME_HZ,
    frames,
    plays,
  }),
);
const pokeN = plays.reduce((n, p) => n + p.length, 0);
console.log(
  `wrote ${jsonPath} (${frames.length} frames, ${plays.length} plays, ${pokeN} pokes)`,
);

if (WANT_WAV && pcmChunks.length) {
  const wavPath = join(OUT_DIR, "beeb.wav");
  writeFileSync(wavPath, encodeWavMonoS16le(Buffer.concat(pcmChunks), SAMPLE_RATE));
  console.log(`wrote ${wavPath}`);
}
