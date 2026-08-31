import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CREATE_OPTIONS,
  OPTIONS_STORAGE_KEY,
  loadCreateOptions,
  parseCreateOptions,
  saveCreateOptions,
} from "../src/createOptions.js";

test("parseCreateOptions defaults tune previews on", () => {
  // Given no stored value
  // When parseCreateOptions reads it
  // Then Generate Tune Previews is on
  assert.deepEqual(parseCreateOptions(null), { tunePreviews: true });
  assert.deepEqual(parseCreateOptions(""), DEFAULT_CREATE_OPTIONS);
});

test("parseCreateOptions keeps an explicit off", () => {
  // Given stored options with tune previews off
  // When they are parsed
  // Then the toggle stays off
  assert.deepEqual(parseCreateOptions('{"tunePreviews":false}'), {
    tunePreviews: false,
  });
});

test("load and save create options use localStorage", () => {
  // Given an in-memory storage
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  // When the user turns previews off
  const saved = saveCreateOptions({ tunePreviews: false }, storage);
  // Then the next load in this browser is still off
  assert.equal(saved.tunePreviews, false);
  assert.equal(store.get(OPTIONS_STORAGE_KEY), '{"tunePreviews":false}');
  assert.deepEqual(loadCreateOptions(storage), { tunePreviews: false });
});
