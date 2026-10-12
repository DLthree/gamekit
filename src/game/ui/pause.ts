import { actionButton } from "@/ui/button";
import { showPage } from "@/ui/page";

/** The pause overlay over the frozen arena: Resume, or back to the grid. */
export function showPause(root: HTMLElement, onResume: () => void, onGrid: () => void): void {
  showPage(root, {
    title: "Paused",
    body: [],
    buttons: [actionButton("resume", "Resume", onResume), actionButton("grid", "Grid", onGrid)],
  });
}
