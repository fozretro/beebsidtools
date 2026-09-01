#!/usr/bin/env node
/**
 * Compare per-play() SID poke lists ($FC20+r ≡ $D400+r).
 *
 *   node src.sids/goldenaxe/bin/compare-pokes.mjs
 *   node src.sids/goldenaxe/bin/compare-pokes.mjs --shift 0
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  arg,
  firstPokeDiff,
  fmtPlay,
  fmtPoke,
  flag,
  playsEqual,
} from "./lib/sidtrace.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../out");

const aPath = arg("--a", process.argv[2] || join(OUT, "c64.sidtrace.json"));
const bPath = arg("--b", process.argv[3] || join(OUT, "beeb.sidtrace.json"));
const shiftArg = arg("--shift", "");
const preview = Number(arg("--preview", "2"));
const raw = flag("--raw");

if (!existsSync(aPath) || !existsSync(bPath)) {
  console.error(`need both traces:\n  ${aPath}\n  ${bPath}`);
  process.exit(1);
}

const a = JSON.parse(readFileSync(aPath, "utf8"));
const b = JSON.parse(readFileSync(bPath, "utf8"));
if (!a.plays || !b.plays) {
  console.error("traces need .plays — re-run trace-c64.mjs and trace-beeb.mjs");
  process.exit(1);
}

function pokeCount(plays) {
  return plays.reduce((n, p) => n + p.length, 0);
}

function isWipePlay(p) {
  return (
    p.length > 0 &&
    p.every(([r, v]) => v === 0 || (r === 24 && (v === 0x1f || v === 0)))
  );
}

/** SIDPLAY often dumps r23…r00 = 0 immediately before the first real play. */
function peelSidplayScan(p) {
  if (p.length < 20 || p[0][0] < 20 || p[0][1] !== 0) return p;
  let i = 0;
  let expect = p[0][0];
  while (i < p.length && p[i][1] === 0 && p[i][0] === expect && expect >= 0) {
    i++;
    expect--;
  }
  return i >= 20 ? p.slice(i) : p;
}

function skipWipes(plays) {
  let i = 0;
  while (i < plays.length && isWipePlay(plays[i])) i++;
  return { skip: i, plays: plays.slice(i).map(peelSidplayScan) };
}

function ctrlHits(plays, val) {
  let n = 0;
  for (const play of plays) {
    for (const [r, v] of play) {
      if ((r === 4 || r === 11 || r === 18) && v === val) n++;
    }
  }
  return n;
}

function scoreShift(playsA, playsB, shift) {
  let same = 0;
  let compared = 0;
  for (let i = 0; i < playsA.length; i++) {
    const j = i + shift;
    if (j < 0 || j >= playsB.length) continue;
    compared++;
    if (playsEqual(playsA[i], playsB[j])) same++;
  }
  return { same, compared, pct: compared ? (100 * same) / compared : 0 };
}

const rawA = a.plays;
const rawB = b.plays;
const normA = raw ? { skip: 0, plays: rawA } : skipWipes(rawA);
const normB = raw ? { skip: 0, plays: rawB } : skipWipes(rawB);
const playsA = normA.plays;
const playsB = normB.plays;

const maxShift = Math.min(120, Math.max(playsA.length, playsB.length));
let best = { shift: 0, same: -1, compared: 0, pct: -1 };
if (shiftArg === "") {
  for (let s = -maxShift; s <= maxShift; s++) {
    const sc = scoreShift(playsA, playsB, s);
    if (sc.compared < 8) continue;
    if (
      sc.same > best.same ||
      (sc.same === best.same && Math.abs(s) < Math.abs(best.shift))
    ) {
      best = { shift: s, ...sc };
    }
  }
} else {
  const s = Number(shiftArg);
  best = { shift: s, ...scoreShift(playsA, playsB, s) };
}

console.log(
  `${a.source} ${rawA.length} plays / ${pokeCount(rawA)} pokes` +
    (a.init ? ` (init ${a.init.length})` : "") +
    `  vs  ${b.source} ${rawB.length} plays / ${pokeCount(rawB)} pokes`,
);
if (!raw && (normA.skip || normB.skip)) {
  console.log(
    `skipped wipe plays  c64 ${normA.skip}  beeb ${normB.skip}  (use --raw to keep them)`,
  );
}
console.log(
  `ctrl $81 (N+gate)  c64 ${ctrlHits(playsA, 0x81)}  beeb ${ctrlHits(playsB, 0x81)}` +
    `   ctrl $11  c64 ${ctrlHits(playsA, 0x11)}  beeb ${ctrlHits(playsB, 0x11)}`,
);
console.log(
  `best shift beeb = c64 + ${best.shift}   identical plays ${best.same}/${best.compared}` +
    ` (${best.pct.toFixed(1)}%)`,
);

for (const [lo, hi] of [
  [0, 200],
  [200, 500],
  [500, 800],
  [800, 1200],
  [1200, 1800],
  [1800, 2400],
  [2400, 3000],
  [3000, 4500],
  [4500, 6000],
  [6000, 7500],
  [7500, 9000],
  [9000, 12500],
]) {
  let same = 0;
  let cmp = 0;
  for (let i = lo; i < hi && i < playsA.length; i++) {
    const j = i + best.shift;
    if (j < 0 || j >= playsB.length) continue;
    cmp++;
    if (playsEqual(playsA[i], playsB[j])) same++;
  }
  if (!cmp) continue;
  console.log(
    `  plays ${String(lo).padStart(4)}–${String(hi).padStart(4)}  ${same}/${cmp} (${((100 * same) / cmp).toFixed(1)}%)`,
  );
}

const sites = new Map();
let lenMismatch = 0;
let firstBad = null;
let drumSame = 0;
let drumN = 0;
for (let i = 0; i < playsA.length; i++) {
  const j = i + best.shift;
  if (j < 0 || j >= playsB.length) continue;
  const pa = playsA[i];
  const pb = playsB[j];
  const drum = pa.some(([r, v]) => (r === 4 || r === 11 || r === 18) && v === 0x81);
  if (drum) {
    drumN++;
    if (playsEqual(pa, pb)) drumSame++;
  }
  if (playsEqual(pa, pb)) continue;
  if (!firstBad) firstBad = { i, j };
  if (pa.length !== pb.length) {
    lenMismatch++;
    continue;
  }
  for (let k = 0; k < pa.length; k++) {
    if (pa[k][0] !== pb[k][0] || pa[k][1] !== pb[k][1]) {
      const key = `r${pa[k][0]}`;
      sites.set(key, (sites.get(key) || 0) + 1);
    }
  }
}
if (drumN) {
  console.log(`plays that poke ctrl $81  identical ${drumSame}/${drumN}`);
}
if (sites.size) {
  const top = [...sites.entries()].sort((x, y) => y[1] - x[1]);
  console.log(
    `value mismatches by register  ${top.map(([k, n]) => `${k}×${n}`).join("  ")}` +
      (lenMismatch ? `  (length mismatch ${lenMismatch})` : ""),
  );
}

if (a.init?.length) {
  console.log(`c64 init  ${fmtPlay(a.init)}`);
}

if (!firstBad) {
  console.log("all aligned plays are byte-identical poke lists");
} else {
  const pa = playsA[firstBad.i];
  const pb = playsB[firstBad.j];
  const d = firstPokeDiff(pa, pb);
  console.log(
    `first diverge  c64 play ${firstBad.i} (${pa.length} pokes) vs beeb play ${firstBad.j} (${pb.length} pokes)`,
  );
  if (d) {
    console.log(
      `  poke[${d.i}]  c64 ${d.a ? fmtPoke(d.a) : "(end)"}  beeb ${d.b ? fmtPoke(d.b) : "(end)"}`,
    );
  }
  console.log(`  c64  ${fmtPlay(pa, 32)}`);
  console.log(`  beeb ${fmtPlay(pb, 32)}`);
}

console.log(`first ${preview} aligned plays:`);
for (let n = 0; n < preview; n++) {
  if (playsA[n]) console.log(`  c64[${n}]  ${fmtPlay(playsA[n])}`);
  const j = n + best.shift;
  if (playsB[j]) console.log(`  beeb[${j}] ${fmtPlay(playsB[j])}`);
}
