/**
 * Preview original C64 .sid files with Hermit jsSID (Web Audio).
 * Not FastSID — that chip is only driven by BeebSID $FC20 pokes after convert.
 *
 * One jsSID / AudioContext for the page. Creating a new context per tune
 * hits the browser limit and all sound stops.
 */

import { clampSubtune, describeSidSongs } from "./sidSongs.js";

let JsSIDCtor = null;
let player = null;
let blobUrl = null;
let playGen = 0;
/** @type {AnalyserNode|null} */
let analyser = null;
const waveScratch = new Uint8Array(256);

function attachAnalyser(p) {
  if (analyser) return;
  const ctx = p?.audioCtx;
  const node = p?.scriptNode;
  if (!ctx || !node) return;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.15;
  try {
    node.connect(analyser);
  } catch {
    analyser = null;
  }
}

function revokeBlob() {
  if (!blobUrl) return;
  URL.revokeObjectURL(blobUrl);
  blobUrl = null;
}

async function resumeCtx(p) {
  const ctx = p?.audioCtx;
  if (!ctx || ctx.state === "closed") return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* autoplay / already running */
    }
  }
}

async function loadCtor() {
  if (JsSIDCtor) return JsSIDCtor;
  const urlMod = await import("../../vendor/hermit-jssid/jsSID.js?url");
  const res = await fetch(urlMod.default);
  if (!res.ok) throw new Error("Failed to load jsSID player");
  const src = await res.text();
  JsSIDCtor = new Function(`${src}\n; return jsSID;`)();
  return JsSIDCtor;
}

async function ensurePlayer() {
  const Ctor = await loadCtor();
  if (player?.audioCtx && player.audioCtx.state !== "closed") {
    attachAnalyser(player);
    await resumeCtx(player);
    return player;
  }
  player = new Ctor(4096, 0);
  analyser = null;
  attachAnalyser(player);
  await resumeCtx(player);
  return player;
}

export async function warmupSidPlayer() {
  await loadCtor();
}

/**
 * @param {Uint8Array} bytes
 * @param {number} [subtune] 0-based; omit to use the SID default song
 */
export async function playSidBytes(bytes, subtune) {
  const info = describeSidSongs(bytes);
  const start = subtune == null ? info.subtune : clampSubtune(subtune, info.songs);
  const gen = ++playGen;
  const p = await ensurePlayer();
  if (gen !== playGen) return { ...info, subtune: start };
  revokeBlob();
  blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("SID load timed out")), 8000);
    p.setloadcallback(() => {
      clearTimeout(t);
      resolve();
    });
    p.loadstart(blobUrl, start);
  });
  if (gen !== playGen) return { ...info, subtune: start };
  await resumeCtx(p);
  return { ...info, subtune: start };
}

/** Switch song on the already-loaded SID (0-based). */
export function startSidSubtune(subtune) {
  if (!player?.start) return 0;
  const n = clampSubtune(subtune, player.getsubtunes?.() ?? 1);
  player.start(n);
  void resumeCtx(player);
  return n;
}

export function stopSid() {
  playGen += 1;
  try {
    player?.pause?.();
  } catch {
    /* already disconnected */
  }
  revokeBlob();
}

export function pauseSid() {
  try {
    player?.pause?.();
  } catch {
    /* already disconnected */
  }
}

export function resumeSid() {
  try {
    player?.playcont?.();
  } catch {
    /* not loaded */
  }
  void resumeCtx(player);
}

export function setSidVolume(vol) {
  try {
    player?.setvolume?.(vol);
  } catch {
    /* not loaded */
  }
}

export function getSidOutput() {
  try {
    return player?.getoutput?.() ?? 0;
  } catch {
    return 0;
  }
}

/** Byte time-domain samples (128 = silence). Empty when nothing is playing. */
export function getSidWaveform() {
  if (!analyser) return null;
  analyser.getByteTimeDomainData(waveScratch);
  return waveScratch;
}
