/**
 * In-app live jsbeeb: boot SSD to SIDPLAY, realtime video + BeebSID audio.
 * jsbeeb is reached only through preview/browser (no Keyboard / DdNoise).
 */

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

  const session = new MachineSession("B1770", {
    discImage: discBytes,
    romBaseUrl: DEFAULT_ROM_BASE,
  });
  await session.initialise();
  await session.boot(30);
  status("Loading SIDPLAY menu…");
  await bootToMenu(session, { timeoutMs: 60_000 });

  const sid = await createFastSid({ sampleRate: audioCtx.sampleRate });
  sid.reset();
  const audio = attachBeebSidAudio(audioCtx, sid, session.processor);
  const detachKeys = session.attachDomKeyboard();

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
      detachKeys();
      session.destroy();
      // Caller owns audioCtx when one was passed in.
      if (!existingCtx) audioCtx.close().catch(() => {});
    },
  };
}
