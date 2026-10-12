import { actionButton } from "@/ui/button";

/** A button on the error panel that leads somewhere playable. */
export interface ErrorExit {
  id: string;
  label: string;
  onClick: () => void;
}

/** What a player reads up front in the release build; the raw lines stay one press away. */
export const PLAYER_SUMMARY = "Something went wrong.";

/**
 * The blocking error panel: a title and the lines naming file/field or scenario/tick. `exit`
 * adds a way out; it's null while content is invalid, which nothing may run on. For `players`
 * (the release build) the lines (file paths, stack frames) sit behind a collapsed Details,
 * under a plain sentence: never hidden, just not the first thing a player reads.
 */
export function showError(
  root: HTMLElement,
  title: string,
  lines: readonly string[],
  exit: ErrorExit | null,
  players = false,
): void {
  const h = document.createElement("h1");
  h.textContent = title;
  const pre = document.createElement("pre");
  pre.textContent = lines.join("\n");
  const box = document.createElement("div");
  box.append(h);
  if (players) {
    const p = document.createElement("p");
    p.textContent = PLAYER_SUMMARY;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Details";
    details.append(summary, pre);
    box.append(p, details);
  } else box.append(pre);
  if (exit !== null) {
    box.append(actionButton(exit.id, exit.label, exit.onClick));
  }
  root.replaceChildren(box);
  root.hidden = false;
}

export function hideError(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}
