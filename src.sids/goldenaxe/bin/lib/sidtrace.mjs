/**
 * Shared SID-register trace helpers (25 bytes $D400 / $FC20, 50 Hz).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const FRAME_HZ = 50;
export const REG_COUNT = 25;
export const WAVE = [
  [0x10, "T"],
  [0x20, "S"],
  [0x40, "P"],
  [0x80, "N"],
];

export function voiceBase(v) {
  return v * 7;
}

export function ctrlOf(regs, v) {
  return regs[voiceBase(v) + 4] & 0xff;
}

export function snapshotSchema(partial) {
  const doc = {
    source: partial.source,
    sid: partial.sid,
    subtune: partial.subtune ?? 0,
    frameHz: FRAME_HZ,
    seconds: partial.seconds,
    frames: partial.frames,
  };
  if (partial.init) doc.init = partial.init;
  if (partial.plays) doc.plays = partial.plays;
  return doc;
}

/** Compact poke: [reg 0–24, value]. $FC20+r ≡ $D400+r. */
export function fmtPoke(poke) {
  const [r, v] = poke;
  return `r${String(r).padStart(2, "0")}=${v.toString(16).padStart(2, "0")}`;
}

export function fmtPlay(pokes, limit = 24) {
  const body = pokes.slice(0, limit).map(fmtPoke).join(" ");
  return pokes.length > limit ? `${body} …+${pokes.length - limit}` : body;
}

export function playsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

export function firstPokeDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) {
      return { i, a: a[i], b: b[i] };
    }
  }
  if (a.length !== b.length) return { i: n, a: a[n] ?? null, b: b[n] ?? null };
  return null;
}

/** BBC cycles between play() bursts (half a 50 Hz frame). */
export const PLAY_GAP_CYCLES = 16_000;

export function writeTrace(path, doc) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(doc)}\n`);
}

export function encodeWavMonoS16le(pcmS16le, sampleRate = 44100) {
  const dataSize = pcmS16le.length;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  pcmS16le.copy(buf, 44);
  return buf;
}

export function floatsToS16le(floats) {
  const buf = Buffer.alloc(floats.length * 2);
  for (let i = 0; i < floats.length; i++) {
    let s = floats[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    buf.writeInt16LE((s * 32767) | 0, i * 2);
  }
  return buf;
}

export function waveBits(ctrl) {
  return WAVE.filter(([bit]) => ctrl & bit)
    .map(([, ch]) => ch)
    .join("") || "-";
}

/** Consecutive frames where gate is on. */
export function gateRuns(frames, voice, skip = 0) {
  const runs = [];
  let start = -1;
  for (let i = skip; i < frames.length; i++) {
    const on = !!(ctrlOf(frames[i], voice) & 1);
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      runs.push({ start, end: i - 1, len: i - start });
      start = -1;
    }
  }
  if (start >= 0) {
    runs.push({ start, end: frames.length - 1, len: frames.length - start });
  }
  return runs;
}

export function waveCounts(frames, voice, skip = 0) {
  const counts = { T: 0, S: 0, P: 0, N: 0, "-": 0, gate: 0 };
  for (let i = skip; i < frames.length; i++) {
    const c = ctrlOf(frames[i], voice);
    if (c & 1) counts.gate++;
    const w = waveBits(c);
    if (w === "-") counts["-"]++;
    else {
      for (const ch of w) counts[ch]++;
    }
  }
  return counts;
}

export function meanRun(runs) {
  if (!runs.length) return 0;
  return runs.reduce((s, r) => s + r.len, 0) / runs.length;
}

export function summarizeVoice(frames, voice, skip = 0) {
  const runs = gateRuns(frames, voice, skip);
  const waves = waveCounts(frames, voice, skip);
  const n = Math.max(1, frames.length - skip);
  return {
    voice,
    gateFrames: waves.gate,
    gatePct: (100 * waves.gate) / n,
    runs: runs.length,
    meanGate: meanRun(runs),
    maxGate: runs.reduce((m, r) => Math.max(m, r.len), 0),
    minGate: runs.length ? runs.reduce((m, r) => Math.min(m, r.len), 1e9) : 0,
    waves,
    sampleRuns: runs.slice(0, 8),
  };
}

export function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return def;
  return process.argv[i + 1];
}

export function flag(name) {
  return process.argv.includes(name);
}
