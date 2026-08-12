/**
 * Browser-safe BeebSID audio recording (no node:fs / MachineSession).
 */

import { Buffer } from "buffer";
import { keyCodes } from "jsbeeb/src/utils.js";
import {
  BBC_CPU_HZ,
  SAMPLE_RATE,
  createFastSid,
  encodeWavMonoS16le,
} from "./fastsid.js";

export const BEEBSID_BASE = 0xfc20;
export const BEEBSID_END = 0xfc3f;
export const DEFAULT_RECORD_SECONDS = 10;

const KEY_RETURN = keyCodes.ENTER;
const KEY_HOLD_CYCLES = 250_000;
const RUN_CHUNK_CYCLES = 200_000;

function cpuCycles(cpu) {
  return cpu.cycleSeconds * BBC_CPU_HZ + cpu.currentCycles;
}

/**
 * @param {{ keyDown: Function, keyUp: Function, runFor: Function }} session
 */
export async function pressReturn(session) {
  session.keyDown(KEY_RETURN);
  await session.runFor(KEY_HOLD_CYCLES);
  session.keyUp(KEY_RETURN);
  await session.runFor(KEY_HOLD_CYCLES);
}

/**
 * @param {{ _machine: { processor: object }, keyDown: Function, keyUp: Function, runFor: Function }} session
 * @param {{ seconds?: number }} [opts]
 */
export async function recordFromSession(session, opts = {}) {
  const seconds = opts.seconds ?? DEFAULT_RECORD_SECONDS;

  const needSamples = Math.round(seconds * SAMPLE_RATE);
  const sid = await createFastSid();
  sid.reset();

  const cpu = session._machine.processor;
  let lastCycles = cpuCycles(cpu);
  let sampleAcc = 0;
  /** @type {Buffer[]} */
  const chunks = [];
  let totalSamples = 0;
  let pokeCount = 0;
  /** Only accumulate PCM once we arm recording (just before RETURN). */
  let recording = false;

  function flushTo(cycles) {
    const delta = cycles - lastCycles;
    if (delta <= 0) return;
    lastCycles = cycles;
    if (!recording) return;
    sampleAcc += (delta * SAMPLE_RATE) / BBC_CPU_HZ;
    const n = Math.floor(sampleAcc);
    if (n <= 0) return;
    sampleAcc -= n;
    const take = Math.min(n, needSamples - totalSamples);
    if (take > 0) {
      chunks.push(sid.generate(take));
      totalSamples += take;
    }
    if (n > take) {
      sid.generate(n - take);
    }
  }

  const hook = cpu.debugWrite.add((addr, val) => {
    if (addr >= BEEBSID_BASE && addr <= BEEBSID_END) {
      flushTo(cpuCycles(cpu));
      sid.poke(addr - BEEBSID_BASE, val);
      pokeCount++;
    }
    return false;
  });

  try {
    for (let attempt = 0; attempt < 4 && pokeCount === 0; attempt++) {
      // Drop any silence from a previous failed RETURN attempt.
      chunks.length = 0;
      totalSamples = 0;
      sampleAcc = 0;
      lastCycles = cpuCycles(cpu);
      recording = true;
      await pressReturn(session);
      for (let i = 0; i < 25 && pokeCount === 0; i++) {
        await session.runFor(RUN_CHUNK_CYCLES);
        flushTo(cpuCycles(cpu));
      }
      if (pokeCount === 0) recording = false;
    }

    if (pokeCount === 0) {
      throw new Error(
        "recordFromSession: no BeebSID writes to $FC20–$FC3F after RETURN",
      );
    }

    while (totalSamples < needSamples) {
      await session.runFor(RUN_CHUNK_CYCLES);
      flushTo(cpuCycles(cpu));
    }
  } finally {
    hook.remove();
  }

  const pcm = Buffer.concat(chunks).subarray(0, needSamples * 2);
  const wav = encodeWavMonoS16le(pcm, SAMPLE_RATE);

  return {
    wav,
    pcmBytes: pcm.length,
    pokeCount,
    sampleRate: SAMPLE_RATE,
    seconds: pcm.length / 2 / SAMPLE_RATE,
  };
}

/** RMS of s16le mono PCM (for non-silence asserts). */
export function pcmRmsS16le(pcm) {
  if (!pcm.length) return 0;
  let sum = 0;
  const n = pcm.length >> 1;
  for (let i = 0; i < pcm.length; i += 2) {
    const v = pcm.readInt16LE(i);
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}
