import { expect, open, test } from "@e2e/fixtures";
import { HERO } from "@/game/links";

/** Threat 3's boss spawns at wave second 50; an unkillable wizard waits for it standing still. */
const CELL = `char=${HERO}&build=1&threat=3&o=characters/${HERO}.stats.life=1000000`;

test("the threat 3 boss telegraphs its slam, then the slam resolves", async ({ page }) => {
  await open(page, `${CELL}&manual=1&agent=1`);
  // Step in batches shorter than the slam's 60-tick warning, so the first slam is still warning
  // when the stepping stops.
  const slamTick = await page.waitForFunction(() => {
    const g = window.__game;
    if (g === undefined) return false;
    g.step(20);
    const slam = g.events(0).find((e) => e.t === "volumeStarted" && e.vfx === "slam");
    return slam === undefined ? false : slam.tick;
  });
  const since = (await slamTick.jsonValue()) as number;
  const bosses = await page.evaluate(
    () => window.__game?.events(0).filter((e) => e.t === "spawned" && e.role === "boss").length,
  );
  expect(bosses).toBe(1);
  await page.waitForFunction(() => (window.__game?.telegraphs() ?? 0) >= 1);

  await page.waitForFunction((since) => {
    const g = window.__game;
    if (g === undefined) return false;
    g.step(10);
    return g.events(since).some((e) => e.t === "telegraphResolved" && e.vfx === "slam");
  }, since);
  await expect(page.locator("#error")).toBeHidden();
  expect(await page.evaluate(() => window.__game?.flow().screen)).toBe("wave");
  expect(
    (await page.evaluate(() => window.__game?.report()))?.telegraphs.started,
  ).toBeGreaterThanOrEqual(1);
});
