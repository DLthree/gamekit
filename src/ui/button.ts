/**
 * A screen's action button (Retry, Resume, Grid): one look and one shape everywhere, so every
 * screen's actions read alike and the pad's hints (src/ui/pad-keys.ts) sit on them the same way.
 */
export function actionButton(id: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.id = id;
  b.type = "button";
  b.className = "act";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
