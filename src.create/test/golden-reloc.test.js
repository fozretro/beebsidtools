/**
 * JS relocateSid must match committed reloc goldens (.rel.sid + .brk + exit).
 *
 * Refresh: npm run update:golden-reloc
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { relocateSid } from "../src/lib/sidreloc/index.js";
import { DEFAULT_RELOC_OPTS } from "../src/stages/relocate.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "golden");

function brkLines(text) {
  return (text || "")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("----DOM:BRK:"))
    .join("\n");
}

function firstDiff(a, b) {
  if (!a && !b) return -1;
  if (!a || !b) return 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

function sidCases() {
  const list = [];
  if (!existsSync(GOLDEN)) return list;
  for (const name of readdirSync(GOLDEN).sort()) {
    if (!name.endsWith(".sid")) continue;
    if (name.endsWith(".rel.sid") || name.endsWith(".patched.sid")) continue;
    list.push({ name: basename(name, ".sid"), path: join(GOLDEN, name) });
  }
  return list;
}

for (const c of sidCases()) {
  test(
    `reloc golden: ${c.name}`,
    { timeout: 120_000 },
    () => {
      const exitPath = join(GOLDEN, `${c.name}.reloc.exit`);
      assert.ok(
        existsSync(exitPath),
        `missing ${exitPath} — npm run update:golden-reloc`,
      );
      const wantExit = Number.parseInt(readFileSync(exitPath, "utf8").trim(), 10);
      const js = relocateSid(readFileSync(c.path), DEFAULT_RELOC_OPTS);

      assert.equal(
        js.exitCode,
        wantExit,
        `${c.name}: exitCode js=${js.exitCode} golden=${wantExit}`,
      );

      const wantOk = (wantExit & ~0x60) === 0;
      const relPath = join(GOLDEN, `${c.name}.rel.sid`);
      const brkPath = join(GOLDEN, `${c.name}.brk`);

      if (!wantOk) {
        assert.equal(
          js.relSid,
          null,
          `${c.name}: expected no relSid for failing reloc`,
        );
        assert.ok(!existsSync(relPath), `${c.name}: unexpected golden .rel.sid`);
        return;
      }

      assert.ok(existsSync(relPath), `missing ${relPath}`);
      assert.ok(existsSync(brkPath), `missing ${brkPath}`);
      assert.ok(js.relSid, `${c.name}: JS missing relSid`);

      const wantBrk = brkLines(readFileSync(brkPath, "utf8"));
      assert.equal(brkLines(js.brkText), wantBrk, `${c.name}: BRK lines differ`);

      const got = Buffer.from(js.relSid);
      const want = readFileSync(relPath);
      const at = firstDiff(got, want);
      if (at >= 0) {
        assert.fail(
          `${c.name}: .rel.sid differ at +${at} ` +
            `(js ${got.length}B, golden ${want.length}B)`,
        );
      }
    },
  );
}
