/**
 * Minimal in-memory Acorn DFS SSD builder (80-track single-sided).
 * Layout matches tools/dfs-0.4 (catalogue in sectors 0–1, ≤31 files).
 */

const SECTOR = 256;
const MAX_FILES = 31;

/**
 * @param {number} [tracks=80]
 */
export function createDisc(tracks = 80) {
  const sectors = tracks * 10;
  const image = Buffer.alloc(sectors * SECTOR, 0);
  // Sector 0 filename area starts as spaces (dfs_create).
  image.fill(0x20, 0, SECTOR);
  // Title end (sector 1 bytes 0–3) spaces.
  image.fill(0x20, SECTOR, SECTOR + 4);
  // Sector count in opt4 low bits + seccount_l
  image[SECTOR + 6] = (sectors >> 8) & 0x03; // opt4 low: size bits 8–9
  image[SECTOR + 7] = sectors & 0xff;
  return {
    image,
    sectors,
    nextFree: 2,
    files: /** @type {Array<{dir:string,name:string,load:number,exec:number,len:number,sec:number,locked:boolean}>} */ ([]),
  };
}

function catCount(disc) {
  return disc.files.length;
}

function parseBbcName(fileName) {
  let dir = "$";
  let rest = fileName;
  if (fileName.length >= 2 && fileName[1] === ".") {
    dir = fileName[0].toUpperCase();
    rest = fileName.slice(2);
  }
  const name = (rest.toUpperCase() + "       ").slice(0, 7);
  return { dir, name, key: `${dir}.${name}` };
}

function writeCatalogue(disc) {
  const { image, files } = disc;
  // Clear name + addr tables (keep title / size / opt4 / writes).
  image.fill(0x20, 8, SECTOR);
  image.fill(0, SECTOR + 8, SECTOR * 2);

  image[SECTOR + 5] = files.length << 3; // cat_count

  // DFS catalogues are stored in reverse sector order.
  const ordered = [...files].sort((a, b) => b.sec - a.sec);
  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i];
    const nameOff = 8 + i * 8;
    const addrOff = SECTOR + 8 + i * 8;
    image[nameOff] = f.name.charCodeAt(0);
    image[nameOff + 1] = f.name.charCodeAt(1);
    image[nameOff + 2] = f.name.charCodeAt(2);
    image[nameOff + 3] = f.name.charCodeAt(3);
    image[nameOff + 4] = f.name.charCodeAt(4);
    image[nameOff + 5] = f.name.charCodeAt(5);
    image[nameOff + 6] = f.name.charCodeAt(6);
    image[nameOff + 7] = f.dir.charCodeAt(0) | (f.locked ? 0x80 : 0);

    const load = f.load >>> 0;
    const exec = f.exec >>> 0;
    const len = f.len >>> 0;
    const sec = f.sec >>> 0;
    image[addrOff] = load & 0xff;
    image[addrOff + 1] = (load >> 8) & 0xff;
    image[addrOff + 2] = exec & 0xff;
    image[addrOff + 3] = (exec >> 8) & 0xff;
    image[addrOff + 4] = len & 0xff;
    image[addrOff + 5] = (len >> 8) & 0xff;
    image[addrOff + 6] =
      ((sec & 0x0300) >> 8) |
      ((load & 0x30000) >> 14) |
      ((len & 0x30000) >> 12) |
      ((exec & 0x30000) >> 10);
    image[addrOff + 7] = sec & 0xff;
  }
}

/**
 * @param {ReturnType<typeof createDisc>} disc
 * @param {string} fileName  e.g. "S.00HEADO" or "sidplay"
 * @param {Buffer|Uint8Array} data
 * @param {{ load?: number, exec?: number, locked?: boolean }} [opts]
 */
export function addFile(disc, fileName, data, opts = {}) {
  if (catCount(disc) >= MAX_FILES) {
    throw new Error("DFS catalogue full (31 files)");
  }
  const { dir, name, key } = parseBbcName(fileName);
  if (disc.files.some((f) => `${f.dir}.${f.name}` === key)) {
    throw new Error(`Duplicate DFS name: ${dir}.${name.trim()}`);
  }

  const buf = Buffer.from(data);
  const sectorsNeeded = buf.length === 0 ? 1 : Math.ceil(buf.length / SECTOR);
  if (disc.nextFree + sectorsNeeded > disc.sectors) {
    throw new Error("DFS disc full");
  }

  const sec = disc.nextFree;
  const load = opts.load ?? 0;
  const exec = opts.exec ?? 0xffffff;
  buf.copy(disc.image, sec * SECTOR);
  disc.nextFree += sectorsNeeded;
  disc.files.push({
    dir,
    name,
    load,
    exec,
    len: buf.length,
    sec,
    locked: !!opts.locked,
  });
  // no_writes++
  disc.image[SECTOR + 4] = (disc.image[SECTOR + 4] + 1) & 0xff;
  writeCatalogue(disc);
}

/** @param {ReturnType<typeof createDisc>} disc @param {string} title */
export function setTitle(disc, title) {
  const buf = Buffer.alloc(12, 0x20);
  Buffer.from(String(title ?? "").slice(0, 12), "ascii").copy(buf);
  buf.copy(disc.image, 0, 0, 8);
  buf.copy(disc.image, SECTOR, 8, 12);
}

/** @param {ReturnType<typeof createDisc>} disc @param {number} opt4 */
export function setOpt4(disc, opt4) {
  disc.image[SECTOR + 6] =
    (disc.image[SECTOR + 6] & 0x03) | ((opt4 & 0x3) << 4);
}

/** @param {ReturnType<typeof createDisc>} disc @returns {Buffer} */
export function toBuffer(disc) {
  writeCatalogue(disc);
  return Buffer.from(disc.image);
}

export const DFS = {
  SECTOR,
  MAX_FILES,
  createDisc,
  addFile,
  setTitle,
  setOpt4,
  toBuffer,
};
