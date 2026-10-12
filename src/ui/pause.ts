/** The pause overlay over the frozen arena: Resume, or back to the grid. */
export function showPause(root: HTMLElement, onResume: () => void, onGrid: () => void): void {
  const h = document.createElement("h1");
  h.textContent = "Paused";
  const resume = document.createElement("button");
  resume.id = "resume";
  resume.textContent = "Resume";
  resume.addEventListener("click", onResume);
  const grid = document.createElement("button");
  grid.id = "grid";
  grid.textContent = "Grid";
  grid.addEventListener("click", onGrid);
  const box = document.createElement("div");
  box.append(h, resume, grid);
  root.replaceChildren(box);
  root.hidden = false;
}

export function hidePause(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}
