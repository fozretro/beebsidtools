/** Disc Creator options. Survives refresh in this browser (localStorage). */

export const OPTIONS_STORAGE_KEY = "beebsidtools.createOptions";

export const DEFAULT_CREATE_OPTIONS = {
  tunePreviews: true,
  discNoises: true,
};

/**
 * @param {unknown} raw JSON string or object
 * @returns {{ tunePreviews: boolean, discNoises: boolean }}
 */
export function parseCreateOptions(raw) {
  if (raw == null || raw === "") return { ...DEFAULT_CREATE_OPTIONS };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_CREATE_OPTIONS };
    }
    return {
      tunePreviews: parsed.tunePreviews !== false,
      discNoises: parsed.discNoises !== false,
    };
  } catch {
    return { ...DEFAULT_CREATE_OPTIONS };
  }
}

/**
 * @param {Storage} [storage]
 */
export function loadCreateOptions(storage = globalThis.localStorage) {
  try {
    return parseCreateOptions(storage?.getItem?.(OPTIONS_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_CREATE_OPTIONS };
  }
}

/**
 * @param {{ tunePreviews?: boolean, discNoises?: boolean }} opts
 * @param {Storage} [storage]
 */
export function saveCreateOptions(opts, storage = globalThis.localStorage) {
  const next = parseCreateOptions(opts);
  try {
    storage?.setItem?.(OPTIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / missing storage */
  }
  return next;
}
