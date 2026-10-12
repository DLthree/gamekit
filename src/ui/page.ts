/**
 * A menu page: a title, a body that scrolls when the window is short, and a row of buttons that
 * stays in view (src/ui/page.css). The root is one of the page's screen elements (a `.panel`);
 * marked `data-page`, it is reached by the pad (src/ui/pad-nav.ts) whenever it shows.
 */
export interface Page {
  title: string;
  /** What the page shows; it scrolls inside the page when the window is too short. */
  body: readonly Node[];
  /** The page's actions (src/ui/button.ts `actionButton`); may be empty. */
  buttons: readonly HTMLButtonElement[];
}

/** Fills `root` with `page` and shows it. */
export function showPage(root: HTMLElement, page: Page): void {
  const title = document.createElement("h1");
  title.textContent = page.title;
  const body = document.createElement("div");
  body.className = "page-body";
  body.append(...page.body);
  const buttons = document.createElement("div");
  buttons.className = "page-buttons";
  buttons.append(...page.buttons);
  const shell = document.createElement("div");
  shell.className = "page";
  shell.append(title, body, buttons);
  root.dataset.page = "";
  root.replaceChildren(shell);
  root.hidden = false;
}

/** Hides and empties a page's root. */
export function hidePage(root: HTMLElement): void {
  root.hidden = true;
  root.replaceChildren();
}
