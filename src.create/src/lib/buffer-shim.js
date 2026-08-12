/** Ensure Buffer exists for browser bundles (Node already has it). */
import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

export { Buffer };
