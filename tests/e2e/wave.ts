import type { Page } from "@playwright/test";

/** The example's wave helpers for its specs (the kit's fixtures are in tests/e2e/fixtures.ts). */

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
