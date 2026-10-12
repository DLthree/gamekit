import { expect, mouseClick, open, test } from "@e2e/fixtures";
import { BOT, CAST_SKILL, CELL, HERO, SWITCH } from "@/game/links";

test("a finished wave shows the result, and retry starts run 2 at tick 0", async ({ page }) => {
  await open(page, `${CELL}&manual=1&bot=${BOT}`, "wave");
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  await expect(page.locator("#result h1")).toHaveText(/Survived|Defeated/);
  await expect(page.locator("#result")).toContainText("Wizard · build 1 · threat 1");
  await mouseClick(page, "#retry");
  await page.waitForFunction(() => window.__game?.flow().screen === "wave");
  const flow = await page.evaluate(() => window.__game?.flow());
  expect(flow).toMatchObject({ screen: "wave", run: 2 });
  expect(await page.evaluate(() => window.__game?.state().tick)).toBe(0);
});

test("without seed= every run gets a fresh seed, shown with a repro URL that replays it", async ({
  page,
}) => {
  // Not open(): it pins seed=7 for every other spec.
  await page.goto(`/?${CELL}&manual=1&bot=${BOT}&telemetry=0`);
  await page.waitForFunction(() => window.__game?.flow().screen === "wave");
  const seedOf = () =>
    page.evaluate(() => {
      const f = window.__game?.flow();
      if (f === undefined || !("scenario" in f) || f.scenario === null) throw new Error("no run");
      return f.scenario.seed;
    });
  const first = await seedOf();
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  await expect(page.locator("#result .repro")).toContainText(`seed=${first}`);
  const repro = await page.locator("#result .repro").innerText();
  expect(repro).toContain(`&seed=${first}&aim=relative&bot=${BOT}&manual=1`);
  await mouseClick(page, "#retry");
  await page.waitForFunction(() => window.__game?.flow().screen === "wave");
  expect(await seedOf()).not.toBe(first);
  await page.goto(repro);
  await page.waitForFunction(() => window.__game?.flow().screen === "wave");
  expect(await seedOf()).toBe(first);
});

test("the HUD shows life, time and kills during a wave", async ({ page }) => {
  await open(page, `${CELL}&manual=1`, "wave");
  await page.evaluate(() => window.__game?.frames(120));
  await expect(page.locator("#hud .stats")).toContainText("kills");
});

test("an unauthored build tier names the builds file", async ({ page }) => {
  await open(page, `char=${HERO}&build=9&threat=1`, "error");
  await expect(page.locator("#error")).toContainText(
    `builds/${HERO}.json has 3 tiers; build tier 9 is not authored`,
  );
});

test("a bad override names the file and field", async ({ page }) => {
  await open(page, `${CELL}&o=skills/${CAST_SKILL}.stats.area=-5`, "error");
  await expect(page.locator("#error")).toContainText(`skills/${CAST_SKILL}.json`);
  await expect(page.locator("#error")).toContainText("stats.area");
});

test("touchmove scrolls inside the error panel but is still blocked on the page", async ({
  page,
}) => {
  await open(page, `${CELL}&o=skills/${CAST_SKILL}.stats.area=-5`, "error");
  const insideDefaultPrevented = await page.evaluate(() => {
    const target = document.querySelector("#error pre");
    if (target === null) throw new Error("no #error pre");
    const ev = new Event("touchmove", { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(insideDefaultPrevented).toBe(false);
  const outsideDefaultPrevented = await page.evaluate(() => {
    const ev = new Event("touchmove", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(outsideDefaultPrevented).toBe(true);
});

test("ui=0 hides the HUD and the skill button for screenshots", async ({ page }) => {
  await open(page, `${CELL}&manual=1&ui=0`, "wave");
  await expect(page.locator("#hud")).toBeHidden();
  await expect(page.locator("#skill-button")).toBeHidden();
});

test("on= turns feature switches on, and an unknown one stops at the address", async ({ page }) => {
  await open(page, `${CELL}&on=${SWITCH}`, "wave");
  expect(await page.evaluate(() => window.__game?.on())).toEqual([SWITCH]);
  await open(page, `${CELL}&on=nope`, "error");
  await expect(page.locator("#error")).toContainText('on=nope: no switch "nope"');
});
