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
export async function open(page: Page, query: string, screen = "wave"): Promise<void> {
  const params = new URLSearchParams(query);
  if (!params.has("telemetry")) params.set("telemetry", "0");
  // A run with no seed= is random; tests pin one so every run is the same wave.
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

/** Waits for the wave to be past its countdown. */
export async function playing(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.state().phase === "playing");
}

/** Waits for the player's next cast of `skill` at or after tick `since`; returns its aim. */
export async function waitForCast(
  page: Page,
  skill: string,
  since: number,
): Promise<{ ax: number; ay: number }> {
  const handle = await page.waitForFunction(
    ({ skill, since }) => {
      const e = window.__game
        ?.events(since)
        .find((it) => it.t === "cast" && it.team === "player" && it.skill === skill);
      return e !== undefined && e.t === "cast" ? { ax: e.ax, ay: e.ay } : false;
    },
    { skill, since },
  );
  const value = await handle.jsonValue();
  if (value === false) throw new Error(`no ${skill} cast found`);
  return value;
}

export async function buttonCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator("#skill-button").boundingBox();
  if (box === null) throw new Error("#skill-button is not visible");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
