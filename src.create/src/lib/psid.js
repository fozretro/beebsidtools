/**
 * PSID/RSID header helpers (big-endian multi-byte fields).
 * Split out from Dominic Beesley's ripsid.c (sidplay-build / Stardot).
 */

export function readBe16(buf, offs) {
  return (buf[offs] << 8) | buf[offs + 1];
}

export function parsePsid(data) {
  if (data.length < 0x76) {
    throw new Error("Invalid SID file < 0x76 bytes long");
  }
  const magic = data.subarray(0, 4).toString("ascii");
  if (magic !== "PSID" && magic !== "RSID") {
    throw new Error("Not a sid file - invalid magic");
  }

  let dataoffs = readBe16(data, 0x06);
  let loadaddr = readBe16(data, 0x08);
  let payload = Buffer.from(data.subarray(dataoffs));
  let loadInData = false;

  if (loadaddr === 0) {
    loadaddr = payload[0] | (payload[1] << 8);
    payload = payload.subarray(2);
    loadInData = true;
  }

  return {
    magic,
    version: readBe16(data, 0x04),
    dataoffs,
    loadaddr,
    initaddr: readBe16(data, 0x0a),
    playaddr: readBe16(data, 0x0c),
    numsongs: readBe16(data, 0x0e),
    defsong: readBe16(data, 0x10),
    title: cStringField(data, 0x16, 32),
    author: cStringField(data, 0x36, 32),
    release: cStringField(data, 0x56, 32),
    header: Buffer.from(data.subarray(0, dataoffs)),
    payload,
    loadInData,
    raw: data,
  };
}

/** Match C printf %s on a fixed SID text field (stop at NUL, max len). */
export function cStringField(buf, offs, maxLen) {
  let end = offs;
  const limit = offs + maxLen;
  while (end < limit && buf[end] !== 0) end++;
  return buf.subarray(offs, end).toString("latin1");
}

export function rebuildPsid(header, payload, { loadInData, loadaddr }) {
  const out = [header];
  if (loadInData) {
    out.push(Buffer.from([loadaddr & 0xff, (loadaddr >> 8) & 0xff]));
  }
  out.push(payload);
  return Buffer.concat(out);
}
