/**
 * The blocking error panel: a title and the lines naming file/field or scenario/tick. `onGrid`
 * adds a way back to the grid; it's null while content is invalid, which nothing may run on.
 */
export function showError(
  root: HTMLElement,
  title: string,
  lines: readonly string[],
  onGrid: (() => void) | null,
): void {
  const h = document.createElement("h1");
  h.textContent = title;
  const pre = document.createElement("pre");
  pre.textContent = lines.join("\n");
  const box = document.createElement("div");
  box.append(h, pre);
  if (onGrid !== null) {
    const grid = document.createElement("button");
    grid.id = "grid";
    grid.textContent = "Grid";
    grid.addEventListener("click", onGrid);
    box.append(grid);
  }
  root.replaceChildren(box);
  root.hidden = false;
}

export function hideError(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}
