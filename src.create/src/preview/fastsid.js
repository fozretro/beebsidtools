/**
 * Vendored jsSID FastSID (VICE algorithm) for BeebSID PCM.
 * Node: load via vm. Browser: load scripts into a Function scope.
 */

import { Buffer } from "buffer";

export const SAMPLE_RATE = 44100;
/** BBC Micro CPU clock (Hz) — used to convert cycle deltas to PCM samples */
export const BBC_CPU_HZ = 2_000_000;

const SCRIPT_NAMES = [
  "jsxcompressor.js",
  "stream.js",
  "jssid.core.js",
  "jssid.fastsid.js",
];

/** @type {{ jsSID: any } | null} */
let cached = null;
/** @type {Promise<{ jsSID: any }> | null} */
let loading = null;

function patchFastSid(jsSID) {
  jsSID.FastSID.prototype.fastsid_store = jsSID.FastSID.prototype.store;
  return { jsSID };
}

async function loadScriptsNode() {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const vm = await import("node:vm");

  const here = dirname(fileURLToPath(import.meta.url));
  // src/preview → ../../vendor/jsSID
  const jsDir = join(here, "../../vendor/jsSID");

  const sandbox = {
    window: null,
    console,
    Array,
    Object,
    Math,
    Float32Array,
    Int32Array,
    Uint8Array,
    Uint16Array,
    Uint32Array,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  const context = vm.createContext(sandbox);

  for (const name of SCRIPT_NAMES) {
    const code = readFileSync(join(jsDir, name), "utf8");
    vm.runInContext(code, context, { filename: name });
  }

  return patchFastSid(context.jsSID);
}

async function loadScriptsBrowser() {
  // Explicit ?url imports so Vite emits all four assets (loop + template is opaque).
  const urls = (
    await Promise.all([
      import("../../vendor/jsSID/jsxcompressor.js?url"),
      import("../../vendor/jsSID/stream.js?url"),
      import("../../vendor/jsSID/jssid.core.js?url"),
      import("../../vendor/jsSID/jssid.fastsid.js?url"),
    ])
  ).map((m) => m.default);

  const parts = [];
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`FastSID: failed to load ${url}`);
    parts.push(await res.text());
  }
  const fn = new Function(`${parts.join("\n")}\n; return jsSID;`);
  return patchFastSid(fn());
}

async function loadScripts() {
  if (cached) return cached;
  if (!loading) {
    const isBrowser = typeof window !== "undefined";
    loading = (isBrowser ? loadScriptsBrowser() : loadScriptsNode()).then(
      (r) => {
        cached = r;
        return r;
      },
    );
  }
  return loading;
}

function floatsToS16le(floats) {
  const buf = Buffer.allocUnsafe(floats.length * 2);
  for (let i = 0; i < floats.length; i++) {
    let s = floats[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    buf.writeInt16LE((s * 32767) | 0, i * 2);
  }
  return buf;
}

/**
 * @param {{ sampleRate?: number }} [opts]
 * @returns {Promise<{ poke: (reg: number, val: number) => void, generate: (n: number) => Buffer, reset: () => void, sampleRate: number }>}
 */
export async function createFastSid(opts = {}) {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const { jsSID } = await loadScripts();
  const sid = new jsSID.FastSID({
    model: jsSID.chip.model.MOS6581,
    clock: jsSID.chip.clock.PAL,
    sampleRate,
  });

  return {
    sampleRate,
    poke(reg, val) {
      sid.poke(reg & 0x1f, val & 0xff);
    },
    generate(n) {
      const samples = Math.max(0, n | 0);
      if (samples === 0) return Buffer.alloc(0);
      return floatsToS16le(sid.generate(samples));
    },
    reset() {
      sid.reset();
    },
  };
}

/**
 * @param {Buffer} pcmS16le
 * @param {number} [sampleRate=44100]
 */
export function encodeWavMonoS16le(pcmS16le, sampleRate = SAMPLE_RATE) {
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
