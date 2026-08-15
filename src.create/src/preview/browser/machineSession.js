/**
 * Browser MachineSession — turbo preview without fs/sharp.
 * ROMs via jsbeeb HTTP loader (setBaseUrl); disc from Uint8Array.
 */

import { Buffer } from "buffer";
import { TestMachine } from "jsbeeb/tests/test-machine.js";
import { InstrumentedSoundChip, FakeSoundChip } from "jsbeeb/src/soundchip.js";
import * as fdc from "jsbeeb/src/fdc.js";
import { Video } from "jsbeeb/src/video.js";
import { findModel } from "jsbeeb/src/models.js";
import { setBaseUrl } from "jsbeeb/src/utils.js";

const FB_WIDTH = 1024;
const FB_HEIGHT = 625;

/** Default where sync:jsbeeb-roms copies B-DFS assets (honours Vite `base`). */
function vitePublicBase() {
  try {
    const b = import.meta.env?.BASE_URL;
    if (typeof b === "string" && b) return b.endsWith("/") ? b : `${b}/`;
  } catch {
    /* Node / non-Vite */
  }
  return "/";
}

export const DEFAULT_ROM_BASE = `${vitePublicBase()}jsbeeb/`;

/**
 * @param {Uint8Array} rgba
 * @param {number} width
 * @param {number} height
 * @param {{ left: number, top: number, w: number, h: number, scale: number }} crop
 */
async function rgbaCropToPng(rgba, width, height, crop) {
  const { left, top, w, h, scale } = crop;
  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  const sctx = src.getContext("2d");
  const imageData = new ImageData(
    new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
    width,
    height,
  );
  sctx.putImageData(imageData, 0, 0);

  const out = document.createElement("canvas");
  out.width = w * scale;
  out.height = h * scale;
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, left, top, w, h, 0, 0, w * scale, h * scale);

  const blob = await new Promise((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))),
      "image/png",
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

/** Same surface as jsbeeb's Node MachineSession for menu/audio capture. */
export class MachineSession {
  /**
   * @param {string} [modelName]
   * @param {{ discImage?: Uint8Array|ArrayBuffer, romBaseUrl?: string }} [opts]
   */
  constructor(modelName = "B1770", opts = {}) {
    this.modelName = modelName;
    this._opts = opts;

    this._fb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);
    this._fb32 = new Uint32Array(this._fb8.buffer);
    this._completeFb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);

    const modelObj = findModel(modelName);
    this._video = new Video(
      modelObj.isMaster,
      this._fb32,
      () => {
        this._completeFb8.set(this._fb8);
      },
      { isAtom: modelObj.isAtom },
    );

    this._soundChip = modelObj.isAtom
      ? new FakeSoundChip()
      : new InstrumentedSoundChip();

    this._machine = new TestMachine(modelName, {
      video: this._video,
      soundChip: this._soundChip,
    });
  }

  async initialise() {
    const base = this._opts.romBaseUrl ?? DEFAULT_ROM_BASE;
    setBaseUrl(base.endsWith("/") ? base : `${base}/`);
    await this._machine.initialise();
    if (this._opts.discImage) {
      this.loadDiscBytes(this._opts.discImage);
    }
  }

  async boot(timeoutSecs = 30) {
    await this._machine.runUntilInput(timeoutSecs);
  }

  /** Type a line into BASIC/OS (appends RETURN). */
  async type(text) {
    await this._machine.type(text);
  }

  keyDown(keyCode, shiftDown = false) {
    this._machine.processor.sysvia.keyDown(keyCode, shiftDown);
  }

  keyUp(keyCode) {
    this._machine.processor.sysvia.keyUp(keyCode);
  }

  reset(hard = true) {
    this._machine.processor.reset(hard);
  }

  async runFor(cycles) {
    await this._machine.runFor(cycles);
  }

  /** Synchronous CPU run (realtime / live preview). */
  execute(cycles) {
    return this._machine.processor.execute(cycles | 0);
  }

  get processor() {
    return this._machine.processor;
  }

  /**
   * @param {Uint8Array|ArrayBuffer|Buffer} data
   * @param {string} [name]
   */
  loadDiscBytes(data, name = "disc.ssd") {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    this._machine.processor.fdc.loadDisc(
      0,
      fdc.discFor(this._machine.processor.fdc, name, bytes),
    );
  }

  readMemory(address, length) {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = this._machine.readbyte(address + i);
    }
    return out;
  }

  /**
   * Paint the last complete active display area onto `canvas` (scaled).
   * @param {HTMLCanvasElement} canvas
   * @param {{ scale?: number }} [opts]
   */
  paintActiveToCanvas(canvas, opts = {}) {
    const scale = opts.scale ?? 2;
    const v = this._video;
    const left = v.leftBorder;
    const top = v.topBorder;
    const right = v.rightBorder;
    const bottom = v.bottomBorder;
    const w = FB_WIDTH - left - right;
    const h = FB_HEIGHT - top - bottom;
    const dw = w * scale;
    const dh = h * scale;

    if (!this._paintSrc) {
      this._paintSrc = document.createElement("canvas");
      this._paintSrc.width = FB_WIDTH;
      this._paintSrc.height = FB_HEIGHT;
      this._paintCtx = this._paintSrc.getContext("2d");
      this._imageData = this._paintCtx.createImageData(FB_WIDTH, FB_HEIGHT);
    }

    this._imageData.data.set(this._completeFb8);
    this._paintCtx.putImageData(this._imageData, 0, 0);

    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    const dctx = canvas.getContext("2d");
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(this._paintSrc, left, top, w, h, 0, 0, dw, dh);
  }

  /**
   * @param {{ scale?: number }} [opts]
   * @returns {Promise<Buffer>} PNG bytes
   */
  async screenshotActive(opts = {}) {
    const scale = opts.scale ?? 2;
    const v = this._video;
    const left = v.leftBorder;
    const top = v.topBorder;
    const right = v.rightBorder;
    const bottom = v.bottomBorder;
    const w = FB_WIDTH - left - right;
    const h = FB_HEIGHT - top - bottom;
    const png = await rgbaCropToPng(this._completeFb8, FB_WIDTH, FB_HEIGHT, {
      left,
      top,
      w,
      h,
      scale,
    });
    return Buffer.from(png);
  }

  /**
   * Map window keydown/keyup to BBC keys (browser keyCode, same as keyDown).
   * @returns {() => void} detach
   */
  attachDomKeyboard() {
    const onKeyDown = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      this.keyDown(e.keyCode, e.shiftKey);
    };
    const onKeyUp = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      this.keyUp(e.keyCode);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }

  destroy() {
    this._fb8.fill(0);
  }
}
