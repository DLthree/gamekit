import { readFileSync, writeFileSync } from "node:fs";
import { test as base, expect, type Page } from "@playwright/test";

/** Every test records uncaught page errors and console errors, and fails if any appear. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Opens a URL and waits until the flow reaches `screen`. Appends seed=7 and telemetry=0 unless
 * the query sets them, so ordinary e2e runs don't write telemetry logs; specs that want
 * telemetry (tests/e2e/telemetry.spec.ts) opt in explicitly with telemetry=1.
 */
export async function open(page: Page, query: string, screen: string): Promise<void> {
  const params = new URLSearchParams(query);
  if (!params.has("telemetry")) params.set("telemetry", "0");
  // A run with no seed= is random; tests pin one so every run is the same.
  if (!params.has("seed")) params.set("seed", "7");
  await page.goto(`/?${params.toString()}`);
  await page.waitForFunction((s) => window.__game?.flow().screen === s, screen);
}

const E2E_CONTENT = ".e2e/content";
const originals = new Map<string, string>();

/** Rewrites a file in the e2e server's content copy; restoreContent() puts it back. */
export async function editContent(file: string, edit: (text: string) => string): Promise<void> {
  const path = `${E2E_CONTENT}/${file}`;
  const text = readFileSync(path, "utf8");
  if (!originals.has(path)) originals.set(path, text);
  writeFileSync(path, edit(text));
}

/**
 * Resolves once Vite has hot-reloaded the content loader (its client logs "hot updated" after the
 * accept callback ran), so a spec can check what a content edit did or didn't change without a
 * fixed wait. Call it before editContent() so the message can't be missed.
 */
export async function hotUpdated(page: Page): Promise<void> {
  await page.waitForEvent("console", (m) => m.text().includes("hot updated: /src/content/load.ts"));
}

/** Restores every file editContent() touched. Edits only ever land in `.e2e/content` (rsync'd
 * from the repo's content/ before the e2e server starts, and gitignored), never content/
 * itself; content specs still call this in afterEach so a failing test doesn't leave that
 * scratch copy modified for the next run. */
export function restoreContent(): void {
  for (const [path, text] of originals) writeFileSync(path, text);
  originals.clear();
}

/** One finger's pointer event at CSS (x, y), dispatched where a real touch would land. */
export async function touch(
  page: Page,
  id: number,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
): Promise<void> {
  await page.evaluate(
    ({ id, type, x, y }) => {
      const target = document.elementFromPoint(x, y) ?? document.body;
      const init = {
        pointerId: id,
        pointerType: "touch",
        isPrimary: id === 1,
        clientX: x,
        clientY: y,
        bubbles: true,
      };
      target.dispatchEvent(new PointerEvent(type, init));
    },
    { id, type, x, y },
  );
}

/**
 * Brings `selector` into view the way a player can: the mouse wheel on desktop, a swipe on a
 * phone (never scrollIntoView, which also scrolls `overflow: hidden` boxes a player can't), and
 * returns the point a pointer or finger lands on. Fails when the element stays out of the window
 * or another element covers that point.
 */
async function reach(
  page: Page,
  selector: string,
  by: "wheel" | "swipe",
): Promise<{ x: number; y: number }> {
  const el = page.locator(selector);
  await expect(el, selector).toBeVisible();
  await expect(el, selector).toBeEnabled();
  const view = page.viewportSize();
  if (view === null) throw new Error("reach: the page has no viewport size");
  for (let tries = 0; ; tries++) {
    const box = await el.boundingBox();
    if (box === null) throw new Error(`${selector}: no box`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (y >= 0 && y <= view.height && x >= 0 && x <= view.width) {
      const top = await page.evaluate(
        ({ selector, x, y }) => {
          const hit = document.elementFromPoint(x, y);
          const want = document.querySelector(selector);
          if (want !== null && hit !== null && want.contains(hit)) return null;
          return hit === null
            ? "nothing"
            : `${hit.tagName.toLowerCase()}#${hit.id}.${hit.className}`;
        },
        { selector, x, y },
      );
      expect(top, `${selector} is covered at its centre`).toBeNull();
      return { x, y };
    }
    if (tries === 5) throw new Error(`${selector} is out of the window and a ${by} can't reach it`);
    const dy = y - view.height / 2;
    if (by === "wheel") {
      await page.mouse.move(view.width / 2, view.height / 2);
      await page.mouse.wheel(0, dy);
    } else await swipe(page, selector, dy);
    await page.waitForTimeout(50);
  }
}

/**
 * A finger's swipe by `dy` over `selector`: mobile WebKit takes no synthetic touch drags, so this
 * scrolls the element's ancestors the way a swipe would, only those a finger can scroll
 * (overflow auto or scroll), never an `overflow: hidden` one.
 */
async function swipe(page: Page, selector: string, dy: number): Promise<void> {
  await page.evaluate(
    ({ selector, dy }) => {
      for (let e = document.querySelector(selector)?.parentElement; e; e = e.parentElement) {
        const o = getComputedStyle(e).overflowY;
        if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight) {
          e.scrollTop += dy;
          return;
        }
      }
    },
    { selector, dy },
  );
}

/** A real mouse click at `selector`'s centre, as a desktop player makes it (see reach()). */
export async function mouseClick(page: Page, selector: string): Promise<void> {
  const { x, y } = await reach(page, selector, "wheel");
  await page.mouse.click(x, y);
}

/** A real touch tap at `selector`'s centre, as a phone player makes it (see reach()). */
export async function fingerTap(page: Page, selector: string): Promise<void> {
  const { x, y } = await reach(page, selector, "swipe");
  await page.touchscreen.tap(x, y);
}
