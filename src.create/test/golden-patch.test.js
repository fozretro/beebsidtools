/**
 * Registry patches must byte-match committed patched.sid goldens.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPatches,
  resolvePatch,
  sha256Hex,
} from "../src/lib/patchRegistry.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "golden");

test("patch registry loads head-over-heels, robocop, robocop-3", () => {
  const patches = getPatches();
  const ids = patches.map((p) => p.id).sort();
  assert.deepEqual(ids, ["head-over-heels", "robocop", "robocop-3"]);
});

test("robocop pre-patch sets play=$254f", () => {
  const orig = join(GOLDEN, "RoboCop.sid");
  assert.ok(existsSync(orig));
  const patches = getPatches();
  const selected = resolvePatch({
    patches,
    patchFlag: true,
    inputSha256: sha256Hex(readFileSync(orig)),
    phase: "pre",
  });
  assert.equal(selected.id, "robocop");
  assert.equal(selected.phase, "pre");
  const { patchedSid, reloc } = selected.patch(readFileSync(orig));
  assert.equal((patchedSid[0x0c] << 8) | patchedSid[0x0d], 0x254f);
  assert.equal(reloc?.initCycles, 2_000_000);
});

test("patch auto-select by original SID hash: Head Over Heels", async () => {
  const orig = join(GOLDEN, "Head_Over_Heels.sid");
  const rel = join(GOLDEN, "Head_Over_Heels.rel.sid");
  const golden = join(GOLDEN, "Head_Over_Heels.patched.sid");
  assert.ok(existsSync(orig) && existsSync(rel) && existsSync(golden));

  const patches = getPatches();
  const selected = resolvePatch({
    patches,
    patchFlag: true,
    inputSha256: sha256Hex(readFileSync(orig)),
    phase: "post",
  });
  assert.equal(selected.id, "head-over-heels");

  const { patchedSid } = selected.patch(readFileSync(rel));
  assert.ok(Buffer.from(patchedSid).equals(readFileSync(golden)));
});

test("patch auto-select by relocated hash: RoboCop 3", async () => {
  const orig = join(GOLDEN, "RoboCop_3.sid");
  const rel = join(GOLDEN, "RoboCop_3.rel.sid");
  const golden = join(GOLDEN, "RoboCop_3.patched.sid");
  assert.ok(existsSync(orig) && existsSync(rel) && existsSync(golden));

  const patches = getPatches();
  const selected = resolvePatch({
    patches,
    patchFlag: true,
    relocSha256: sha256Hex(readFileSync(rel)),
    phase: "post",
  });
  assert.equal(selected.id, "robocop-3");

  const { patchedSid } = selected.patch(readFileSync(rel));
  assert.ok(Buffer.from(patchedSid).equals(readFileSync(golden)));
});

test("patch force by id", async () => {
  const patches = getPatches();
  const p = resolvePatch({ patches, patchFlag: "robocop-3" });
  assert.equal(p.id, "robocop-3");
});

test("patch auto optional returns null when no hash match", async () => {
  const patches = getPatches();
  assert.equal(
    resolvePatch({
      patches,
      patchFlag: true,
      inputSha256: "0".repeat(64),
      optional: true,
    }),
    null,
  );
});

test("patch auto strict throws when no hash match", async () => {
  const patches = getPatches();
  assert.throws(
    () =>
      resolvePatch({
        patches,
        patchFlag: true,
        inputSha256: "0".repeat(64),
        optional: false,
      }),
    /No (pre|post )?patch matches/,
  );
});
