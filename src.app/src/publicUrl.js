/** Site-root-relative public asset (works at `/` and GitHub Pages `/beebsidtools/`). */
export function publicUrl(path) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${String(path).replace(/^\//, "")}`;
}
