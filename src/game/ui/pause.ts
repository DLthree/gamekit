import { actionButton } from "@/ui/button";

/** The pause overlay over the frozen arena: Resume, or back to the grid. */
export function showPause(root: HTMLElement, onResume: () => void, onGrid: () => void): void {
  const h = document.createElement("h1");
  h.textContent = "Paused";
  const box = document.createElement("div");
  box.append(h, actionButton("resume", "Resume", onResume), actionButton("grid", "Grid", onGrid));
  root.replaceChildren(box);
  root.hidden = false;
}

export function hidePause(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}
