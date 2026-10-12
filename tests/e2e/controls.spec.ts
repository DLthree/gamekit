import { buttonCenter, expect, open, playing, test, touch, waitForCast } from "@e2e/fixtures";
import type { Page } from "@playwright/test";
import { CELL } from "@/game/links";

const REAL = `${CELL}&agent=1`;

async function tick(page: Page): Promise<number> {
  return (await page.evaluate(() => window.__game?.state().tick)) ?? 0;
}

/** Waits until the player's x passes `x` (the stick is moving them right). */
async function playerPast(page: Page, x: number): Promise<number> {
  await page.waitForFunction((x) => (window.__game?.state().player.x ?? 0) > x, x);
  return (await page.evaluate(() => window.__game?.state().player.x)) ?? 0;
}

test("absolute aim casts from the player toward the finger", async ({ page, errors }) => {
  await open(page, `${REAL}&aim=absolute`);
  await playing(page);
  const b = await buttonCenter(page);
  const p = await page.evaluate(() => window.__game?.playerCss());
  if (p === undefined) throw new Error("no player position");
  const since = await tick(page);
  await touch(page, 2, "pointerdown", b.x, b.y);
  await touch(page, 2, "pointermove", b.x - 60, b.y - 60);
  await touch(page, 2, "pointermove", p.x, p.y - 160);
  await touch(page, 2, "pointerup", p.x, p.y - 160);
  const aim = await waitForCast(page, "fireball", since);
  expect(aim.ay).toBeLessThan(-0.95);
  expect(errors).toEqual([]);
});

test("the skill button and knobs take their sizes from look/controls.json", async ({ page }) => {
  await open(
    page,
    `${REAL}&aim=relative&o=look/controls.buttonRadius=60&o=look/controls.knobRadius=25`,
  );
  // 2 × 60 plus the 3 px border on each side.
  expect((await page.locator("#skill-button").boundingBox())?.width).toBe(126);
  expect((await page.locator("#skill-knob").boundingBox())?.width).toBe(50);
});

test("relative aim casts along the drag from the button's centre", async ({ page }) => {
  await open(page, REAL);
  await playing(page);
  const b = await buttonCenter(page);
  const since = await tick(page);
  await touch(page, 2, "pointerdown", b.x, b.y);
  await touch(page, 2, "pointermove", b.x - 100, b.y);
  await touch(page, 2, "pointerup", b.x - 100, b.y);
  const aim = await waitForCast(page, "fireball", since);
  expect(aim.ax).toBeLessThan(-0.95);
});

test("a tap quick-casts with finite positions", async ({ page }) => {
  await open(page, REAL);
  await playing(page);
  const b = await buttonCenter(page);
  const since = await tick(page);
  await touch(page, 2, "pointerdown", b.x, b.y);
  await touch(page, 2, "pointerup", b.x, b.y);
  const aim = await waitForCast(page, "fireball", since);
  expect(Math.hypot(aim.ax, aim.ay)).toBeCloseTo(1, 5);
  const volumes = await page.evaluate(() => window.__game?.state().volumes ?? []);
  for (const v of volumes) expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
});

test("dragging back onto the button cancels", async ({ page }) => {
  await open(page, REAL);
  await playing(page);
  const b = await buttonCenter(page);
  const since = await tick(page);
  await touch(page, 2, "pointerdown", b.x, b.y);
  await touch(page, 2, "pointermove", b.x - 140, b.y - 40);
  await touch(page, 2, "pointermove", b.x, b.y);
  // The armed cancel shows as the ring in look/controls.json's cancelColor (palette cancel-red).
  await expect(page.locator("#skill-button")).toHaveCSS("border-top-color", "rgb(179, 38, 30)");
  await touch(page, 2, "pointerup", b.x, b.y);
  // A cast lands on the next playing tick; 30 ticks later none has, so the drag-back cancelled.
  const up = await tick(page);
  await page.waitForFunction((t) => (window.__game?.state().tick ?? 0) >= t + 30, up);
  const casts = await page.evaluate(
    (s) => window.__game?.events(s).filter((e) => e.t === "cast" && e.skill === "fireball").length,
    since,
  );
  expect(casts).toBe(0);
});

test("two thumbs: the stick moves the player while the other thumb aims and casts", async ({
  page,
}) => {
  await open(page, `${REAL}&aim=absolute`);
  await playing(page);
  const b = await buttonCenter(page);
  const x0 = (await page.evaluate(() => window.__game?.state().player.x)) ?? 0;
  await touch(page, 1, "pointerdown", 90, b.y - 40);
  await touch(page, 1, "pointermove", 160, b.y - 40);
  const since = await tick(page);
  await touch(page, 2, "pointerdown", b.x, b.y);
  await touch(page, 2, "pointermove", b.x - 40, b.y - 120);
  const x1 = await playerPast(page, x0 + 10);
  const p = await page.evaluate(() => window.__game?.playerCss());
  if (p === undefined) throw new Error("no player position");
  await touch(page, 2, "pointermove", p.x, p.y - 160);
  await touch(page, 2, "pointerup", p.x, p.y - 160);
  const aim = await waitForCast(page, "fireball", since);
  expect(aim.ay).toBeLessThan(-0.9);
  await playerPast(page, x1);
  await touch(page, 1, "pointerup", 160, b.y - 40);
});

test("rotating mid-wave resizes the canvas and absolute aim still follows the finger", async ({
  page,
}) => {
  await open(page, `${REAL}&aim=absolute`);
  await playing(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    const r = document.querySelector("#game canvas")?.getBoundingClientRect();
    return Math.round(r?.width ?? 0) === 844 && Math.round(r?.height ?? 0) === 390;
  });
  const b = await buttonCenter(page);
  const p = await page.evaluate(() => window.__game?.playerCss());
  if (p === undefined) throw new Error("no player position");
  expect(p.x).toBeGreaterThan(0);
  expect(p.x).toBeLessThan(844);
  const since = await tick(page);
  await touch(page, 2, "pointerdown", b.x, b.y);
  await touch(page, 2, "pointermove", b.x - 80, b.y - 80);
  await touch(page, 2, "pointermove", p.x + 180, p.y);
  await touch(page, 2, "pointerup", p.x + 180, p.y);
  const aim = await waitForCast(page, "fireball", since);
  expect(aim.ax).toBeGreaterThan(0.95);
});
