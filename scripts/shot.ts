/**
 * pnpm shot "<query>" [--actions JSON] [--frames N] [--o PATCH ...] [--name NAME] [--deck | --phone [--landscape]]
 * A PNG of the game after its scripted actions (the game's shape, replayed through
 * `window.__game.act`) and then N frames of the kit clock, plus a JSON sidecar, in shots/. WebKit at desktop size (Desktop
 * Safari, the release target) by default; --deck is a Steam Deck's 1280x800, --phone an iPhone
 * 14, portrait unless --landscape. The query is made reproducible (scripts/game-page.ts).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  ACTIONS_OPTION,
  type Device,
  OVERRIDE_OPTION,
  openGame,
  openPage,
  parseActions,
  queryName,
  reach,
  settleFrame,
  toolQuery,
  wholeArg,
  withGameBrowser,
} from "@scripts/game-page";

const USAGE = `usage: pnpm shot "<query>" [--actions '[…]'] [--frames 600] [--o PATCH ...] [--name NAME] [--deck | --phone [--landscape]]
  e.g. pnpm shot "seed=3" --actions '[…]' --frames 30`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    actions: ACTIONS_OPTION,
    frames: { type: "string", default: "600" },
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
let actions: unknown[] = [];
let frames = 0;
try {
  actions = parseActions(values.actions);
  frames = wholeArg("frames", values.frames, 0);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
}
/** Shots of the same query with different actions get different names. */
const actionsTag =
  actions.length === 0
    ? ""
    : `-a${createHash("sha1").update(JSON.stringify(actions)).digest("hex").slice(0, 6)}`;

await withGameBrowser(`pnpm shot ${query}`, async (browser, base) => {
  const { page, errors } = await openPage(browser, device);
  try {
    await openGame(page, base, toolQuery(query, values.o));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }
  const frame = await reach(page, actions, frames);
  await settleFrame(page);
  if (errors.length > 0) {
    // A page error mid-run leaves no reliable frame to trust; report it and stop, same as
    // the error-panel path.
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  const name =
    values.name ??
    `${queryName(query)}${actionsTag}-f${frames}${device === "desktop" ? "" : `-${device}`}`;
  mkdirSync("shots", { recursive: true });
  await page.screenshot({ path: `shots/${name}.png` });
  const read = await page.evaluate(() => ({ state: window.__game?.state() }));
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const sidecar = {
    query,
    overrides: values.o,
    actions,
    frames,
    frame,
    device,
    commit,
    takenAt: new Date().toISOString(),
    errors,
    ...read,
  };
  writeFileSync(`shots/${name}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);
  console.log(`shots/${name}.png`);
});
