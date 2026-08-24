/**
 * HVSC Songlengths.md5 — play times for SID subtunes.
 * SID files loop; this list is how players decide "once through".
 */

export const DEFAULT_PLAY_SECONDS = 180;

export const SONGLENGTHS_NAME = "Songlengths.md5";

/** Relative to an HVSC root or a C64Music folder. */
export const SONGLENGTHS_REL = [
  ["DOCUMENTS", SONGLENGTHS_NAME],
  ["C64Music", "DOCUMENTS", SONGLENGTHS_NAME],
];

/** SIDPLAY .menu buffer (player.asm `.menu SKIP`). */
export const MENU_BUF_SIZE = 1261;

/**
 * @param {string} path HVSC comment or indexed relative path
 * @returns {string}
 */
export function normalizeHvscPath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^;+\s*/, "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^C64Music\//i, "")
    .toLowerCase();
}

/**
 * @param {string} token mm:ss or m:ss[.ms]
 * @returns {number|null} whole seconds
 */
export function parsePlayTime(token) {
  const m = String(token)
    .trim()
    .match(/^(\d+):(\d{2})(?:\.(\d+))?$/);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + Number(m[2]);
  const frac = m[3] != null ? Number(`0.${m[3]}`) : 0;
  if (!Number.isFinite(sec) || !Number.isFinite(frac)) return null;
  return Math.max(1, Math.round(sec + frac));
}

/**
 * @param {unknown} n
 * @returns {number}
 */
export function clampPlaySeconds(n) {
  const s = Math.round(Number(n));
  if (!Number.isFinite(s) || s < 1) return DEFAULT_PLAY_SECONDS;
  return Math.min(65535, s);
}

/** @param {unknown} n */
export function playSecondsOrDefault(n) {
  return n == null || n === "" ? DEFAULT_PLAY_SECONDS : clampPlaySeconds(n);
}

/** @param {number|null|undefined} n */
export function formatPlaySeconds(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const s = Math.max(0, Math.round(Number(n)));
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * @param {string} text
 * @returns {{ byMd5: Map<string, number[]>, byPath: Map<string, number[]> }}
 */
export function parseSonglengthsMd5(text) {
  const byMd5 = new Map();
  const byPath = new Map();
  let pendingPath = "";
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("[")) continue;
    if (line.startsWith(";")) {
      pendingPath = normalizeHvscPath(line.slice(1));
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const md5 = line.slice(0, eq).trim().toLowerCase();
    const times = line
      .slice(eq + 1)
      .trim()
      .split(/\s+/)
      .map(parsePlayTime)
      .filter((n) => n != null);
    if (!times.length) continue;
    if (/^[0-9a-f]{32}$/.test(md5)) byMd5.set(md5, times);
    if (pendingPath) byPath.set(pendingPath, times);
    pendingPath = "";
  }
  return { byMd5, byPath };
}

/**
 * @param {{ byMd5: Map<string, number[]>, byPath: Map<string, number[]> }} db
 * @param {{ path?: string, md5?: string, startSong?: number }} [opts]
 * @returns {number|null}
 */
export function lookupPlaySeconds(db, opts = {}) {
  if (!db) return null;
  const times =
    (opts.md5 && db.byMd5.get(String(opts.md5).toLowerCase())) ||
    (opts.path && db.byPath.get(normalizeHvscPath(opts.path))) ||
    null;
  if (!times?.length) return null;
  const i = Math.max(0, (Number(opts.startSong) || 1) - 1);
  return clampPlaySeconds(times[i] ?? times[0]);
}

/**
 * Copy HVSC default-song times onto index rows (leave unknown rows unchanged).
 * @param {object[]} tunes
 * @param {{ byMd5: Map<string, number[]>, byPath: Map<string, number[]> }|null} db
 */
/**
 * HVSC-relative path for a SID on disk, given where Songlengths.md5 was found.
 * `…/C64Music/DOCUMENTS/Songlengths.md5` + `…/C64Music/MUSICIANS/H/Foo.sid`
 * → `musicians/h/foo.sid`.
 * @param {string} sidPath
 * @param {string} songlengthsPath
 */
export function hvscRelFromSonglengths(sidPath, songlengthsPath) {
  const sl = String(songlengthsPath || "").replace(/\\/g, "/");
  const sid = String(sidPath || "").replace(/\\/g, "/");
  const docs = sl.replace(/\/[^/]+$/, "");
  const root = docs.replace(/\/[Dd][Oo][Cc][Uu][Mm][Ee][Nn][Tt][Ss]$/, "");
  const rootLc = root.toLowerCase();
  const sidLc = sid.toLowerCase();
  if (root && (sidLc === rootLc || sidLc.startsWith(`${rootLc}/`))) {
    return normalizeHvscPath(sid.slice(root.length));
  }
  return normalizeHvscPath(sid);
}

export function applySonglengths(tunes, db) {
  if (!db) return tunes;
  return tunes.map((t) => {
    const playSeconds = lookupPlaySeconds(db, {
      path: t.path,
      startSong: t.startSong,
    });
    return playSeconds == null ? t : { ...t, playSeconds };
  });
}
