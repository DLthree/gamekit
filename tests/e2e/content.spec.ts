import { CELL, editContent, expect, hotUpdated, open, restoreContent, test } from "@e2e/fixtures";

test.afterEach(() => restoreContent());

test("@content a half-saved JSON file stops the game and names the file (Review Focus 4)", async ({
  page,
}) => {
  await open(page, CELL);
  await editContent("skills/fireball.json", (t) => t.slice(0, Math.floor(t.length / 2)));
  await page.waitForFunction(() => window.__game?.flow().screen === "error");
  await expect(page.locator("#error")).toContainText("skills/fireball.json");
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  restoreContent();
  await page.waitForFunction(() => window.__game?.flow().screen === "wave");
});

test("@content a schema error names file and field; fixing it restarts the wave", async ({
  page,
}) => {
  await open(page, CELL);
  await editContent("rules/feel.json", (t) => t.replace(/"hitStopS": [0-9.]+/, '"hitStopS": -1'));
  await page.waitForFunction(() => window.__game?.flow().screen === "error");
  await expect(page.locator("#error")).toContainText("rules/feel.json › hitStopS");
  restoreContent();
  await page.waitForFunction(() => window.__game?.flow().screen === "wave");
});

test("@content a sim edit restarts the wave; hot=keep keeps it", async ({ page }) => {
  await open(page, `${CELL}&manual=1`);
  await page.evaluate(() => window.__game?.step(300));
  await editContent("threats/tier-1.json", (t) =>
    t.replace(/"durationS": (\d+)/, (_, d) => `"durationS": ${Number(d) + 1}`),
  );
  await page.waitForFunction(() => {
    const f = window.__game?.flow();
    return f?.screen === "wave" && f.run === 2;
  });
  expect(await page.evaluate(() => window.__game?.state().tick)).toBe(0);

  restoreContent();
  // bot=kite finishes the wave itself, so retry() (only valid from the result screen) has
  // something to act on; this proves hot=keep's new content actually reaches the next run,
  // not just that the current one was left alone.
  await open(page, `${CELL}&manual=1&bot=kite&hot=keep`);
  const before = await page.evaluate(() => window.__game?.state().durationTicks);
  await page.evaluate(() => window.__game?.step(20_000));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  const reloaded = hotUpdated(page);
  await editContent("threats/tier-1.json", (t) =>
    t.replace(/"durationS": (\d+)/, (_, d) => `"durationS": ${Number(d) + 1}`),
  );
  await reloaded;
  // Still on the result screen: hot=keep deferred the sim reload instead of restarting.
  expect(await page.evaluate(() => window.__game?.flow().screen)).toBe("result");
  await page.evaluate(() => window.__game?.retry());
  await page.waitForFunction(() => {
    const f = window.__game?.flow();
    return f?.screen === "wave" && f.run === 2;
  });
  const after = await page.evaluate(() => window.__game?.state().durationTicks);
  expect(after).toBe((before ?? 0) + 60);
});

test("@content a look edit swaps in without restarting", async ({ page }) => {
  await open(page, `${CELL}&manual=1`);
  await page.evaluate(() => window.__game?.step(300));
  const reloaded = hotUpdated(page);
  await editContent("look/controls.json", (t) =>
    t.replace(/"stickRadius": (\d+)/, (_, r) => `"stickRadius": ${Number(r) + 4}`),
  );
  await reloaded;
  expect(await page.evaluate(() => window.__game?.flow())).toMatchObject({
    screen: "wave",
    run: 1,
  });
  expect(await page.evaluate(() => window.__game?.state().tick)).toBe(300);
  // The stick radius (56 → 60 in content/look/controls.json) is baked into #stick-base's
  // size when Controls builds its TouchStick; a live effect, not a stale one, sets it.
  const width = await page.locator("#stick-base").evaluate((el) => el.style.width);
  expect(width).toBe("120px");
});
