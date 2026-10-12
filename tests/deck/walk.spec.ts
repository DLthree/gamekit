import {
  activate,
  look,
  measure,
  plugPad,
  press,
  Report,
  realInputs,
  SHOTS_DIR,
  sticks,
} from "@deck/pad";
import { expect, type Page, test } from "@playwright/test";
import { HERO } from "@/game/links";

// The example game's Steam Deck walk, on demand only (`pnpm deck:check`): every step is a
// scripted pad press at the Deck's 1280×800; findings are collected (soft) so one walk reports
// them all, and each screen's shot lands in shots/deck-check/shots/.

let report: Report;
test.beforeEach(async ({ page }, info) => {
  report = new Report(info.title.split(":")[0].trim());
  await plugPad(page);
  page.on("pageerror", (e) => report.find("page", "page error", e.message));
});
test.afterEach(async ({ page }) => {
  const inputs = await realInputs(page).catch(() => ["(page gone)"]);
  if (inputs.length > 0) report.find("walk", "real input used", [...new Set(inputs)].join(", "));
  report.write();
  expect.soft(inputs, "the walk used no mouse, keyboard or touch").toEqual([]);
  expect
    .soft(
      report.texts.filter((t) => t.capPx < 9).map((t) => `${t.screen}: ${t.capPx}px "${t.text}"`),
      "no text under 9 px",
    )
    .toEqual([]);
  expect
    .soft(
      report.findings.map((f) => `${f.screen}: ${f.kind}: ${f.detail}`),
      "findings",
    )
    .toEqual([]);
});

async function open(page: Page, query: string, screen: string): Promise<void> {
  await page.goto(`/?telemetry=0&seed=7&${query}`);
  await page.waitForFunction((s) => window.__game?.flow().screen === s, screen);
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Dev-only text the release build leaves out: the result's replay address (empty in release) and
 * the error panel's raw lines (behind a closed Details in release).
 */
const DEV_ONLY = ["#result .repro", "#error pre"];

const screenNow = (page: Page) => page.evaluate(() => window.__game?.flow().screen);

test("walk: the grid, a fight, pause and back, by pad only", async ({ page }) => {
  await open(page, "agent=1", "picker");
  let map = await look(page, report, "grid");
  if (map.edges.size < 9) report.find("grid", "pad reach", `${map.edges.size} of 9 cells reached`);
  await activate(page, map, report, "grid", '#picker button[data-build="1"][data-threat="1"]');
  await page.waitForFunction(() => window.__game?.state().phase === "playing", null, {
    timeout: 20_000,
  });

  // The left stick moves; A casts.
  const x0 = await page.evaluate(() => window.__game?.state().player.x ?? 0);
  await sticks(page, [1, 0, 0, 0]);
  await page.waitForTimeout(600);
  await sticks(page, [0, 0, 0, 0]);
  if ((await page.evaluate(() => window.__game?.state().player.x ?? 0)) <= x0 + 10)
    report.find("fight", "control not operable", "the left stick didn't move the hero");
  const since = await page.evaluate(() => window.__game?.state().tick ?? 0);
  await press(page, "a", [0, 0, 0, -1]);
  await page.waitForTimeout(300);
  const cast = await page.evaluate(
    (since) =>
      window.__game?.events(since).some((e) => e.t === "cast" && e.team === "player") ?? false,
    since,
  );
  if (!cast) report.find("fight", "control not operable", "A cast nothing");
  await measure(page, report, "fight (HUD)");
  await page.screenshot({ path: `${SHOTS_DIR}/fight.png` });

  await press(page, "start");
  map = await look(page, report, "pause");
  await activate(page, map, report, "pause", "#resume");
  await page.waitForTimeout(300);
  if (
    await page.evaluate(() => {
      const f = window.__game?.flow();
      return f?.screen === "wave" && f.paused;
    })
  )
    report.find("pause", "control not operable", "Resume left the wave paused");
  await press(page, "start");
  map = await look(page, report, "pause (again)");
  await activate(page, map, report, "pause", "#grid");
  await page.waitForFunction(() => window.__game?.flow().screen === "picker");
});

test("result: a won wave's page and back to the grid, by pad", async ({ page }) => {
  await open(
    page,
    `char=${HERO}&build=3&threat=1&manual=1&o=characters/${HERO}.stats.life=1000000`,
    "wave",
  );
  await page.evaluate(() => window.__game?.act({ frames: 20_000 }));
  await page.waitForFunction(() => window.__game?.flow().screen === "result");
  const map = await look(page, report, "result", DEV_ONLY);
  await activate(page, map, report, "result", "#grid");
  await page.waitForTimeout(300);
  expect.soft(await screenNow(page)).toBe("picker");
});

test("error: the Address panel's way back, by pad", async ({ page }) => {
  await open(page, "char=nobody", "error");
  const map = await look(page, report, "error", DEV_ONLY);
  await activate(page, map, report, "error", "#grid");
  await page.waitForTimeout(300);
  expect.soft(await screenNow(page)).toBe("picker");
});
