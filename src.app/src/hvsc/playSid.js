/**
 * Preview original C64 .sid files with Hermit jsSID (Web Audio).
 * Not FastSID — that chip is only driven by BeebSID $FC20 pokes after convert.
 */

let JsSIDCtor = null;
let player = null;
let blobUrl = null;
/** @type {AnalyserNode|null} */
let analyser = null;
const waveScratch = new Uint8Array(256);

function attachAnalyser(p) {
  const ctx = p?.audioCtx;
  const node = p?.scriptNode;
  if (!ctx || !node) {
    analyser = null;
    return;
  }
  analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.15;
  try {
    node.connect(analyser);
  } catch {
    analyser = null;
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

export async function warmupSidPlayer() {
  await loadCtor();
}

export async function playSidBytes(bytes, subtune = 0) {
  const Ctor = await loadCtor();
  stopSid();
  player = new Ctor(4096, 0);
  attachAnalyser(player);
  blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("SID load timed out")), 8000);
    player.setloadcallback(() => {
      clearTimeout(t);
      resolve();
    });
    player.loadstart(blobUrl, subtune);
  });
}

export function stopSid() {
  try {
    player?.pause?.();
  } catch {
    /* already disconnected */
  }
  player = null;
  analyser = null;
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
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
