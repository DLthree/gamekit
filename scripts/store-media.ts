/**
 * pnpm store-media [all|shots|art|capture|trailer|gifs|sheet] [--only NAME,…]
 *
 * The store page's media, from the game at 1920×1080, into release/store/ (gitignored). Every
 * frame comes from the game's manifest, ship/media.json, so after an art or balance change a
 * re-run gives the same moments, or shows which picks need new ticks (`pnpm ticks` lists a
 * fight's telling moments):
 *
 * - shots: screenshots/<name>.png, a query stepped to a tick (manual=1, as `pnpm shot`).
 * - art: capsules/<name>.png cut from a screenshot with the title on it, and the trailer's
 *   cards (scripts/store_media_art.py, PIL).
 * - capture: the trailer's fight beats as frames in build/beats/<name>/, frame stepped: each
 *   frame steps TICK_HZ/fps ticks, so the pacing is exact whatever the machine's speed.
 * - trailer: trailer.mp4 (H.264, silent), the beats crossfaded.
 * - gifs: gifs/<name>.gif from a captured beat (960 px wide, own palette, under 8 MB).
 * - sheet: sheet.png, a contact sheet of everything (scripts/sheet.py).
 *
 * One browser at a time (the machine's browser lock, scripts/game-page.ts).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Browser, Page } from "@playwright/test";
import { settleFrame, toolQuery, withGameBrowser } from "@scripts/game-page";
import { z } from "zod";
import { TICK_HZ } from "@/core/clock";

export const MANIFEST = "ship/media.json";
const OUT = "release/store";
const BUILD = join(OUT, "build");
const W = 1920;
const H = 1080;
const GIF_MAX_BYTES = 8_000_000;

const Name = z.string().regex(/^[a-z0-9-]+$/);
const Shot = z.strictObject({
  name: Name,
  query: z.string(),
  tick: z.number().int().nonnegative(),
});
const Beat = z.discriminatedUnion("kind", [
  z.strictObject({
    name: Name,
    kind: z.literal("wave"),
    query: z.string(),
    from: z.number().int().nonnegative(),
    seconds: z.number().positive(),
  }),
  z.strictObject({
    name: Name,
    kind: z.literal("card"),
    seconds: z.number().positive(),
    lines: z.array(z.string()).min(1),
  }),
]);
type Beat = z.infer<typeof Beat>;
export const Manifest = z.strictObject({
  title: z.string().min(1),
  screenshots: z.array(Shot),
  /** A capsule is cut from a screenshot (`shot`), centred, with the title set on it. */
  capsules: z.array(
    z.strictObject({ name: Name, size: z.tuple([z.number().int(), z.number().int()]), shot: Name }),
  ),
  trailer: z.strictObject({
    fps: z.number().int().positive(),
    fade: z.number().nonnegative(),
    beats: z.array(Beat).min(1),
  }),
  gifs: z.array(
    z.strictObject({
      name: Name,
      beat: Name,
      from: z.number().nonnegative(),
      seconds: z.number().positive(),
      /** x,y,w,h in the 1920×1080 frame, to frame the moment tighter than the whole page. */
      crop: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    }),
  ),
});
export type Manifest = z.infer<typeof Manifest>;

/** The manifest, checked: every capsule's shot and gif's beat exists, ticks step evenly. */
export function parseManifest(text: string): Manifest {
  const r = Manifest.safeParse(JSON.parse(text));
  if (!r.success)
    throw new Error(
      `${MANIFEST}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  const m = r.data;
  const problems: string[] = [];
  const shots = new Set(m.screenshots.map((s) => s.name));
  for (const c of m.capsules)
    if (!shots.has(c.shot)) problems.push(`capsule ${c.name}: no screenshot ${c.shot}`);
  const beats = new Map(m.trailer.beats.map((b) => [b.name, b]));
  for (const g of m.gifs) {
    const b = beats.get(g.beat);
    if (b?.kind !== "wave") problems.push(`gif ${g.name}: no wave beat ${g.beat}`);
    else if (g.from + g.seconds > b.seconds)
      problems.push(`gif ${g.name}: runs past its beat's ${b.seconds} s`);
  }
  if (TICK_HZ % m.trailer.fps !== 0)
    problems.push(`trailer.fps ${m.trailer.fps}: must divide the sim's ${TICK_HZ} ticks a second`);
  if (problems.length > 0) throw new Error(`${MANIFEST}: ${problems.join("; ")}`);
  return m;
}

/**
 * The crossfade filter graph over the beats' clips ([0:v], [1:v], …): each clip fades into the
 * next `fade` s before it ends. Returns the graph, its last label and the trailer's length.
 */
export function xfadeGraph(
  beats: readonly { seconds: number }[],
  fade: number,
): { filters: string[]; last: string; total: number } {
  const filters: string[] = [];
  let last = "[0:v]";
  let offset = beats[0].seconds;
  for (let i = 1; i < beats.length; i++) {
    const start = offset - fade;
    const label = `[v${i}]`;
    filters.push(
      `${last}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${start.toFixed(3)}${label}`,
    );
    last = label;
    offset = start + beats[i].seconds;
  }
  return { filters, last, total: offset };
}

function run(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
}

function ffmpeg(args: string[]): void {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

/** A 1920×1080 page on `query` at its wave; throws on the error panel or a page error. */
async function openWave(
  browser: Browser,
  base: string,
  query: string,
): Promise<{ page: Page; errors: string[] }> {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/?${toolQuery(query)}`);
  await page.waitForFunction(() => ["wave", "error"].includes(window.__game?.flow().screen ?? ""));
  if ((await page.evaluate(() => window.__game?.flow().screen)) === "error")
    throw new Error(`${query}: ${await page.locator("#error").innerText()}`);
  return { page, errors };
}

/** Steps the wave to `tick`; throws if it ends first (the frame would be the result). */
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

function picked<T extends { name: string }>(items: readonly T[], only: string[] | null): T[] {
  return only === null ? [...items] : items.filter((i) => only.includes(i.name));
}

async function shots(m: Manifest, only: string[] | null, browser: Browser, base: string) {
  const dir = join(OUT, "screenshots");
  mkdirSync(dir, { recursive: true });
  for (const s of picked(m.screenshots, only)) {
    const { page, errors } = await openWave(browser, base, s.query);
    await stepTo(page, s.tick);
    await settleFrame(page);
    if (errors.length > 0) throw new Error(`${s.name}: page error\n${errors.join("\n")}`);
    await page.screenshot({ path: join(dir, `${s.name}.png`) });
    console.log(join(dir, `${s.name}.png`));
    await page.context().close();
  }
}

async function capture(m: Manifest, only: string[] | null, browser: Browser, base: string) {
  const { fps } = m.trailer;
  for (const beat of picked(m.trailer.beats, only)) {
    if (beat.kind !== "wave") continue;
    const dir = join(BUILD, "beats", beat.name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const frames = Math.round(beat.seconds * fps);
    const { page, errors } = await openWave(browser, base, beat.query);
    for (let i = 0; i < frames; i++) {
      await stepTo(page, beat.from + (i * TICK_HZ) / fps);
      await settleFrame(page);
      if (errors.length > 0) throw new Error(`${beat.name}: page error\n${errors.join("\n")}`);
      const path = join(dir, `${String(i).padStart(5, "0")}.jpg`);
      await page.screenshot({ path, type: "jpeg", quality: 92 });
    }
    console.log(`${dir}: ${frames} frames`);
    await page.context().close();
  }
}

function art(): void {
  run("uv", ["run", "scripts/store_media_art.py", MANIFEST, OUT]);
}

/** Each beat as a clip build/clips/<name>.mp4 (frames, or a held card), at the trailer's fps. */
function clips(m: Manifest): string[] {
  const { fps, beats } = m.trailer;
  const dir = join(BUILD, "clips");
  mkdirSync(dir, { recursive: true });
  const enc = ["-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p"];
  return beats.map((beat: Beat) => {
    const out = join(dir, `${beat.name}.mp4`);
    const frames = Math.round(beat.seconds * fps);
    if (beat.kind === "card") {
      const still = join(BUILD, "cards", `${beat.name}.png`);
      if (!existsSync(still)) throw new Error(`${still} missing: run pnpm store-media art`);
      ffmpeg([
        "-loop",
        "1",
        "-framerate",
        `${fps}`,
        "-i",
        still,
        "-frames:v",
        `${frames}`,
        ...enc,
        out,
      ]);
    } else {
      const src = join(BUILD, "beats", beat.name);
      const have = existsSync(src) ? readdirSync(src).length : 0;
      if (have !== frames)
        throw new Error(`${src}: ${have} frames, expected ${frames}: run pnpm store-media capture`);
      ffmpeg(["-framerate", `${fps}`, "-i", join(src, "%05d.jpg"), ...enc, out]);
    }
    return out;
  });
}

function trailer(m: Manifest): void {
  const paths = clips(m);
  const { filters, last, total } = xfadeGraph(m.trailer.beats, m.trailer.fade);
  const out = join(OUT, "trailer.mp4");
  const map = filters.length === 0 ? [] : ["-filter_complex", filters.join(";"), "-map", last];
  ffmpeg([
    ...paths.flatMap((p) => ["-i", p]),
    ...map,
    ...["-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p"],
    ...["-movflags", "+faststart", "-r", `${m.trailer.fps}`, "-t", total.toFixed(3), out],
  ]);
  console.log(`${out}: ${total.toFixed(1)} s`);
}

/** A GIF from a captured beat, cropped: 960 px wide at 15 fps, its own palette; smaller until ≤ 8 MB. */
function gifs(m: Manifest, only: string[] | null): void {
  const { fps } = m.trailer;
  const dir = join(OUT, "gifs");
  mkdirSync(dir, { recursive: true });
  for (const g of picked(m.gifs, only)) {
    const src = join(BUILD, "beats", g.beat);
    if (!existsSync(src)) throw new Error(`${src} missing: run pnpm store-media capture`);
    const out = join(dir, `${g.name}.gif`);
    for (const [width, rate, colors] of [
      [960, 15, 192],
      [800, 12, 128],
      [640, 12, 96],
    ] as const) {
      const crop =
        g.crop === undefined ? "" : `crop=${g.crop[2]}:${g.crop[3]}:${g.crop[0]}:${g.crop[1]},`;
      const vf = `${crop}fps=${rate},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
      ffmpeg([
        ...["-framerate", `${fps}`, "-start_number", `${Math.round(g.from * fps)}`],
        ...["-i", join(src, "%05d.jpg"), "-t", `${g.seconds}`, "-vf", vf, "-loop", "0", out],
      ]);
      if (statSync(out).size <= GIF_MAX_BYTES) break;
    }
    const size = statSync(out).size;
    if (size > GIF_MAX_BYTES) throw new Error(`${out}: ${size} bytes, over 8 MB at the smallest`);
    console.log(`${out}: ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
}

/** The contact sheet: screenshots, capsules and the GIFs' first frames. */
function sheet(): void {
  const thumbs = join(BUILD, "sheet");
  rmSync(thumbs, { recursive: true, force: true });
  mkdirSync(thumbs, { recursive: true });
  const gifDir = join(OUT, "gifs");
  for (const g of existsSync(gifDir) ? readdirSync(gifDir) : [])
    ffmpeg(["-i", join(gifDir, g), "-frames:v", "1", join(thumbs, g.replace(".gif", "-gif.png"))]);
  const list = (d: string): string[] =>
    existsSync(d)
      ? readdirSync(d)
          .filter((f) => f.endsWith(".png"))
          .sort()
          .map((f) => join(d, f))
      : [];
  const images = [
    ...list(join(OUT, "screenshots")),
    ...list(join(OUT, "capsules")),
    ...list(thumbs),
  ];
  if (images.length === 0) throw new Error(`nothing in ${OUT} yet: run pnpm store-media first`);
  run("uv", ["run", "scripts/sheet.py", join(OUT, "sheet.png"), ...images]);
}

const STEPS = ["all", "shots", "art", "capture", "trailer", "gifs", "sheet"] as const;
const USAGE = `usage: pnpm store-media [${STEPS.join("|")}] [--only a,b]`;

const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { only: { type: "string" } },
  });
  const [cmd = "all", ...extra] = positionals;
  if (extra.length > 0) fail(`one step at a time, got ${positionals.join(" ")}`);
  if (!STEPS.some((s) => s === cmd)) fail(`unknown step ${cmd}`);
  let m: Manifest;
  try {
    m = parseManifest(readFileSync(MANIFEST, "utf8"));
  } catch (err) {
    m = fail(err instanceof Error ? err.message : String(err));
  }
  const only = values.only?.split(",") ?? null;
  const browser = async (what: string, steps: ((b: Browser, base: string) => Promise<void>)[]) =>
    withGameBrowser(`pnpm store-media ${what}`, async (b, base) => {
      for (const step of steps) await step(b, base);
    });
  if (cmd === "all") {
    await browser("all", [
      (b, base) => shots(m, only, b, base),
      (b, base) => capture(m, only, b, base),
    ]);
    art();
    trailer(m);
    gifs(m, only);
    sheet();
  } else if (cmd === "shots") await browser(cmd, [(b, base) => shots(m, only, b, base)]);
  else if (cmd === "capture") await browser(cmd, [(b, base) => capture(m, only, b, base)]);
  else if (cmd === "art") art();
  else if (cmd === "trailer") trailer(m);
  else if (cmd === "gifs") gifs(m, only);
  else sheet();
}

if (import.meta.main) await main();
