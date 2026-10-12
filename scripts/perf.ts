/**
 * pnpm perf [--check] [--dpr N] [--o PATCH ...]
 *
 * A fixed run: the game's PERF_QUERY (src/game/links.ts, its heaviest scenario) with the agent
 * handle on and telemetry off, in WebKit on the shot tools' server (scripts/game-page.ts).
 * Information, not a target (the device's telemetry is the real fps judge): it prints frame,
 * sim and render timings, the busiest moment's effects, and the game speed, so a change that's
 * obviously worse doesn't need a device round-trip to notice. The bot may die before the wave
 * ends; a lost wave still reaches the result screen and still prints.
 *
 * `__game.perf()` (src/agent/perf.ts) is a ring buffer the game resets every 2 real seconds
 * (its telemetry cadence), so this polls it every POLL_MS while waiting for the result, keeps
 * each window's last snapshot before a reset, and combines them into whole-wave totals.
 *
 * Game speed is sim steps per real second while the wave plays (60 is full speed): ticks plus
 * the steps frozen by hit-stop, which are the game's feel, not a slowdown. `--dpr N` renders at
 * that pixel ratio (3 is a phone's: fill costs show headless). `--o` adds content overrides.
 *
 * `--check` (pnpm perf:check): fails (exit 1) when the game speed falls under CHECK.minSpeed or
 * the median 2-s window's p95 frame passes CHECK.maxP95Ms. The median, not the worst window:
 * headless WebKit's odd stalled window would make the worst flaky.
 */
import { parseArgs } from "node:util";
import { OVERRIDE_OPTION, openPage, withGameBrowser } from "@scripts/game-page";
import type { PerfSummary } from "@/agent/perf";
import { PERF_QUERY } from "@/game/links";

const { values } = parseArgs({
  options: {
    check: { type: "boolean", default: false },
    dpr: { type: "string" },
    o: OVERRIDE_OPTION,
  },
});
const CHECK = { minSpeed: 58.5, maxP95Ms: 20 };
const params = new URLSearchParams(PERF_QUERY);
params.set("agent", "1");
params.set("telemetry", "0");
if (values.dpr !== undefined) params.set("dpr", values.dpr);
for (const o of values.o) params.append("o", o);
const QUERY = params.toString();
const RESULT_TIMEOUT_MS = 180_000;
/** Comfortably under the perf meter's 2 s reset window, so no window is missed. */
const POLL_MS = 500;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** A sim step count (ticks plus frozen steps) and the real time (ms) it was seen at. */
interface Mark {
  steps: number;
  ms: number;
}

/** Frame-weighted mean of a PerfSummary field across every window that had at least one frame. */
function weightedMean(
  windows: readonly PerfSummary[],
  field: "meanMs" | "simMeanMs" | "renderMeanMs",
): number {
  const frames = windows.reduce((sum, w) => sum + w.frames, 0);
  if (frames === 0) return 0;
  return round1(windows.reduce((sum, w) => sum + w[field] * w.frames, 0) / frames);
}

/**
 * Combines every window into one whole-wave summary. `p95Ms` is the worst window's own p95
 * (windows aren't merged sample by sample); everything else is summed or frame-weighted.
 */
function wholeWave(windows: readonly PerfSummary[]): PerfSummary & { windows: number } {
  return {
    windows: windows.length,
    frames: windows.reduce((sum, w) => sum + w.frames, 0),
    meanMs: weightedMean(windows, "meanMs"),
    p95Ms: round1(windows.reduce((max, w) => Math.max(max, w.p95Ms), 0)),
    maxMs: round1(windows.reduce((max, w) => Math.max(max, w.maxMs), 0)),
    longFrames: windows.reduce((sum, w) => sum + w.longFrames, 0),
    simMeanMs: weightedMean(windows, "simMeanMs"),
    renderMeanMs: weightedMean(windows, "renderMeanMs"),
    frozenSteps: windows.reduce((sum, w) => sum + w.frozenSteps, 0),
  };
}

await withGameBrowser("pnpm perf", async (browser, base) => {
  const { page, errors } = await openPage(browser, "desktop");
  await page.goto(`${base}/?${QUERY}`);

  const windows: PerfSummary[] = [];
  let last: PerfSummary | null = null;
  /** The most live effects and volumes any poll saw, and the effects by kind then. */
  const peak = { fx: 0, volumes: 0, kinds: {} as Record<string, number> };
  const span: { from: Mark | null; to: Mark | null } = { from: null, to: null };
  let polling = true;
  const poll = (async () => {
    while (polling) {
      const read = await page.evaluate(() => {
        const g = window.__game;
        if (g === undefined) return null;
        const perf = g.perf();
        if (g.flow().screen !== "wave") return { perf, load: null };
        const fx = g.fx();
        const s = g.state();
        return {
          perf,
          load: {
            fx: fx.total,
            kinds: fx.kinds,
            volumes: s.volumes.length,
            tick: s.tick,
            playing: s.phase === "playing",
            ms: performance.now(),
          },
        };
      });
      if (read !== null) {
        const { perf: cur, load } = read;
        // Fewer frames than last time means a reset happened in between: `last` was that
        // window's final snapshot.
        if (last !== null && cur.frames < last.frames) windows.push(last);
        last = cur;
        if (load !== null) {
          if (load.fx > peak.fx) peak.kinds = load.kinds;
          peak.fx = Math.max(peak.fx, load.fx);
          peak.volumes = Math.max(peak.volumes, load.volumes);
          if (load.playing) {
            const frozen = [...windows, cur].reduce((sum, w) => sum + w.frozenSteps, 0);
            const mark = { steps: load.tick + frozen, ms: load.ms };
            span.from ??= mark;
            span.to = mark;
          }
        }
      }
      await new Promise((done) => setTimeout(done, POLL_MS));
    }
  })();
  try {
    await page.waitForFunction(
      () => ["result", "error"].includes(window.__game?.flow().screen ?? ""),
      undefined,
      { timeout: RESULT_TIMEOUT_MS },
    );
  } finally {
    polling = false;
    await poll;
  }
  if (last !== null) windows.push(last); // the final, possibly partial, window

  const screen = await page.evaluate(() => window.__game?.flow().screen);
  if (screen === "error") {
    console.error(await page.locator("#error").innerText());
    process.exitCode = 1;
    return;
  }
  const read = await page.evaluate(() => {
    const g = window.__game;
    if (g === undefined) throw new Error("no window.__game");
    const report = g.report();
    return {
      fx: g.fx(),
      telegraphs: report.telegraphs,
      droppedVolumes: report.droppedVolumes,
      eventOverflow: g.state().counters.eventOverflow,
      outcome: report.outcome,
      tick: g.state().tick,
    };
  });
  console.log(`pnpm perf: ${QUERY}`);
  console.log(`outcome: ${read.outcome}, tick: ${read.tick}\n`);
  const summary = wholeWave(windows);
  console.log(`perf, whole wave (${summary.windows} windows of up to 2 s each):`);
  console.table([summary]);
  console.log(`peak (polled every ${POLL_MS} ms): fx ${peak.fx}, volumes ${peak.volumes}`);
  const busiest = Object.entries(peak.kinds)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  console.log(`fx by kind at the peak: ${busiest.map(([k, n]) => `${k} ${n}`).join(", ")}`);
  let speed: number | null = null;
  if (span.from !== null && span.to !== null && span.to.ms > span.from.ms) {
    speed = (span.to.steps - span.from.steps) / ((span.to.ms - span.from.ms) / 1000);
    console.log(`game speed while playing: ${round1(speed)} steps/s of 60`);
  }
  const p95s = windows.map((w) => w.p95Ms).sort((a, b) => a - b);
  const typicalP95 = p95s[Math.floor(p95s.length / 2)] ?? Number.POSITIVE_INFINITY;
  console.log(`median window p95: ${typicalP95} ms`);
  console.log(`fx dropped: ${read.fx.dropped}`);
  console.table([read.telegraphs]);
  console.log(`droppedVolumes: ${read.droppedVolumes}`);
  console.log(`eventOverflow: ${read.eventOverflow}`);
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
  if (read.droppedVolumes > 0) process.exitCode = 1;
  if (values.check) {
    const fails = [
      ...(speed === null || speed < CHECK.minSpeed
        ? [`game speed ${speed === null ? "unmeasured" : round1(speed)} < ${CHECK.minSpeed}`]
        : []),
      ...(typicalP95 > CHECK.maxP95Ms
        ? [`median window p95 ${typicalP95} ms > ${CHECK.maxP95Ms} ms`]
        : []),
    ];
    console.log(fails.length === 0 ? "perf check: ok" : `perf check FAILED: ${fails.join("; ")}`);
    if (fails.length > 0) process.exitCode = 1;
  }
});
