#!/usr/bin/env node
/**
 * Diff two 50 Hz SID snapshots (gate runs + waveforms per voice).
 * For per-play poke lists use compare-pokes.mjs.
 *
 *   node src.sids/goldenaxe/bin/compare.mjs
 *   node src.sids/goldenaxe/bin/compare.mjs out/c64.sidtrace.json out/beeb.sidtrace.json
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, summarizeVoice, waveBits } from "./lib/sidtrace.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../out");

const aPath = arg("--a", process.argv[2] || join(OUT, "c64.sidtrace.json"));
const bPath = arg("--b", process.argv[3] || join(OUT, "beeb.sidtrace.json"));
const skip = Number(arg("--skip", "25"));

if (!existsSync(aPath) || !existsSync(bPath)) {
  console.error(`need both traces:\n  ${aPath}\n  ${bPath}`);
  process.exit(1);
}

const a = JSON.parse(readFileSync(aPath, "utf8"));
const b = JSON.parse(readFileSync(bPath, "utf8"));
const n = Math.min(a.frames.length, b.frames.length);
const framesA = a.frames.slice(0, n);
const framesB = b.frames.slice(0, n);

console.log(
  `${a.source} ${a.frames.length}f  vs  ${b.source} ${b.frames.length}f  (compare ${n}, skip ${skip})`,
);

function line(v, sa, sb) {
  const w = (s) =>
    `N=${s.waves.N} P=${s.waves.P} T=${s.waves.T} S=${s.waves.S}`;
  console.log(
    `voice ${v}  gate% ${sa.gatePct.toFixed(1).padStart(5)} vs ${sb.gatePct.toFixed(1).padStart(5)}` +
      `  runs ${String(sa.runs).padStart(3)} vs ${String(sb.runs).padStart(3)}` +
      `  meanGate ${sa.meanGate.toFixed(1)} vs ${sb.meanGate.toFixed(1)}f` +
      `  max ${sa.maxGate} vs ${sb.maxGate}`,
  );
  console.log(`         wave  ${w(sa)}`);
  console.log(`               ${w(sb)}`);
  if (sa.sampleRuns.length || sb.sampleRuns.length) {
    const fmt = (runs) =>
      runs.map((r) => `${r.start}:${r.len}`).join(" ") || "-";
    console.log(`         c64 runs  ${fmt(sa.sampleRuns)}`);
    console.log(`         beeb runs ${fmt(sb.sampleRuns)}`);
  }
}

for (let v = 0; v < 3; v++) {
  line(v, summarizeVoice(framesA, v, skip), summarizeVoice(framesB, v, skip));
}

const filtA = framesA[skip] ?? framesA[0];
const filtB = framesB[skip] ?? framesB[0];
if (filtA && filtB) {
  console.log(
    `filter @skip  c64 ${filtA[21]} ${filtA[22]} ${filtA[23]} vol=${filtA[24] & 0x0f}` +
      `  beeb ${filtB[21]} ${filtB[22]} ${filtB[23]} vol=${filtB[24] & 0x0f}`,
  );
}

// First frames where noise is on for either side (drum candidates).
console.log("noise-on frames (first 12):");
let shown = 0;
for (let i = skip; i < n && shown < 12; i++) {
  const bits = [0, 1, 2].map((v) => {
    const ca = a.frames[i][v * 7 + 4];
    const cb = b.frames[i][v * 7 + 4];
    const na = !!(ca & 0x80);
    const nb = !!(cb & 0x80);
    if (!na && !nb) return null;
    return `v${v} ${waveBits(ca)}${ca & 1 ? "+" : "-"}/${waveBits(cb)}${cb & 1 ? "+" : "-"}`;
  });
  const hit = bits.filter(Boolean);
  if (!hit.length) continue;
  console.log(`  f${i}  ${hit.join("  ")}`);
  shown++;
}
