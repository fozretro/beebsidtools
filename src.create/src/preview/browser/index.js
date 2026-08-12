/**
 * Browser preview host entry (static BeebSID Disc Creator).
 */

export { UI_SECONDS_PER_TUNE, GOLDEN_SECONDS } from "../contract.js";
export { captureSsdPreview } from "./capture.js";
export { previewSsdStage } from "./stage.js";
export { MachineSession, DEFAULT_ROM_BASE } from "./machineSession.js";
export {
  recordFromSession,
  pressReturn,
  pcmRmsS16le,
  BEEBSID_BASE,
  BEEBSID_END,
  DEFAULT_RECORD_SECONDS,
} from "../recordAudio.js";
export {
  bootToMenu,
  runCatAndFree,
  CYCLES_PER_POLL,
} from "../beebMenu.js";
export {
  BBC_CPU_HZ,
  SAMPLE_RATE,
  createFastSid,
} from "../fastsid.js";
