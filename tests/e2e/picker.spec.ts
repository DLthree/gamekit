import { expect, fingerTap, mouseClick, open, test } from "@e2e/fixtures";
import type { Page } from "@playwright/test";
import { BOT, CAST_SKILL, CELL, HERO } from "@/game/links";

async function screen(page: Page, s: string): Promise<void> {
  await page.waitForFunction((want) => window.__game?.flow().screen === want, s);
}

test("/ shows the grid; only cells with a build tier and threat file are tappable", async ({
  page,
}) => {
  await open(page, "", "picker");
  // Every wizard build tier has all three threat files now; which cells a missing file disables
  // is covered by the picker model's unit test.
  await expect(page.locator("#picker button:enabled")).toHaveCount(9);
  await expect(page.locator("#picker button:disabled")).toHaveCount(0);
  await expect(page.locator('#picker button[data-build="1"][data-threat="3"]')).toBeEnabled();
});

test("a tapped cell starts and writes its address; a reload lands on it again", async ({
  page,
}) => {
  await open(page, "manual=1", "picker");
  await mouseClick(page, '#picker button[data-build="2"][data-threat="1"]');
  await screen(page, "wave");
  expect(new URL(page.url()).search).toBe(
    `?char=${HERO}&build=2&threat=1&manual=1&telemetry=0&seed=7`,
  );
  await page.reload();
  await screen(page, "wave");
  const build = await page.evaluate(() => {
    const f = window.__game?.flow();
    return f?.screen === "wave" ? f.scenario.buildTier : null;
  });
  expect(build).toBe(2);
});

test(`the result's Grid button returns to the ${HERO}'s grid, and a reload stays there`, async ({
  page,
}) => {
  await open(page, `${CELL}&manual=1&bot=${BOT}`, "wave");
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await screen(page, "result");
  await mouseClick(page, "#grid");
  await screen(page, "picker");
  expect(new URL(page.url()).search).toBe(`?char=${HERO}&manual=1&bot=${BOT}&telemetry=0&seed=7`);
  await page.reload();
  await screen(page, "picker");
  await expect(page.locator("#picker h1")).toHaveText(HERO);
});

test("an unknown character in the URL shows the error panel", async ({ page }) => {
  await open(page, "char=nobody", "error");
  await expect(page.locator("#error")).toContainText(
    `no character nobody; content/characters has ${HERO}`,
  );
});

test("the error panel's Grid button leads to a playable cell", async ({ page }) => {
  await open(page, `char=${HERO}&build=9&threat=1`, "error");
  await mouseClick(page, "#grid");
  await screen(page, "picker");
  await mouseClick(page, '#picker button[data-build="1"][data-threat="1"]');
  await screen(page, "wave");
});

test("a malformed address's error panel still offers the Grid", async ({ page }) => {
  await open(page, `char=${HERO}&build=2`, "error");
  await expect(page.locator("#error h1")).toHaveText("Address");
  await mouseClick(page, "#grid");
  await screen(page, "picker");
  await mouseClick(page, '#picker button[data-build="1"][data-threat="1"]');
  await screen(page, "wave");
});

test("a content error has no Grid button", async ({ page }) => {
  await open(page, `${CELL}&o=skills/${CAST_SKILL}.stats.area=-5`, "error");
  await expect(page.locator("#grid")).toHaveCount(0);
});

test("the last-played cell is highlighted on return to the grid", async ({ page }) => {
  await open(page, `${CELL}&manual=1&bot=${BOT}`, "wave");
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await screen(page, "result");
  await mouseClick(page, "#grid");
  await screen(page, "picker");
  await expect(page.locator('#picker button[data-build="1"][data-threat="1"]')).toHaveClass(
    /\blast\b/,
  );
  await expect(page.locator('#picker button[data-build="2"][data-threat="1"]')).not.toHaveClass(
    /\blast\b/,
  );
});

test("in a short window the wheel reaches the grid's last row, and a click starts it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 420 });
  await open(page, "manual=1", "picker");
  await mouseClick(page, '#picker button[data-build="3"][data-threat="3"]');
  await screen(page, "wave");
});

test("@touch a finger taps a cell and its wave starts", async ({ page }) => {
  await open(page, "manual=1", "picker");
  await fingerTap(page, '#picker button[data-build="3"][data-threat="3"]');
  await screen(page, "wave");
});
