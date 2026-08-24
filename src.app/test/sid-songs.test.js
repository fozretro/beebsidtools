import { test } from "node:test";
import assert from "node:assert/strict";
import { clampSubtune, describeSidSongs } from "../src/hvsc/sidSongs.js";

function header({ songs = 1, start = 1 } = {}) {
  const sid = new Uint8Array(0x80);
  sid[0x0e] = (songs >> 8) & 0xff;
  sid[0x0f] = songs & 0xff;
  sid[0x10] = (start >> 8) & 0xff;
  sid[0x11] = start & 0xff;
  return sid;
}

test("default song is 1-based and maps to a 0-based subtune", () => {
  const info = describeSidSongs(header({ songs: 12, start: 3 }));
  assert.equal(info.songs, 12);
  assert.equal(info.startSong, 3);
  assert.equal(info.subtune, 2);
});

test("missing or out-of-range default falls back to song 1", () => {
  assert.equal(describeSidSongs(header({ songs: 4, start: 0 })).subtune, 0);
  assert.equal(describeSidSongs(header({ songs: 4, start: 9 })).startSong, 1);
  assert.equal(describeSidSongs(new Uint8Array(8)).songs, 1);
});

test("clampSubtune stays inside the song list", () => {
  assert.equal(clampSubtune(-1, 5), 0);
  assert.equal(clampSubtune(4, 5), 4);
  assert.equal(clampSubtune(9, 5), 4);
});
