/** A button on the error panel that leads somewhere playable. */
export interface ErrorExit {
  id: string;
  label: string;
  onClick: () => void;
}

/**
 * The blocking error panel: a title and the lines naming file/field or scenario/tick. `exit`
 * adds a way out; it's null while content is invalid, which nothing may run on.
 */
export function showError(
  root: HTMLElement,
  title: string,
  lines: readonly string[],
  exit: ErrorExit | null,
): void {
  const h = document.createElement("h1");
  h.textContent = title;
  const pre = document.createElement("pre");
  pre.textContent = lines.join("\n");
  const box = document.createElement("div");
  box.append(h, pre);
  if (exit !== null) {
    const button = document.createElement("button");
    button.id = exit.id;
    button.textContent = exit.label;
    button.addEventListener("click", exit.onClick);
    box.append(button);
  }
  root.replaceChildren(box);
  root.hidden = false;
}

export function hideError(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}
