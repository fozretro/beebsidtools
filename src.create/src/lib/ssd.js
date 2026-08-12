/**
 * Pack BeebSID tunes + player assets into a bootable DFS SSD (in-memory).
 */

import { addFile, createDisc, setOpt4, setTitle, toBuffer } from "./dfs.js";
import { buildBoot, buildMenu, dfsTuneName, titleFromStem } from "./menu.js";

/** Load / exec addresses used by SIDPLAY discs. */
export const SSD_ADDR = {
  tuneLoad: 0x19f8,
  tuneExec: 0x1a00,
  sidplayLoad: 0x6000,
  sidplayExec: 0x6000,
  sidpelkLoad: 0x4800,
  sidpelkExec: 0x4800,
  menuLoad: 0x7c00,
  hexLoad: 0x7c00,
};

/**
 * @typedef {object} SsdTune
 * @property {Buffer|Uint8Array} bbcSid
 * @property {string} [baseName]
 * @property {string} [title]
 * @property {string} [dfsName]  override auto S.nnXXXXX
 */

/**
 * @typedef {object} SsdAssets
 * @property {Buffer|Uint8Array} sidplay   sidpl.o
 * @property {Buffer|Uint8Array} [sidpelk] sidpelk.o (optional)
 * @property {Buffer|Uint8Array} [hex]     F.HEX / hexdigs.bin
 */

/**
 * @param {object} opts
 * @param {SsdTune[]} opts.tunes
 * @param {SsdAssets} opts.assets
 * @param {string} [opts.title='BEEBSID']
 * @param {boolean} [opts.includeSidpelk=false]
 * @param {number} [opts.tracks=80]
 * @returns {{ ssd: Buffer, menu: Buffer, catalogue: Array<{name:string,load:number,exec:number,len:number}> }}
 */
export function packBeebSidSsd(opts) {
  const tunes = opts.tunes ?? [];
  if (!tunes.length) throw new Error("packBeebSidSsd: no tunes");
  if (!opts.assets?.sidplay) throw new Error("packBeebSidSsd: assets.sidplay required");

  const includeSidpelk = !!opts.includeSidpelk && !!opts.assets.sidpelk;
  const overhead =
    1 /* sidplay */ +
    1 /* menu */ +
    (opts.assets.hex ? 1 : 0) +
    1 /* !boot */ +
    (includeSidpelk ? 1 : 0);
  if (tunes.length + overhead > 31) {
    throw new Error(
      `Too many catalogue entries: ${tunes.length} tunes + ${overhead} overhead > 31`,
    );
  }

  const menuEntries = tunes.map((t, i) => {
    const baseName = t.baseName ?? `TUNE${i}`;
    const dfsName = t.dfsName ?? dfsTuneName(i, baseName);
    const title = (t.title && t.title.trim()) || titleFromStem(baseName);
    return { dfsName, title, bbcSid: Buffer.from(t.bbcSid) };
  });

  const menu = buildMenu(menuEntries);
  const boot = buildBoot();
  const disc = createDisc(opts.tracks ?? 80);

  for (const e of menuEntries) {
    addFile(disc, e.dfsName, e.bbcSid, {
      load: SSD_ADDR.tuneLoad,
      exec: SSD_ADDR.tuneExec,
    });
  }

  addFile(disc, "sidplay", opts.assets.sidplay, {
    load: SSD_ADDR.sidplayLoad,
    exec: SSD_ADDR.sidplayExec,
  });

  if (includeSidpelk) {
    addFile(disc, "sidpelk", opts.assets.sidpelk, {
      load: SSD_ADDR.sidpelkLoad,
      exec: SSD_ADDR.sidpelkExec,
    });
  }

  addFile(disc, "M.MENU", menu, {
    load: SSD_ADDR.menuLoad,
    exec: 0,
  });

  if (opts.assets.hex) {
    addFile(disc, "F.HEX", opts.assets.hex, {
      load: SSD_ADDR.hexLoad,
      exec: 0,
    });
  }

  addFile(disc, "!BOOT", boot);

  setOpt4(disc, 3);
  setTitle(disc, opts.title ?? "BEEBSID");

  const ssd = toBuffer(disc);
  const catalogue = [...disc.files]
    .sort((a, b) => b.sec - a.sec)
    .map((f) => ({
      name: `${f.dir}.${f.name.trim()}`,
      load: f.load,
      exec: f.exec,
      len: f.len,
      sector: f.sec,
    }));

  return { ssd, menu, catalogue };
}
