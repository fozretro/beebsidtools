/**
 * In-app live jsbeeb: boot SSD to SIDPLAY, realtime video + BeebSID audio.
 */

import { Keyboard } from "jsbeeb/src/keyboard.js";
import { DdNoise } from "jsbeeb/src/ddnoise.js";
import {
  MachineSession,
  DEFAULT_ROM_BASE,
  bootToMenu,
  BEEBSID_BASE,
  BEEBSID_END,
  BBC_CPU_HZ,
  createFastSid,
} from "beebsidtools-src-create/preview/browser";

const CYCLES_PER_SEC = BBC_CPU_HZ;
const MAX_CATCHUP_SEC = 0.05;

function cpuCycles(cpu) {
  return cpu.cycleSeconds * BBC_CPU_HZ + cpu.currentCycles;
}

function s16leToFloat32(pcm) {
  const n = pcm.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = pcm.readInt16LE(i * 2) / 32768;
  }
  return out;
}

/**
 * @param {AudioContext} ctx
 * @param {{ generate: (n: number) => import("buffer").Buffer, poke: Function, sampleRate: number }} sid
 * @param {object} cpu
 */
function attachBeebSidAudio(ctx, sid, cpu) {
  let lastCycles = cpuCycles(cpu);
  let sampleAcc = 0;
  /** @type {Float32Array[]} */
  const queue = [];
  let queueOffset = 0;
  const sampleRate = sid.sampleRate;

  function flushTo(cycles) {
    const delta = cycles - lastCycles;
    if (delta <= 0) return;
    lastCycles = cycles;
    sampleAcc += (delta * sampleRate) / BBC_CPU_HZ;
    const n = Math.floor(sampleAcc);
    if (n <= 0) return;
    sampleAcc -= n;
    queue.push(s16leToFloat32(sid.generate(n)));
  }

  const hook = cpu.debugWrite.add((addr, val) => {
    if (addr >= BEEBSID_BASE && addr <= BEEBSID_END) {
      flushTo(cpuCycles(cpu));
      sid.poke(addr - BEEBSID_BASE, val);
    }
    return false;
  });

  const node = ctx.createScriptProcessor(2048, 0, 1);
  node.onaudioprocess = (e) => {
    flushTo(cpuCycles(cpu));
    const out = e.outputBuffer.getChannelData(0);
    let i = 0;
    while (i < out.length) {
      if (!queue.length) {
        out.fill(0, i);
        break;
      }
      const chunk = queue[0];
      const avail = chunk.length - queueOffset;
      const need = out.length - i;
      const take = Math.min(avail, need);
      out.set(chunk.subarray(queueOffset, queueOffset + take), i);
      i += take;
      queueOffset += take;
      if (queueOffset >= chunk.length) {
        queue.shift();
        queueOffset = 0;
      }
    }
  };
  node.connect(ctx.destination);

  return {
    flush() {
      flushTo(cpuCycles(cpu));
    },
    dispose() {
      hook.remove();
      node.disconnect();
    },
  };
}

/** Paths relative to /jsbeeb/ (synced by scripts/sync-jsbeeb-roms.js). */
const DISC525_SOUNDS = {
  motorOn: "sounds/disc525/motoron.wav",
  motorOff: "sounds/disc525/motoroff.wav",
  motor: "sounds/disc525/motor.wav",
  step: "sounds/disc525/step.wav",
  seek: "sounds/disc525/seek.wav",
  seek2: "sounds/disc525/seek2.wav",
  seek3: "sounds/disc525/seek3.wav",
};

/**
 * Load drive samples with fetch + decodeAudioData.
 * jsbeeb's SamplePlayer.loadSounds uses XHR text/`data.buffer`, which fails
 * to decode under Vite ("Unable to decode audio data").
 *
 * @param {AudioContext} audioCtx
 * @param {string} romBaseUrl
 */
async function loadDisc525Sounds(audioCtx, romBaseUrl) {
  const base = romBaseUrl.endsWith("/") ? romBaseUrl : `${romBaseUrl}/`;
  /** @type {Record<string, AudioBuffer>} */
  const sounds = {};
  await Promise.all(
    Object.entries(DISC525_SOUNDS).map(async ([key, rel]) => {
      const url = base + rel;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Missing disc noise ${url}`);
      const ab = await res.arrayBuffer();
      sounds[key] = await audioCtx.decodeAudioData(ab.slice(0));
    }),
  );
  return sounds;
}

/**
 * TestMachine/fake6502 always installs FakeDdNoise (closed over by the FDC).
 * Patch that same stub instance to forward to real sampled drive noise after
 * turbo boot so we don't get seek cacophony during menu load.
 *
 * @param {AudioContext} audioCtx
 * @param {object} processor
 * @param {string} romBaseUrl
 */
async function attachDiscDriveNoise(audioCtx, processor, romBaseUrl) {
  const dd = new DdNoise(audioCtx, audioCtx.destination);
  dd.sounds = await loadDisc525Sounds(audioCtx, romBaseUrl);
  const stub = processor.ddNoise;
  stub.spinUp = () => dd.spinUp();
  stub.spinDown = () => dd.spinDown();
  stub.seek = (diff) => dd.seek(diff);
  stub.mute = () => dd.mute();
  stub.unmute = () => dd.unmute();

  // Turbo boot used FakeDdNoise; sync motor if a drive is already spinning.
  const drives = processor.fdc?.drives;
  if (Array.isArray(drives) && drives.some((d) => d?.spinning)) {
    dd.spinUp();
  }

  return {
    dispose() {
      dd.spinDown();
      stub.spinUp = () => {};
      stub.spinDown = () => {};
      stub.seek = () => 0;
      stub.mute = () => {};
      stub.unmute = () => {};
    },
  };
}

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {Uint8Array|ArrayBuffer|import("buffer").Buffer} opts.discBytes
 * @param {AudioContext} [opts.audioCtx] — pass one created in a user gesture
 * @param {(text: string, isError?: boolean) => void} [opts.onStatus]
 * @returns {Promise<{ dispose: () => void }>}
 */
export async function runLivePreview({
  canvas,
  discBytes,
  audioCtx: existingCtx = null,
  onStatus = () => {},
}) {
  const status = (text, isError = false) => onStatus(text, isError);

  status("Booting jsbeeb…");
  const audioCtx = existingCtx ?? new AudioContext();
  await audioCtx.resume();

  const romBaseUrl = DEFAULT_ROM_BASE;
  const session = new MachineSession("B1770", {
    discImage: discBytes,
    romBaseUrl,
  });
  await session.initialise();
  await session.boot(30);
  status("Loading SIDPLAY menu…");
  await bootToMenu(session, { timeoutMs: 60_000 });

  const sid = await createFastSid({ sampleRate: audioCtx.sampleRate });
  sid.reset();
  const audio = attachBeebSidAudio(audioCtx, sid, session.processor);
  const discNoise = await attachDiscDriveNoise(
    audioCtx,
    session.processor,
    romBaseUrl,
  );

  const keyboard = new Keyboard({
    processor: session.processor,
    inputEnabledFunction: () => false,
    keyLayout: "physical",
    dbgr: {
      enabled: () => false,
      keyPress: () => false,
      hide() {},
    },
  });
  keyboard.setRunning(true);

  const onKeyDown = (e) => keyboard.keyDown(e);
  const onKeyPress = (e) => keyboard.keyPress(e);
  const onKeyUp = (e) => keyboard.keyUp(e);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keypress", onKeyPress);
  window.addEventListener("keyup", onKeyUp);

  canvas.focus();
  status("Live");

  let lastTime = performance.now();
  let stopped = false;
  let raf = 0;

  function frame(now) {
    if (stopped) return;
    const dt = Math.min(MAX_CATCHUP_SEC, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const cycles = Math.floor(dt * CYCLES_PER_SEC);
    if (cycles > 0) {
      session.execute(cycles);
      audio.flush();
    }
    session.paintActiveToCanvas(canvas, { scale: 2 });
    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(frame);
  });

  return {
    dispose() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      audio.dispose();
      discNoise.dispose();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keypress", onKeyPress);
      window.removeEventListener("keyup", onKeyUp);
      session.destroy();
      // Caller owns audioCtx when one was passed in.
      if (!existingCtx) audioCtx.close().catch(() => {});
    },
  };
}
