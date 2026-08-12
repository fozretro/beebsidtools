/**
 * Node-compatible assert shim for jsbeeb TestMachine in the browser.
 * Default export must be callable: assert(value, message).
 */

function fail(message) {
  throw new Error(message || "Assertion failed");
}

function assert(value, message) {
  if (!value) fail(message);
}

assert.ok = assert;
assert.equal = function equal(actual, expected, message) {
  if (actual !== expected) {
    fail(message || `${actual} !== ${expected}`);
  }
};
assert.strictEqual = function strictEqual(actual, expected, message) {
  assert.equal(actual, expected, message);
};
assert.deepEqual = function deepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(message || "deepEqual failed");
  }
};
assert.fail = fail;

export default assert;
export { assert, fail };
export const ok = assert.ok;
export const equal = assert.equal;
export const strictEqual = assert.strictEqual;
export const deepEqual = assert.deepEqual;
