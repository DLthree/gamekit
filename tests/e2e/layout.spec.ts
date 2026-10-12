import { expect, open, test } from "@e2e/fixtures";
import type { Page } from "@playwright/test";
import { CELL, HERO } from "@/game/links";

// Stable layout: a screen's elements keep their exact boxes whatever its state shows, so nothing
// a player reads or presses ever jumps. A longer text is cut, never reflowed.

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Each selector's box, by selector. */
function rects(page: Page, selectors: readonly string[]): Promise<Record<string, Box>> {
  return page.evaluate((sels) => {
    const out: Record<string, Box> = {};
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el === null) throw new Error(`no ${sel}`);
      const r = el.getBoundingClientRect();
      out[sel] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  }, selectors);
}

const HUD = ["#hud .life", "#hud .stats", "#pause-button", "#skill-button"];

test("the HUD keeps its boxes through the countdown, the fight, hurt, kills and pause", async ({
  page,
}) => {
  await open(page, `${CELL}&manual=1&agent=1`, "wave");
  // Stepped, the page draws nothing until its first frame: the HUD fills on frame 1.
  await page.evaluate(() => window.__game?.frames(1));
  const countdown = await rects(page, HUD);
  await page.evaluate(() => window.__game?.frames(240));
  const fighting = await rects(page, HUD);
  await page.waitForFunction(() => {
    const g = window.__game;
    if (g === undefined) return false;
    g.frames(60);
    const s = g.state();
    return s.player.hp < s.player.maxHp && g.report().kills > 0;
  });
  const hurt = await rects(page, HUD);
  await page.evaluate(() => window.__game?.pause());
  const paused = await rects(page, HUD);
  expect(fighting).toEqual(countdown);
  expect(hurt).toEqual(countdown);
  expect(paused).toEqual(countdown);
});

const RESULT = ["#result h1", "#result ul", "#result .repro", "#retry", "#grid"];

/** The result's boxes after the wave at `query`, and its title. */
async function resultOf(page: Page, query: string): Promise<[string, Record<string, Box>]> {
  await open(page, `${query}&manual=1`, "wave");
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  return [await page.locator("#result h1").innerText(), await rects(page, RESULT)];
}

test("the result keeps its boxes whether the wave was survived or lost", async ({ page }) => {
  const [won, survived] = await resultOf(
    page,
    `char=${HERO}&build=3&threat=3&o=characters/${HERO}.stats.life=1000000`,
  );
  const [lost, defeated] = await resultOf(page, CELL);
  expect([won, lost]).toEqual(["Survived", "Defeated"]);
  expect(survived).toEqual(defeated);
});
