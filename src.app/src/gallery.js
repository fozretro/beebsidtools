/** Display title from a disc stem (`mega-tel` → `Mega Tel`). */
export function galleryTitle(stem) {
  return String(stem || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * @param {string} text
 * @returns {{ discs: Array<{ id: string, title: string, file: string, png: string|null }> }}
 */
export function parseGalleryIndex(text) {
  const data = JSON.parse(text);
  const discs = Array.isArray(data?.discs) ? data.discs : [];
  return {
    discs: discs
      .filter((d) => d && typeof d.file === "string" && d.file)
      .map((d) => {
        const id = String(d.id || d.file.replace(/\.ssd$/i, ""));
        return {
          id,
          title: String(d.title || galleryTitle(id)),
          file: String(d.file),
          png: d.png ? String(d.png) : null,
        };
      }),
  };
}
