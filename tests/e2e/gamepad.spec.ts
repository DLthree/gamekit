import { expect, open, test } from "@e2e/fixtures";
import { playing, waitForCast } from "@e2e/wave";
import type { Page } from "@playwright/test";
import { CAST_SKILL, CELL } from "@/game/links";
import { PAD, type PadButton } from "@/input/gamepad";

// A scripted standard pad stands in for the Gamepad API (src/input/gamepad.ts), set from the
// test through window.__pad.

declare global {
  interface Window {
    __pad: { axes: number[]; down: number[] };
  }
}

async function plugPad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__pad = { axes: [0, 0, 0, 0], down: [] };
    const pad = () => ({
      id: "fake standard pad",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: performance.now(),
      axes: window.__pad.axes,
      buttons: Array.from({ length: 17 }, (_, i) => {
        const on = window.__pad.down.includes(i);
        return { pressed: on, touched: on, value: on ? 1 : 0 };
      }),
    });
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad()] });
  });
}

async function setPad(page: Page, down: PadButton[], axes = [0, 0, 0, 0]): Promise<void> {
  const ids = down.map((b) => PAD[b]);
  await page.evaluate(
    ({ ids, axes }) => {
      window.__pad = { axes, down: ids };
    },
    { ids, axes },
  );
}

/** Presses `b` long enough for a few polled frames, then lets go. */
async function press(page: Page, b: PadButton, axes = [0, 0, 0, 0]): Promise<void> {
  await setPad(page, [b], axes);
  await page.waitForTimeout(120);
  await setPad(page, [], axes);
  await page.waitForTimeout(60);
}

const flow = (page: Page) => page.evaluate(() => window.__game?.flow());
const focusedIn = (page: Page) =>
  page.evaluate(() => {
    const e = document.activeElement;
    return e instanceof HTMLElement && e !== document.body
      ? `${e.parentElement?.closest("[id]")?.id ?? "?"} ${e.id || e.getAttribute("aria-label")}`
      : "none";
  });

test("a pad picks a cell, moves, aims and casts, and pauses and resumes", async ({ page }) => {
  await plugPad(page);
  await open(page, "agent=1", "picker");
  // A with nothing focused focuses the first cell; the D-pad walks the grid; A picks.
  await press(page, "a");
  await expect(page.locator("body")).toHaveAttribute("data-input", "pad");
  const first = await focusedIn(page);
  await press(page, "right");
  const second = await focusedIn(page);
  expect(first).toMatch(/^picker /);
  expect(second).toMatch(/^picker /);
  expect(second).not.toBe(first);
  await press(page, "left");
  await press(page, "a");
  await page.waitForFunction(() => window.__game?.flow().screen === "wave");
  await playing(page);

  // The left stick moves.
  const x0 = (await page.evaluate(() => window.__game?.state().player.x)) ?? 0;
  await setPad(page, [], [1, 0, 0, 0]);
  await page.waitForFunction((x0) => (window.__game?.state().player.x ?? 0) > x0 + 20, x0);
  await setPad(page, []);

  // The right stick aims; A casts that way.
  const since = (await page.evaluate(() => window.__game?.state().tick)) ?? 0;
  const up = [0, 0, 0, -1];
  await setPad(page, [], up);
  await page.waitForTimeout(60);
  await press(page, "a", up);
  const aim = await waitForCast(page, CAST_SKILL, since);
  expect(aim.ay).toBeLessThan(-0.9);
  await setPad(page, []);

  // Start pauses; the D-pad moves focus along the pause's buttons; B resumes.
  await press(page, "start");
  expect(await flow(page)).toMatchObject({ screen: "wave", paused: true });
  const seen: string[] = [];
  for (const d of ["right", "right", "left"] as const) {
    await press(page, d);
    seen.push(await focusedIn(page));
  }
  for (const s of seen) expect(s).toMatch(/^pause /);
  expect(new Set(seen).size).toBeGreaterThan(1);
  await press(page, "b");
  expect(await flow(page)).toMatchObject({ screen: "wave", paused: false });
  // Escape is the keyboard's Start.
  await page.keyboard.press("Escape");
  expect(await flow(page)).toMatchObject({ screen: "wave", paused: true });
  await page.keyboard.press("Escape");
  expect(await flow(page)).toMatchObject({ screen: "wave", paused: false });
});

test("on the result a pad's A retries and B goes to the grid, with hints shown", async ({
  page,
}) => {
  await plugPad(page);
  await open(page, `${CELL}&manual=1`, "wave");
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  await press(page, "a");
  expect(await flow(page)).toMatchObject({ screen: "wave", run: 2 });
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  await expect(page.locator('#result [data-pad="b"] > .pad-hint')).toBeVisible();
  await press(page, "b");
  expect(await flow(page)).toMatchObject({ screen: "picker" });
});
