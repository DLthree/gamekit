import { expect, open, test } from "@e2e/fixtures";
import { STAGE } from "@/game/links";

test("a stage opens with dev=1: its actors stand at their places and it keeps its address", async ({
  page,
}) => {
  await open(page, `stage=${STAGE}&dev=1&manual=1&agent=1`);
  await page.evaluate(() => window.__game?.frames(2));
  const spawned = await page.evaluate(() =>
    window.__game?.events().filter((e) => e.t === "spawned" && e.team === "enemy"),
  );
  expect(spawned).toMatchObject([{ def: "boss-dragon", x: 220, y: 0 }]);
  expect(new URL(page.url()).searchParams.get("stage")).toBe(STAGE);
  await expect(page.locator("#hud .stats")).toBeVisible();
});

test("a stage without dev=1 names the missing flag", async ({ page }) => {
  await open(page, `stage=${STAGE}`, "error");
  await expect(page.locator("#error")).toContainText(`stage=${STAGE} needs dev=1`);
});
