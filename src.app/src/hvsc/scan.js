import { Buffer } from "buffer";
import { parsePsid } from "beebsidtools-src-create";

const HEADER_BYTES = 0x80;

export function canPickDirectory() {
  return typeof window.showDirectoryPicker === "function";
}

export async function pickHvscDirectory() {
  if (!canPickDirectory()) {
    throw new Error(
      "This browser cannot keep a folder handle. Use Chrome or Edge, or drop the HVSC folder.",
    );
  }
  return window.showDirectoryPicker({ id: "beebsid-hvsc", mode: "read" });
}

export async function ensureDirectoryPermission(handle) {
  if (!handle?.queryPermission) return false;
  const opts = { mode: "read" };
  let perm = await handle.queryPermission(opts);
  if (perm === "prompt" && handle.requestPermission) {
    perm = await handle.requestPermission(opts);
  }
  return perm === "granted";
}

/**
 * @param {FileSystemDirectoryHandle} root
 * @param {string} relPath
 */
export async function readHvscFile(root, relPath) {
  const parts = relPath.split("/").filter(Boolean);
  let dir = root;
  for (const name of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(name);
  }
  const file = await (await dir.getFileHandle(parts.at(-1))).getFile();
  return file;
}

/**
 * @param {FileSystemDirectoryHandle} root
 * @param {(info: { done: number, path: string }) => void} [onProgress]
 */
export async function indexDirectory(root, onProgress) {
  const tunes = [];
  let done = 0;

  async function walk(dir, prefix) {
    for await (const [name, handle] of dir.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        await walk(handle, path);
        continue;
      }
      if (!name.toLowerCase().endsWith(".sid")) continue;
      done += 1;
      if (onProgress && done % 25 === 0) onProgress({ done, path });
      try {
        const file = await handle.getFile();
        const header = Buffer.from(await file.slice(0, HEADER_BYTES).arrayBuffer());
        const psid = parsePsid(header);
        tunes.push({
          path,
          name,
          title: psid.title || name.replace(/\.sid$/i, ""),
          author: psid.author || "",
          release: psid.release || "",
          magic: psid.magic,
          songs: psid.numsongs,
          play: psid.playaddr,
          size: file.size,
        });
      } catch {
        /* skip unreadable / not a SID */
      }
    }
  }

  await walk(root, "");
  onProgress?.({ done, path: "" });
  return {
    meta: {
      rootName: root.name,
      count: tunes.length,
      indexedAt: Date.now(),
    },
    tunes,
  };
}

export async function indexDroppedFiles(fileList, onProgress) {
  const sids = [...fileList].filter((f) => /\.sid$/i.test(f.name));
  const tunes = [];
  let done = 0;
  for (const file of sids) {
    done += 1;
    const path = file.webkitRelativePath || file.name;
    if (onProgress && done % 25 === 0) onProgress({ done, path });
    try {
      const header = Buffer.from(await file.slice(0, HEADER_BYTES).arrayBuffer());
      const psid = parsePsid(header);
      tunes.push({
        path,
        name: file.name,
        title: psid.title || file.name.replace(/\.sid$/i, ""),
        author: psid.author || "",
        release: psid.release || "",
        magic: psid.magic,
        songs: psid.numsongs,
        play: psid.playaddr,
        size: file.size,
        file,
      });
    } catch {
      /* skip */
    }
  }
  onProgress?.({ done, path: "" });
  return {
    meta: {
      rootName: inferRootName(sids) || "HVSC",
      count: tunes.length,
      indexedAt: Date.now(),
      ephemeral: true,
    },
    tunes,
  };
}

function inferRootName(files) {
  const first = files[0]?.webkitRelativePath;
  if (!first) return "";
  return first.split("/")[0] || "";
}
