/**
 * Node ripsid must byte-match committed .bbcsid goldens.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ripSid } from "../src/lib/ripsid.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "golden");

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

const cases = [
  {
    name: "Head_Over_Heels",
    sid: join(GOLDEN, "Head_Over_Heels.patched.sid"),
    brk: join(GOLDEN, "Head_Over_Heels.brk"),
    golden: join(GOLDEN, "Head_Over_Heels.bbcsid"),
  },
];

for (const c of cases) {
  test(`rip golden: ${c.name}`, () => {
    assert.ok(existsSync(c.sid) && existsSync(c.brk) && existsSync(c.golden));
    const { bbcSid } = ripSid(readFileSync(c.sid), readFileSync(c.brk, "utf8"));
    const golden = readFileSync(c.golden);
    const at = firstDiff(bbcSid, golden);
    if (at >= 0) {
      assert.fail(
        `${c.name}: differ at +${at} ` +
          `(got ${bbcSid.length}B, golden ${golden.length}B) ` +
          `got ${bbcSid.subarray(at, at + 8).toString("hex")} ` +
          `want ${golden.subarray(at, at + 8).toString("hex")}`,
      );
    }
  });
}
