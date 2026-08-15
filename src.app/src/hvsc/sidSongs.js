/**
 * PSID/RSID song count and default start (header is 1-based).
 * Hermit jsSID subtunes are 0-based.
 */

export function describeSidSongs(bytes) {
  if (!bytes || bytes.length < 0x12) {
    return { songs: 1, startSong: 1, subtune: 0 };
  }
  const songs = Math.max(1, (bytes[0x0e] << 8) | bytes[0x0f]);
  let startSong = (bytes[0x10] << 8) | bytes[0x11];
  if (startSong < 1 || startSong > songs) startSong = 1;
  return { songs, startSong, subtune: startSong - 1 };
}

export function clampSubtune(subtune, songs) {
  const n = Math.max(1, Number(songs) || 1);
  const i = Number(subtune);
  if (!Number.isFinite(i)) return 0;
  return Math.min(n - 1, Math.max(0, Math.trunc(i)));
}
