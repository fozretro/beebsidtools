/**
 * Disc Creator Help text from repo-root releases/<version>.md
 * (same files as GitHub Release notes).
 */

const files = import.meta.glob("../../releases/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

function parseVersion(path) {
  const m = String(path).match(/(\d+\.\d+\.\d+)\.md$/);
  return m ? m[1] : null;
}

function compareSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Light markdown → log-panel text (GitHub still gets the raw .md). */
export function notesToHelpText(md) {
  return String(md)
    .replace(/\r\n/g, "\n")
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .trim();
}

export function loadReleases() {
  return Object.entries(files)
    .map(([path, body]) => ({
      version: parseVersion(path),
      body: String(body ?? ""),
    }))
    .filter((r) => r.version)
    .sort((a, b) => compareSemver(b.version, a.version));
}

export function formatReleaseNotes(releases = loadReleases()) {
  if (releases.length === 0) return "";
  const blocks = releases.map(
    (r) => `v${r.version}\n${notesToHelpText(r.body)}`,
  );
  return ["Release notes", "", blocks.join("\n\n")].join("\n");
}
