/**
 * INC/DEC on SID registers must RMW the $0720 shadow, not $FCxx
 * (C64 data-bus trick — Fred Gray Firefly).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ripSid, SID_SHADOW, SID_BASE } from "../src/lib/ripsid.js";

function tinySid(payload) {
  const header = Buffer.alloc(0x7e, 0);
  header.write("PSID", 0);
  header.writeUInt16BE(2, 4);
  header.writeUInt16BE(0x7e, 6);
  header.writeUInt16BE(0x1a00, 8);
  header.writeUInt16BE(0x1a00, 10);
  header.writeUInt16BE(0x1a00, 12);
  header.writeUInt16BE(1, 14);
  header.writeUInt16BE(1, 16);
  header.write("Test", 0x16);
  return Buffer.concat([header, payload]);
}

test("ripSid trampolines INC $FC24 through the shadow", () => {
  const payload = Buffer.from([0xee, 0x24, 0xfc, 0x60]);
  const { bbcSid, vars } = ripSid(tinySid(payload), "----DOM:BRK:0000:ee\n");
  assert.ok(!vars.includes("Unknown opcode"), vars);
  assert.equal(bbcSid[8], 0x20, "INC replaced with JSR");
  const sh = SID_SHADOW + (0xfc24 - SID_BASE);
  const stub = bbcSid.subarray(8 + payload.length, 8 + payload.length + 16);
  assert.equal(stub[0], 0xee);
  assert.equal(stub[1], sh & 0xff);
  assert.equal(stub[2], sh >> 8);
  assert.ok(stub.includes(0x8d));
  const staAt = stub.indexOf(0x8d);
  assert.equal(stub[staAt + 1], 0x24);
  assert.equal(stub[staAt + 2], 0xfc);
});
