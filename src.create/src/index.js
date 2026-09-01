/**
 * Browser-safe create API (convert / pack). Node jsbeeb preview lives in
 * "beebsidtools-src-create/preview" and is loaded only when createSsd({ preview }).
 */

import "./lib/buffer-shim.js";

export { runPipeline, createContext } from "./pipeline.js";
export { relocateStage, DEFAULT_RELOC_OPTS } from "./stages/relocate.js";
export {
  patchStage,
  prePatchStage,
  postPatchStage,
} from "./stages/patch.js";
export { ripStage } from "./stages/rip.js";
export { convertTunesStage } from "./stages/convertTunes.js";
export { packSsdStage } from "./stages/ssd.js";
export { ripSid } from "./lib/ripsid.js";
export { relocateSid } from "./lib/sidreloc/index.js";
export { packBeebSidSsd, SSD_ADDR } from "./lib/ssd.js";
export {
  upgradeBeebSidSsd,
  describeBeebSidUpgrade,
  upgradeNeeded,
  beebSidSsdError,
  isBeebSidSsd,
} from "./lib/upgradeSsd.js";
export {
  TUNE_LOAD,
  SIDPLAY_LOAD,
  SIDPELK_LOAD,
  bbcSidMaxBytes,
  describeTuneRam,
  formatTuneRam,
  assertTuneFitsRam,
} from "./lib/tuneRam.js";
export { rsidNeedsManualPatch, rsidManualPatchMessage } from "./lib/rsid.js";
export {
  buildMenu,
  buildBoot,
  dfsTuneName,
  titleFromStem,
  menuEntry,
  DEFAULT_PLAY_SECONDS,
  MENU_BUF_SIZE,
  MENU_ENTRY_SIZE,
  MENU_MAGIC,
  MENU_FORMAT,
  MENU_TRAILER_SIZE,
  menuTrailer,
  inspectMenu,
  upgradeMenu,
} from "./lib/menu.js";
export {
  parseSonglengthsMd5,
  parsePlayTime,
  lookupPlaySeconds,
  applySonglengths,
  normalizeHvscPath,
  hvscRelFromSonglengths,
  formatPlaySeconds,
  clampPlaySeconds,
  playSecondsOrDefault,
  SONGLENGTHS_NAME,
  SONGLENGTHS_REL,
} from "./lib/songlengths.js";
export {
  createDisc,
  addFile,
  setTitle,
  setOpt4,
  toBuffer,
  openDisc,
  rebuildDisc,
  DFS,
} from "./lib/dfs.js";
export {
  getPatches,
  resolvePatch,
  findPatchByHash,
  findPatchById,
  sha256Hex,
  builtinPatches,
  loadPatches,
} from "./lib/patchRegistry.js";
export { builtinPatches as patches } from "./patches/index.js";
export { parsePsid } from "./lib/psid.js";
export { parseBrkList } from "./lib/brk.js";
export {
  progressTotal,
  previewStepCount,
  convertProgressUpdate,
  packProgressUpdate,
  previewProgressUpdate,
  reportProgress,
} from "./progress.js";
export { wantTunePreviews } from "./tunePreviews.js";
export { applyPreviewFlag, previewOptsFromFlags } from "./previewFlags.js";

import { runPipeline, createContext } from "./pipeline.js";
import { convertTunesStage } from "./stages/convertTunes.js";
import { packSsdStage } from "./stages/ssd.js";
import { SIDPELK_LOAD, SIDPLAY_LOAD } from "./lib/tuneRam.js";
import { previewStepCount, progressTotal } from "./progress.js";

/**
 * @param {Buffer|Uint8Array|{sid:Buffer|Uint8Array,baseName?:string,title?:string,patch?:true|string|false,dfsName?:string}|Array} inputs
 * @returns {Array<{sid:Buffer,baseName:string,title?:string,patch?:true|string|false,dfsName?:string,playSeconds?:number}>}
 */
export function normalizeSidInputs(inputs) {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  return list.map((item, i) => {
    if (item == null) throw new Error(`input[${i}] is empty`);
    if (Buffer.isBuffer(item) || item instanceof Uint8Array) {
      return { sid: Buffer.from(item), baseName: `tune${i}` };
    }
    if (item.sid != null || item.inputSid != null) {
      return {
        sid: Buffer.from(item.sid ?? item.inputSid),
        baseName: item.baseName ?? `tune${i}`,
        title: item.title,
        patch: item.patch,
        dfsName: item.dfsName,
        playSeconds: item.playSeconds,
      };
    }
    throw new Error(`input[${i}]: need Buffer or { sid, baseName? }`);
  });
}

/**
 * Convert a SID buffer (replace replica, or relocate → optional patch → rip).
 *
 * @param {Buffer|Uint8Array} inputSid
 * @param {object} [opts]
 * @param {string} [opts.baseName='tune']
 * @param {true|string|false} [opts.patch=true]
 * @param {object} [opts.reloc] overrides for DEFAULT_RELOC_OPTS
 */
export async function convertSid(inputSid, opts = {}) {
  const baseName = opts.baseName ?? "tune";
  const { tunes, log } = await convertSids(
    [{ sid: inputSid, baseName, patch: opts.patch }],
    opts,
  );
  const t = tunes[0];
  return {
    relSid: t.relSid,
    brkText: t.brkText,
    relocErr: t.relocErr,
    patchedSid: t.patchedSid,
    bbcSid: t.bbcSid,
    vars: t.vars,
    log,
    meta: t.meta ?? {},
  };
}

/**
 * Convert one or more SIDs. No SSD packing.
 *
 * @param {Parameters<typeof normalizeSidInputs>[0]} inputs
 * @param {object} [opts]
 * @param {true|string|false} [opts.patch=true]
 * @param {object} [opts.reloc] overrides for DEFAULT_RELOC_OPTS
 * @param {(line: string) => void} [opts.onLog]
 * @param {(info: { phase: string, current: number, total: number, label?: string }) => void} [opts.onProgress]
 */
export async function convertSids(inputs, opts = {}) {
  const list = normalizeSidInputs(inputs);
  const ctx = await runPipeline(
    [
      convertTunesStage({
        patch: opts.patch ?? true,
        reloc: opts.reloc,
        onError: "fail",
      }),
    ],
    createContext({
      inputs: list,
      onLog: opts.onLog,
      onProgress: opts.onProgress,
      progressTotal: opts.progressTotal ?? list.length,
    }),
  );
  return { tunes: ctx.tunes, log: ctx.log, meta: ctx.meta };
}

/**
 * Convert one or more SIDs and pack a bootable BeebSID SSD.
 * Per-tune convert failures (reloc, rip, RAM) are skipped; pack fails
 * only if nothing remains.
 *
 * @param {Parameters<typeof normalizeSidInputs>[0]} inputs
 * @param {object} opts
 * @param {{ sidplay: Buffer|Uint8Array, sidpelk?: Buffer|Uint8Array, hex?: Buffer|Uint8Array }} opts.assets
 * @param {true|string|false} [opts.patch=true]
 * @param {object} [opts.reloc] overrides for DEFAULT_RELOC_OPTS
 * @param {string} [opts.title='BEEBSID']
 * @param {boolean} [opts.includeSidpelk=false]
 * @param {boolean|{
 *   audio?: boolean,
 *   tunePreviews?: boolean,
 *   secondsPerTune?: number,
 *   romBaseUrl?: string,
 *   stage?: { name: string, run: Function },
 * }} [opts.preview=false]
 *   When set, appends turbo preview. Pass `preview.stage` from
 *   `preview/node/stage.js` (CLI) or `preview/browser/stage.js` (app)
 *   so bundlers never pull the wrong host. `audio` / `tunePreviews`
 *   (same knob) are the mini WAV clips; menu PNG still runs when they
 *   are off. Disc Creator default on; CLI off unless --tune-previews.
 * @param {(line: string) => void} [opts.onLog] - live log lines as the pipeline runs
 * @param {(info: { phase: string, current: number, total: number, label?: string }) => void} [opts.onProgress]
 * @param {number} [opts.progressExtra] reserved steps after pack (preview on another thread).
 *   Defaults to menu + one WAV per tune when `opts.preview` is set.
 */
export async function createSsd(inputs, opts = {}) {
  if (!opts.assets?.sidplay) {
    throw new Error("createSsd: opts.assets.sidplay required");
  }

  const list = normalizeSidInputs(inputs);
  const previewOpts = opts.preview === true ? {} : opts.preview || {};
  const extra =
    opts.progressExtra ??
    (opts.preview
      ? previewStepCount(list.length, previewOpts)
      : 0);

  const stages = [
    convertTunesStage({
      patch: opts.patch ?? true,
      reloc: opts.reloc,
      onError: "skip",
      playerLoad: opts.includeSidpelk ? SIDPELK_LOAD : SIDPLAY_LOAD,
    }),
    packSsdStage({
      title: opts.title,
      includeSidpelk: opts.includeSidpelk,
    }),
  ];

  if (opts.preview) {
    const p = opts.preview === true ? {} : opts.preview;
    if (!p.stage) {
      throw new Error(
        "createSsd: preview.stage required — pass previewSsdStage from " +
          "preview/node (CLI) or preview/browser (app)",
      );
    }
    stages.push(p.stage);
  }

  const ctx = await runPipeline(
    stages,
    createContext({
      inputs: list,
      assets: opts.assets,
      onLog: opts.onLog,
      onProgress: opts.onProgress,
      progressTotal: progressTotal(list.length, extra),
      meta: {
        discTitle: opts.title ?? "BEEBSID",
        includeSidpelk: !!opts.includeSidpelk,
      },
    }),
  );
  return {
    ssd: ctx.ssd,
    menu: ctx.menu,
    tunes: ctx.tunes,
    log: ctx.log,
    meta: ctx.meta,
    preview: ctx.preview,
  };
}
