import { expect, open, test } from "@e2e/fixtures";
import { BOT, CAST_SKILL, CELL } from "@/game/links";

test("a manual wave steps, casts and draws effects", async ({ page }) => {
  await open(page, `${CELL}&manual=1&agent=1`);
  await expect(page.locator("#game canvas")).toBeVisible();
  const s = await page.evaluate(() => window.__game?.step(240));
  expect(s?.tick).toBe(240);
  await page.evaluate(() =>
    window.__game?.step(1, { moveX: 0, moveY: 0, cast: { slot: "cast", aim: { x: 1, y: 0 } } }),
  );
  await page.evaluate(() => window.__game?.step(120));
  const casts = await page.evaluate(
    (skill) => window.__game?.events(0).filter((e) => e.t === "cast" && e.skill === skill).length,
    CAST_SKILL,
  );
  expect(casts).toBe(1);
  expect((await page.evaluate(() => window.__game?.fx()))?.total).toBeGreaterThan(0);
});

test(`the ${BOT} bot finishes the wave with kills`, async ({ page }) => {
  await open(page, `${CELL}&manual=1&bot=${BOT}`);
  await page.evaluate(() => window.__game?.step(20_000));
  const report = await page.evaluate(() => window.__game?.report());
  expect(report?.outcome).not.toBeNull();
  expect(report?.kills).toBeGreaterThan(0);
});

test("effects drain to zero once spawning stops", async ({ page }) => {
  await open(page, `${CELL}&manual=1&bot=${BOT}`);
  await page.evaluate(() => window.__game?.step(600));
  await page.evaluate(() => window.__game?.stopFx());
  await page.evaluate(() => window.__game?.step(600));
  expect((await page.evaluate(() => window.__game?.fx()))?.total).toBe(0);
});

test("a real-time wave advances about 60 ticks a second", async ({ page }) => {
  await open(page, CELL);
  const t0 = await page.evaluate(() => window.__game?.state().tick ?? 0);
  await page.waitForTimeout(1000);
  const t1 = await page.evaluate(() => window.__game?.state().tick ?? 0);
  expect(t1 - t0).toBeGreaterThan(40);
  expect(t1 - t0).toBeLessThan(75);
});

test("a hidden page leaves the wave paused behind the overlay; Resume continues without a catch-up burst", async ({
  page,
}) => {
  await open(page, CELL);
  await page.waitForFunction(() => (window.__game?.state().tick ?? 0) > 30);
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "hidden", { value: h, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await setHidden(true);
  const t0 = await page.evaluate(() => window.__game?.state().tick ?? 0);
  await setHidden(false);
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator("#pause h1")).toHaveText("Paused");
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__game?.state().tick ?? 0)).toBe(t0);
  expect(await page.evaluate(() => window.__game?.flow())).toMatchObject({
    screen: "wave",
    paused: true,
  });
  await page.locator("#resume").click();
  await expect(page.locator("#pause")).toBeHidden();
  // Wait until the tick has moved past the threshold that proves play resumed, then check the
  // upper bound right away: a condition wait can express "ticks are advancing again" but not
  // "no catch-up burst happened", since a burst would also make the lower bound true sooner.
  await page.waitForFunction(({ t0, min }) => (window.__game?.state().tick ?? 0) - t0 > min, {
    t0,
    min: 15,
  });
  const t1 = await page.evaluate(() => window.__game?.state().tick ?? 0);
  // Half a second of play is about 30 ticks; catching up the paused second would add 60.
  expect(t1 - t0).toBeLessThan(50);
});

test("the HUD pause button and the agent handle pause; Grid leaves for the picker", async ({
  page,
}) => {
  await open(page, CELL);
  await page.locator("#pause-button").click();
  await expect(page.locator("#pause")).toBeVisible();
  await page.evaluate(() => window.__game?.resume());
  await expect(page.locator("#pause")).toBeHidden();
  await page.evaluate(() => window.__game?.pause());
  expect(await page.evaluate(() => window.__game?.flow())).toMatchObject({ paused: true });
  await page.locator("#pause #grid").click();
  await page.waitForFunction(() => window.__game?.flow().screen === "picker");
  await expect(page.locator("#pause")).toBeHidden();
});
