const DB_NAME = "beebsid-hvsc";
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase>|null} */
let opening = null;

function openDb() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("tunes")) {
        const tunes = db.createObjectStore("tunes", { keyPath: "path" });
        tunes.createIndex("author", "author", { unique: false });
        tunes.createIndex("title", "title", { unique: false });
      }
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function idbReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadLibrary() {
  const db = await openDb();
  const meta = await idbReq(db.transaction("meta").objectStore("meta").get("library"));
  const handle = await idbReq(
    db.transaction("handles").objectStore("handles").get("root"),
  );
  const tunes = await idbReq(
    db.transaction("tunes").objectStore("tunes").getAll(),
  );
  return {
    meta: meta ?? null,
    handle: handle ?? null,
    tunes: Array.isArray(tunes) ? tunes : [],
  };
}

export async function saveLibrary({ meta, handle, tunes }) {
  const db = await openDb();
  const tx = db.transaction(["meta", "handles", "tunes"], "readwrite");
  tx.objectStore("tunes").clear();
  for (const t of tunes) tx.objectStore("tunes").put(t);
  tx.objectStore("meta").put(meta, "library");
  if (handle) tx.objectStore("handles").put(handle, "root");
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearLibrary() {
  const db = await openDb();
  const tx = db.transaction(["meta", "handles", "tunes"], "readwrite");
  tx.objectStore("tunes").clear();
  tx.objectStore("meta").delete("library");
  tx.objectStore("handles").delete("root");
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
