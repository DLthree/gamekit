/**
 * pnpm film "<query>" [--actions JSON] [--frames N] [--count N] [--every N] [--crop x,y,w,h] [--viewport desktop|deck|phone|phone-landscape] [--compare "<query>"] [--o PATCH ...] [--out DIR]
 *
 * A strip of frames of the game: the page reaches its moment by the scripted actions (the game's
 * shape, replayed through `window.__game.act`) and --frames frames of the kit clock, then --count PNGs one
 * every --every frames, plus strip.png tiling them in a row (with --compare, a second row from
 * the other query, frame for frame under the first: a before/after or variant A/B). The page
 * runs only when stepped (manual=1, src/core/frames.ts), so the same command films the same
 * frames. --o patches every row; for an A/B of a tuning put `o=<patch>` in one row's query
 * (`--compare "<query>&o=<patch>"`; --o comes after it, so the last patch of a path wins). Each
 * row is captioned with its query and its --o patches; two rows that would film the same thing
 * are refused. Through the browser lock, on the shot tools' own server (scripts/game-page.ts),
 * with the query made reproducible the same way (`pnpm shot`). --crop is in CSS pixels of the
 * viewport. Default out: shots/film/<query>.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Browser } from "@playwright/test";
import {
  ACTIONS_OPTION,
  DEVICES,
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

const USAGE = `usage: pnpm film "<query>" [--actions '[…]'] [--frames 300] [--count 8] [--every 6] [--crop x,y,w,h] [--viewport ${DEVICES.join("|")}] [--compare "<query>"] [--o PATCH ...] [--out DIR]
  e.g. pnpm film "seed=3" --frames 240 --count 8 --every 6`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    actions: ACTIONS_OPTION,
    frames: { type: "string", default: "300" },
    count: { type: "string", default: "8" },
    every: { type: "string", default: "6" },
    crop: { type: "string" },
    viewport: { type: "string", default: "desktop" },
    compare: { type: "string" },
    o: OVERRIDE_OPTION,
    out: { type: "string" },
  },
});
const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};
const query = positionals[0] ?? fail("film needs a query");
const [actions, frames, count, every] = (() => {
  try {
    return [
      parseActions(values.actions),
      wholeArg("frames", values.frames, 0),
      wholeArg("count", values.count, 1),
      wholeArg("every", values.every, 1),
    ] as const;
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
})();
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
const [first, second] = rows.map((q) => toolQuery(q, values.o));
if (second !== undefined && first === second)
  fail(
    '--compare films the same query as the first row (--o patches both rows): for an A/B put o=<patch> in one query, e.g. --compare "<query>&o=<patch>"',
  );
/** Each row's caption: its query and the --o patches every row gets. */
const captions = rows.map((q) => [q, ...values.o.map((o) => `o=${o}`)].join("&"));

/** Films one query into `<out>/<prefix>NN.png`; returns the frame paths. */
async function film(browser: Browser, base: string, q: string, prefix: string): Promise<string[]> {
  const { page, errors } = await openPage(browser, device);
  await openGame(page, base, toolQuery(q, values.o));
  const paths: string[] = [];
  let frame = 0;
  for (let i = 0; i < count; i++) {
    frame = i === 0 ? await reach(page, actions, frames) : await reach(page, [], every);
    await settleFrame(page);
    if (errors.length > 0) throw new Error(`${q}: page error\n${errors.join("\n")}`);
    const path = join(out, `${prefix}${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path, ...(clip === undefined ? {} : { clip }) });
    paths.push(path);
  }
  console.log(`${q}: ${count} images, the last at frame ${frame}`);
  await page.context().close();
  return paths;
}

/** Tiles each row's frames side by side, rows stacked, captioned with the query, on a blank page. */
async function strip(browser: Browser, rowsOfPaths: string[][]): Promise<string> {
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
  const cell = `min(${Math.floor(2400 / count)}px, ${clip?.width ?? 1e4}px)`;
  const html = rowsOfPaths
    .map((paths, r) => {
      const imgs = paths
        .map((p) => `<img src="data:image/png;base64,${readFileSync(p).toString("base64")}">`)
        .join("");
      return `<p>${escapeHtml(captions[r] ?? "")}</p><div>${imgs}</div>`;
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
