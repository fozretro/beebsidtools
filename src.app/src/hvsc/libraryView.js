/**
 * Folder tree + search/sort for an indexed HVSC (SIDPLAY-style browser).
 */

export const SEARCH_FIELDS = ["all", "title", "author", "released", "filename"];

export const FIELD_LABELS = {
  all: "All",
  title: "Title",
  author: "Author",
  released: "Released",
  filename: "Filename",
};

export function parentPath(path) {
  const i = String(path || "").lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function pathParts(path) {
  return String(path || "")
    .split("/")
    .filter(Boolean);
}

export function breadcrumbParts(rootName, folder) {
  const root = rootName || "HVSC";
  return [{ path: "", name: root }, ...pathParts(folder).map((name, i, parts) => ({
    path: parts.slice(0, i + 1).join("/"),
    name,
  }))];
}

export function matchesQuery(row, query, field = "all") {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return true;
  const title = String(row.title || "").toLowerCase();
  const author = String(row.author || "").toLowerCase();
  const released = String(row.release || "").toLowerCase();
  const filename = String(row.name || row.path || "").toLowerCase();
  switch (field) {
    case "title":
      return title.includes(q);
    case "author":
      return author.includes(q);
    case "released":
      return released.includes(q);
    case "filename":
      return filename.includes(q);
    default:
      return (
        title.includes(q) ||
        author.includes(q) ||
        released.includes(q) ||
        filename.includes(q)
      );
  }
}

export function inFolder(path, folder) {
  if (!folder) return true;
  return path === folder || path.startsWith(`${folder}/`);
}

export function filterTunes(tunes, { query = "", field = "all", folder = "" } = {}) {
  return tunes.filter(
    (row) => inFolder(row.path, folder) && matchesQuery(row, query, field),
  );
}

export function collectFolders(tunes) {
  const folders = new Map();
  folders.set("", { path: "", name: "", parent: null });
  for (const t of tunes) {
    const parts = pathParts(t.path);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      const parent = acc;
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      if (!folders.has(acc)) {
        folders.set(acc, { path: acc, name: parts[i], parent });
      }
    }
  }
  return folders;
}

export function childFolders(folders, parent) {
  return [...folders.values()]
    .filter((f) => f.path && f.parent === parent)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function filesInFolder(tunes, folder) {
  return tunes.filter((t) => parentPath(t.path) === folder);
}

function rowValue(row, key) {
  if (row.kind === "folder") {
    if (key === "path") return row.path;
    return row.name;
  }
  switch (key) {
    case "author":
      return row.author || "";
    case "released":
      return row.release || "";
    case "path":
      return row.path || "";
    default:
      return row.title || row.name || "";
  }
}

export function compareRows(a, b, key = "title", dir = "asc") {
  const mul = dir === "desc" ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
  return (
    rowValue(a, key).localeCompare(rowValue(b, key), undefined, {
      sensitivity: "base",
    }) * mul
  );
}

export function defaultExpanded(tunes) {
  const folders = collectFolders(tunes);
  return new Set(childFolders(folders, "").map((f) => f.path));
}

/**
 * Visible rows: folder tree when the query is empty, flat matches when searching.
 * @param {object[]} tunes
 * @param {Set<string>} expanded
 * @param {{ query?: string, field?: string, folder?: string, sortKey?: string, sortDir?: string }} [opts]
 */
export function visibleRows(tunes, expanded, opts = {}) {
  const {
    query = "",
    field = "all",
    folder = "",
    sortKey = "title",
    sortDir = "asc",
  } = opts;
  const scoped = folder ? tunes.filter((t) => inFolder(t.path, folder)) : tunes;

  if (String(query).trim()) {
    return filterTunes(scoped, { query, field }).map((t) => ({
      kind: "tune",
      depth: 0,
      ...t,
    })).sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }

  const folders = collectFolders(scoped);
  const rows = [];

  function addFiles(parent, depth) {
    const files = filesInFolder(scoped, parent).map((t) => ({
      kind: "tune",
      depth,
      ...t,
    }));
    files.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    rows.push(...files);
  }

  function walk(parent, depth) {
    const kids = childFolders(folders, parent);
    kids.sort((a, b) =>
      compareRows(
        { kind: "folder", name: a.name, path: a.path },
        { kind: "folder", name: b.name, path: b.path },
        sortKey,
        sortDir,
      ),
    );
    for (const f of kids) {
      const isOpen = expanded.has(f.path);
      rows.push({
        kind: "folder",
        depth,
        path: f.path,
        name: f.name,
        expanded: isOpen,
      });
      if (isOpen) {
        walk(f.path, depth + 1);
        addFiles(f.path, depth + 1);
      }
    }
  }

  walk(folder, 0);
  addFiles(folder, 0);
  return rows;
}
