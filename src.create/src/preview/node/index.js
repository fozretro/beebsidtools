/**
 * Node preview host entry (CLI, goldens, optional Vite API).
 */

export {
  bootToMenu,
  CYCLES_PER_POLL,
  MENU_TITLE_ADDR,
  MENU_TITLE_BYTES,
  MENU_DH_ADDR,
  MENU_DH_BYTE,
  MENU_TUNE0_ADDR,
} from "../beebMenu.js";
export {
  recordSsdAudio,
  recordFromSession,
  pressReturn,
  pcmRmsS16le,
  BEEBSID_BASE,
  DEFAULT_RECORD_SECONDS,
} from "./recordAudio.js";
export {
  captureSsdPreview,
  writePreviewFiles,
  materializeSsd,
  UI_SECONDS_PER_TUNE,
  GOLDEN_SECONDS,
} from "./capture.js";
export {
  createFastSid,
  encodeWavMonoS16le,
  SAMPLE_RATE,
} from "../fastsid.js";
export { previewSsdStage } from "./stage.js";
