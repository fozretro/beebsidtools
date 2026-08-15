/**
 * Preview original C64 .sid files with Hermit jsSID (Web Audio).
 * Not FastSID — that chip is only driven by BeebSID $FC20 pokes after convert.
 */

let JsSIDCtor = null;
let player = null;
let blobUrl = null;

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
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
}
