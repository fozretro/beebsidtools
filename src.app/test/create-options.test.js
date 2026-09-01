import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CREATE_OPTIONS,
  OPTIONS_STORAGE_KEY,
  loadCreateOptions,
  parseCreateOptions,
  saveCreateOptions,
} from "../src/createOptions.js";

test("parseCreateOptions defaults tune previews and disc noises on", () => {
  // Given no stored value
  // When parseCreateOptions reads it
  // Then both toggles are on
  assert.deepEqual(parseCreateOptions(null), {
    tunePreviews: true,
    discNoises: true,
  });
  assert.deepEqual(parseCreateOptions(""), DEFAULT_CREATE_OPTIONS);
});

test("parseCreateOptions keeps an explicit off", () => {
  // Given stored options with tune previews off
  // When they are parsed
  // Then the toggle stays off and disc noises stay on
  assert.deepEqual(parseCreateOptions('{"tunePreviews":false}'), {
    tunePreviews: false,
    discNoises: true,
  });
});

test("parseCreateOptions keeps Test Disc noises off", () => {
  // Given stored options with disc noises off
  // When they are parsed
  // Then Test Disc stays silent
  assert.deepEqual(parseCreateOptions('{"discNoises":false}'), {
    tunePreviews: true,
    discNoises: false,
  });
});

test("load and save create options use localStorage", () => {
  // Given an in-memory storage
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  // When the user turns previews and disc noises off
  const saved = saveCreateOptions(
    { tunePreviews: false, discNoises: false },
    storage,
  );
  // Then the next load in this browser is still off
  assert.equal(saved.tunePreviews, false);
  assert.equal(saved.discNoises, false);
  assert.equal(
    store.get(OPTIONS_STORAGE_KEY),
    '{"tunePreviews":false,"discNoises":false}',
  );
  assert.deepEqual(loadCreateOptions(storage), {
    tunePreviews: false,
    discNoises: false,
  });
});
