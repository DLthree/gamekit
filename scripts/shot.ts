/**
 * pnpm shot "<query>" [--tick N] [--o PATCH ...] [--name NAME] [--deck | --phone [--landscape]]
 * A PNG of the game at tick N plus a JSON sidecar, in shots/. WebKit at desktop size (Desktop
 * Safari, the release target) by default; --deck is a Steam Deck's 1280x800, --phone an iPhone
 * 14, portrait unless --landscape. The query is made reproducible (scripts/game-page.ts).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  type Device,
  OVERRIDE_OPTION,
  openPage,
  queryName,
  settleFrame,
  toolQuery,
  withGameBrowser,
} from "@scripts/game-page";
import { PERF_QUERY } from "@/game/links";

const USAGE = `usage: pnpm shot "<query>" [--tick 600] [--o PATCH ...] [--name NAME] [--deck | --phone [--landscape]]
  e.g. pnpm shot "${PERF_QUERY}"`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tick: { type: "string", default: "600" },
    o: OVERRIDE_OPTION,
    name: { type: "string" },
    deck: { type: "boolean", default: false },
    phone: { type: "boolean", default: false },
    landscape: { type: "boolean", default: false },
  },
});
const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};
const query = positionals[0] ?? fail("shot needs a query");
if (values.landscape && !values.phone)
  fail("--landscape only applies with --phone (desktop is already landscape)");
if (values.deck && values.phone) fail("--deck and --phone are two devices: pick one");
const device: Device = values.phone
  ? values.landscape
    ? "phone-landscape"
    : "phone"
  : values.deck
    ? "deck"
    : "desktop";
const tick = Number(values.tick);
if (!Number.isInteger(tick) || tick < 0) fail(`--tick ${values.tick}: expected a whole number`);

await withGameBrowser(`pnpm shot ${query}`, async (browser, base) => {
  const { page, errors } = await openPage(browser, device);
  await page.goto(`${base}/?${toolQuery(query, values.o)}`);
  await page.waitForFunction(() => ["wave", "error"].includes(window.__game?.flow().screen ?? ""));
  const screen = await page.evaluate(() => window.__game?.flow().screen);
  if (screen === "error") {
    console.error(await page.locator("#error").innerText());
    process.exitCode = 1;
    return;
  }
  await page.evaluate((target) => {
    const g = window.__game;
    if (g === undefined) throw new Error("no window.__game");
    while (g.state().tick < target && g.state().phase !== "ended")
      g.step(Math.min(60, target - g.state().tick));
  }, tick);
  await settleFrame(page);
  if (errors.length > 0) {
    // A page error mid-run leaves no reliable frame to trust; report it and stop, same as
    // the error-panel path.
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  const name =
    values.name ?? `${queryName(query)}-t${tick}${device === "desktop" ? "" : `-${device}`}`;
  mkdirSync("shots", { recursive: true });
  await page.screenshot({ path: `shots/${name}.png` });
  const read = await page.evaluate(() => ({ state: window.__game?.state() }));
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const sidecar = {
    query,
    overrides: values.o,
    tick,
    device,
    commit,
    takenAt: new Date().toISOString(),
    errors,
    ...read,
  };
  writeFileSync(`shots/${name}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);
  console.log(`shots/${name}.png`);
});
