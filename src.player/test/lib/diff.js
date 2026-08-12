import { readFileSync } from "node:fs";

export function firstDiffLines(aPath, bPath, limit = 20) {
  const A = readFileSync(aPath);
  const B = readFileSync(bPath);
  const n = Math.min(A.length, B.length);
  const lines = [];
  for (let i = 0; i < n && lines.length < limit; i++) {
    if (A[i] !== B[i]) lines.push(`${i + 1} ${A[i]} ${B[i]}`);
  }
  if (A.length !== B.length && lines.length < limit) {
    lines.push(`length ${A.length} vs ${B.length}`);
  }
  return lines;
}
