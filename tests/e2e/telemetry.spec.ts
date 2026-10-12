import { readFileSync } from "node:fs";
import { CELL, expect, open, test } from "@e2e/fixtures";

// biome-ignore lint/suspicious/noExplicitAny: raw JSON lines from the log, checked field by field
function logFor(seed: number): any[] {
  const file = `.e2e/telemetry/${new Date().toISOString().slice(0, 10)}.jsonl`;
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = text
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => JSON.parse(l));
  const session = lines.find((l) => l.kind === "load" && l.url.includes(`seed=${seed}`))?.session;
  return lines.filter((l) => l.session === session);
}

const kinds = (seed: number) => logFor(seed).map((l) => l.kind);

test("telemetry=1 logs the load and the wave's report", async ({ page }) => {
  const seed = 10_000 + Math.floor(Math.random() * 80_000);
  await open(page, `${CELL}&seed=${seed}&manual=1&bot=kite&telemetry=1`);
  await page.evaluate(() => window.__game?.step(20_000));
  await expect.poll(() => kinds(seed)).toEqual(expect.arrayContaining(["load", "wave"]));
  const [load, wave] = ["load", "wave"].map((k) => logFor(seed).find((l) => l.kind === k));
  const commit = expect.stringMatching(/[0-9a-f]{7,}(-dirty)?$/);
  expect(load).toMatchObject({ commit, options: { bot: "kite", aim: "relative" } });
  expect(wave).toMatchObject({
    commit,
    scenario: { character: "wizard", seed },
    options: { bot: "kite", manual: true },
    sound: { played: expect.any(Number), state: expect.any(String), unlockFailures: 0 },
  });
});

test("without telemetry=1 the dev build sends nothing", async ({ page }) => {
  const seed = 90_000 + Math.floor(Math.random() * 9_000);
  await open(page, `${CELL}&seed=${seed}&manual=1&bot=kite`);
  await page.evaluate(() => window.__game?.step(20_000));
  await page.waitForTimeout(1000);
  expect(kinds(seed)).toEqual([]);
});

test("a dropped /__telemetry connection doesn't crash the game", async ({ page }) => {
  await page.route("**/__telemetry", (route) => route.abort());
  await open(page, `${CELL}&manual=1&bot=kite&telemetry=1`);
  // Finishing the wave queues its "wave" record, which flushes at once (src/agent/telemetry.ts)
  // instead of waiting for the 5 s interval flush.
  await page.evaluate(() => window.__game?.step(20_000));
  await expect
    .poll(() => page.evaluate(() => window.__game?.telemetryFailures()))
    .toBeGreaterThan(0);
  // On the finished wave's result screen (crash() would have moved it to "error"); the errors
  // fixture (auto) also asserts no uncaught page error or console error happened.
  expect(await page.evaluate(() => window.__game?.flow().screen)).toBe("result");
});
