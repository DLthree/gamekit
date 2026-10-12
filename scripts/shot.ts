/**
 * pnpm shot "<query>" [--tick N] [--name NAME] [--phone [--landscape]]
 * A PNG of the game at tick N plus a JSON sidecar, in shots/. WebKit at desktop size (Desktop
 * Safari, the release target) by default; --phone is an iPhone 14, portrait unless --landscape.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { devices, webkit } from "@playwright/test";
import { acquireBrowserLock } from "@scripts/browser-guard";
import { createServer } from "vite";

const PORT = 5283;
const USAGE =
  'usage: pnpm shot "char=wizard&build=1&threat=1&bot=kite" [--tick 600] [--name NAME] [--phone [--landscape]]';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tick: { type: "string", default: "600" },
    name: { type: "string" },
    phone: { type: "boolean", default: false },
    landscape: { type: "boolean", default: false },
  },
});
const query = positionals[0];
if (query === undefined) {
  console.error(USAGE);
  process.exit(1);
}
if (values.landscape && !values.phone) {
  console.error(`--landscape only applies with --phone (desktop is already landscape)\n${USAGE}`);
  process.exit(1);
}
const device = values.phone ? (values.landscape ? "phone-landscape" : "phone") : "desktop";
const tick = Number(values.tick);
if (!Number.isInteger(tick) || tick < 0) {
  console.error(`--tick ${values.tick}: expected a whole number\n${USAGE}`);
  process.exit(1);
}
// Dev boots with telemetry on by default (src/app/main.ts); a shot is a script run, not a
// playtest, so it turns telemetry off unless the query already says one way or the other.
// A run with no seed is random; a shot is reproducible, so it pins one unless the query does.
const params = new URLSearchParams(query);
if (!params.has("telemetry")) params.set("telemetry", "0");
if (!params.has("seed")) params.set("seed", "7");
const gotoQuery = params.toString();

acquireBrowserLock(`pnpm shot ${query}`);
const server = await createServer({ server: { host: "127.0.0.1", port: PORT, strictPort: true } });
await server.listen();
let browser: Awaited<ReturnType<typeof webkit.launch>> | null = null;
try {
  browser = await webkit.launch();
  const preset = devices[values.phone ? "iPhone 14" : "Desktop Safari"];
  const viewport = values.landscape
    ? { width: preset.viewport.height, height: preset.viewport.width }
    : preset.viewport;
  const page = await (await browser.newContext({ ...preset, viewport })).newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?${gotoQuery}&manual=1&agent=1`);
  await page.waitForFunction(() => ["wave", "error"].includes(window.__game?.flow().screen ?? ""));
  const screen = await page.evaluate(() => window.__game?.flow().screen);
  if (screen === "error") {
    console.error(await page.locator("#error").innerText());
    process.exitCode = 1;
  } else {
    await page.evaluate((target) => {
      const g = window.__game;
      if (g === undefined) throw new Error("no window.__game");
      while (g.state().tick < target && g.state().phase !== "ended")
        g.step(Math.min(60, target - g.state().tick));
    }, tick);
    await page.evaluate(
      () =>
        new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
    );
    if (errors.length > 0) {
      // A page error mid-run leaves no reliable frame to trust; report it and stop, same as
      // the error-panel path.
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else {
      const name =
        values.name ??
        `${query.replace(/[^a-z0-9=]+/gi, "_")}-t${tick}${device === "desktop" ? "" : `-${device}`}`;
      mkdirSync("shots", { recursive: true });
      await page.screenshot({ path: `shots/${name}.png` });
      const read = await page.evaluate(() => ({
        state: window.__game?.state(),
        fx: window.__game?.fx(),
      }));
      const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        encoding: "utf8",
      }).trim();
      const sidecar = {
        query,
        tick,
        device,
        commit,
        takenAt: new Date().toISOString(),
        errors,
        ...read,
      };
      writeFileSync(`shots/${name}.json`, `${JSON.stringify(sidecar, null, 2)}\n`);
      console.log(`shots/${name}.png`);
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
