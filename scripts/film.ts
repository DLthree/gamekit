/**
 * pnpm film "<query>" [--at S] [--frames N] [--every MS] [--crop x,y,w,h] [--viewport desktop|deck|phone|phone-landscape] [--compare "<query>"] [--out DIR]
 *
 * A strip of frames of the game: N PNGs from second S, one every MS, plus strip.png tiling them in
 * a row (with --compare, a second row from the other query, frame for frame under the first: a
 * before/after or variant A/B). Through the browser lock, on the shot tools' own server
 * (scripts/game-page.ts), with the query made reproducible the same way (`pnpm shot`).
 *
 * A wave is stepped (manual=1): S and MS are sim time, so the same command films the same
 * frames; MS must be a whole number of ticks. Any other screen (a picker, a result) runs on its
 * own and is filmed in real time. --crop is in CSS pixels of the viewport. Default out:
 * shots/film/<query>.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Browser, Page } from "@playwright/test";
import {
  DEVICES,
  openPage,
  queryName,
  settleFrame,
  toolQuery,
  withGameBrowser,
} from "@scripts/game-page";
import { TICK_HZ } from "@/core/clock";
import { PERF_QUERY } from "@/game/links";

const USAGE = `usage: pnpm film "<query>" [--at 5] [--frames 8] [--every 100] [--crop x,y,w,h] [--viewport ${DEVICES.join("|")}] [--compare "<query>"] [--out DIR]
  e.g. pnpm film "${PERF_QUERY}" --at 4 --frames 8 --every 100`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    at: { type: "string", default: "5" },
    frames: { type: "string", default: "8" },
    every: { type: "string", default: "100" },
    crop: { type: "string" },
    viewport: { type: "string", default: "desktop" },
    compare: { type: "string" },
    out: { type: "string" },
  },
});
const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};
const query = positionals[0] ?? fail("film needs a query");
const at = Number(values.at);
if (!(Number.isFinite(at) && at >= 0)) fail(`--at ${values.at}: expected seconds ≥ 0`);
const frames = Number(values.frames);
if (!(Number.isInteger(frames) && frames >= 1))
  fail(`--frames ${values.frames}: expected 1 or more`);
const every = Number(values.every);
const everyTicks = (every * TICK_HZ) / 1000;
if (!(Number.isInteger(everyTicks) && everyTicks >= 1))
  fail(`--every ${values.every}: expected a whole number of ticks (${1000 / TICK_HZ} ms each)`);
const atTick = Math.round(at * TICK_HZ);
const device = DEVICES.find((d) => d === values.viewport) ?? fail(`--viewport ${values.viewport}`);
const cropNums = values.crop?.split(",").map(Number);
if (cropNums !== undefined && !(cropNums.length === 4 && cropNums.every((n) => n >= 0)))
  fail(`--crop ${values.crop}: expected x,y,w,h in CSS pixels`);
const clip =
  cropNums === undefined
    ? undefined
    : {
        x: cropNums[0] ?? 0,
        y: cropNums[1] ?? 0,
        width: cropNums[2] ?? 0,
        height: cropNums[3] ?? 0,
      };
const out = values.out ?? join("shots/film", queryName(query));
const rows = values.compare === undefined ? [query] : [query, values.compare];

/** Films one query into `<out>/<prefix>NN.png`; returns the frame paths. */
async function film(browser: Browser, base: string, q: string, prefix: string): Promise<string[]> {
  const { page, errors } = await openPage(browser, device);
  await page.goto(`${base}/?${toolQuery(q)}`);
  await page.waitForFunction(() => !["boot", undefined].includes(window.__game?.flow().screen));
  const screen = await page.evaluate(() => window.__game?.flow().screen);
  if (screen === "error") throw new Error(`${q}: ${await page.locator("#error").innerText()}`);
  const stepped = screen === "wave";
  if (stepped) await stepTo(page, atTick);
  else await page.waitForTimeout(at * 1000);
  const paths: string[] = [];
  for (let i = 0; i < frames; i++) {
    if (i > 0) {
      if (stepped) await stepTo(page, atTick + i * everyTicks);
      else await page.waitForTimeout(every);
    }
    if (stepped) await settleFrame(page);
    if (errors.length > 0) throw new Error(`${q}: page error\n${errors.join("\n")}`);
    const path = join(out, `${prefix}${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path, ...(clip === undefined ? {} : { clip }) });
    paths.push(path);
  }
  console.log(`${q}: ${frames} frames, ${stepped ? "stepped" : "real time"}`);
  await page.context().close();
  return paths;
}

/** Steps the wave to `tick`; throws if it ends first (the frames would all be the result). */
async function stepTo(page: Page, tick: number): Promise<void> {
  await page.evaluate((target) => {
    const g = window.__game;
    if (g === undefined) throw new Error("no window.__game");
    while (g.state().tick < target) {
      if (g.state().phase === "ended") throw new Error(`the wave ended at tick ${g.state().tick}`);
      g.step(Math.min(60, target - g.state().tick));
    }
  }, tick);
}

/** Tiles each row's frames side by side, rows stacked, captioned with the query, on a blank page. */
async function strip(browser: Browser, rowsOfPaths: string[][]): Promise<string> {
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  const cell = `min(${Math.floor(2400 / frames)}px, ${clip?.width ?? 1e4}px)`;
  const html = rowsOfPaths
    .map((paths, r) => {
      const imgs = paths
        .map((p) => `<img src="data:image/png;base64,${readFileSync(p).toString("base64")}">`)
        .join("");
      return `<p>${escapeHtml(rows[r] ?? "")}</p><div>${imgs}</div>`;
    })
    .join("");
  await page.setContent(
    `<style>body{margin:0} main{padding:8px;background:#111;color:#ddd;font:14px monospace;width:max-content}
    p{margin:4px 0} div{display:flex;gap:4px} img{width:${cell};display:block}</style><main>${html}</main>`,
  );
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  const path = join(out, "strip.png");
  await page.locator("main").screenshot({ path });
  await page.context().close();
  return path;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

mkdirSync(out, { recursive: true });
await withGameBrowser(`pnpm film ${query}`, async (browser, base) => {
  const shot: string[][] = [];
  for (const [r, q] of rows.entries())
    shot.push(await film(browser, base, q, rows.length === 1 ? "f" : `${"ab"[r]}`));
  console.log(await strip(browser, shot));
});
