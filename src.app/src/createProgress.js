const PHASE_HEAD = {
  load: "Loading",
  convert: null,
  pack: "Pack",
  preview: "Preview",
};

/**
 * `current` is the step in progress (1-based). The bar is how many steps
 * have finished, so the last preview clip is not 100% until `done`.
 *
 * @param {{ phase?: string, current?: number, total?: number, label?: string, done?: boolean } | null} p
 * @returns {{ percent: number, text: string }}
 */
export function formatCreateProgress(p) {
  if (!p) return { percent: 0, text: "" };
  const total = p.total > 0 ? p.total : 1;
  const current = Math.max(0, Number(p.current) || 0);
  const completed = p.done ? total : Math.max(0, current - 1);
  const percent = Math.min(100, Math.round((completed / total) * 100));
  let name;
  if (p.phase === "convert" && p.label) name = String(p.label);
  else if (p.phase === "preview" && p.label && p.label !== "preview") {
    name = String(p.label);
  } else {
    name =
      PHASE_HEAD[p.phase] ??
      (p.label && String(p.label).trim()) ??
      p.phase ??
      "Create";
  }
  const shownStep = p.done ? total : current;
  return { percent, text: `${name}  ${shownStep}/${total}` };
}
