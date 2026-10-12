import { expect, test } from "@e2e/fixtures";
import { reach, settleFrame } from "@scripts/game-page";
import type { KitHandle } from "@/agent/handle";

// The kit's time model on a turn-based page (tests/fixtures/turn): a tool reaches a moment by
// an action, then frames, and films the animation between turns frame by frame, as `pnpm film`.
test("a stepped page animates only on frames: film catches a move's slide mid-way", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/turn/index.html?manual=1");
  // The window's handle type is the example game's; the fixture's is only the kit's part.
  await page.waitForFunction(() => window.__game?.flow().screen === ("board" as string));
  const shownPx = () =>
    page.evaluate(() => {
      const g = window.__game as unknown as KitHandle;
      return (g.state() as { shownPx: number }).shownPx;
    });

  expect(await reach(page, ["move"], 10)).toBe(10);
  await settleFrame(page);
  const at10 = await page.screenshot();
  expect(await shownPx()).toBe(40);
  // Real time passes, the page doesn't.
  await page.waitForTimeout(300);
  expect(await shownPx()).toBe(40);

  await reach(page, [], 10);
  await settleFrame(page);
  const at20 = await page.screenshot();
  expect(await shownPx()).toBe(80);

  await reach(page, [], 10);
  expect(await shownPx()).toBe(120);
  expect(at20.equals(at10)).toBe(false);
  await expect(reach(page, ["jump"], 1)).rejects.toThrow(/expected "move"/);
});
