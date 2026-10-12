import { expect, open, test } from "@e2e/fixtures";
import type { Page } from "@playwright/test";

// Deeds (the example's achievements): listed under the grid, earned by a wave's result, kept in
// the save (localStorage on the web, a file in the desktop shell) across a reload.

const WIN = "char=wizard&build=3&threat=1&o=characters/wizard.stats.life=1000000&manual=1";

function rowBoxes(page: Page) {
  return page
    .locator("#picker .deeds li")
    .evaluateAll((lis) =>
      lis.map((li) => [li.getBoundingClientRect().y, li.getBoundingClientRect().height]),
    );
}

test("a won wave earns First Light, shown on the grid and kept across a reload", async ({
  page,
}) => {
  await open(page, "", "picker");
  await expect(page.locator("#picker .deeds li")).toHaveCount(3);
  await expect(page.locator("#picker .deeds li.earned")).toHaveCount(0);
  const before = await rowBoxes(page);

  await open(page, WIN);
  await page.evaluate(() => window.__game?.step(20_000));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  await page.locator("#grid").click();
  await page.waitForFunction(() => window.__game?.flow().screen === "picker");
  await expect(page.locator('#picker .deeds li[data-deed="first-light"]')).toHaveClass(/earned/);
  // Earning a deed fills its mark; no row moves.
  expect(await rowBoxes(page)).toEqual(before);

  await page.reload();
  await page.waitForFunction(() => window.__game?.flow().screen === "picker");
  await expect(page.locator("#picker .deeds li.earned")).toHaveCount(1);
});

test("a save the game can't read is the Save panel, with no way on", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("deeds", '{"version": 1, "ea'));
  await open(page, "", "error");
  await expect(page.locator("#error h1")).toHaveText("Save");
  await expect(page.locator("#error")).toContainText("the deeds save is not JSON");
  await expect(page.locator("#error button")).toHaveCount(0);
});
