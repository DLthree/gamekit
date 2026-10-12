/**
 * pnpm perf — a fixed check: the wizard, build 3, threat 3, the kite bot, seed 7. Information
 * only (the phone's telemetry is the real fps judge): it prints frame timings, fx and telegraph
 * counts so a change that's obviously worse doesn't need a phone round-trip to notice. The kite
 * bot may die before the wave ends; a died outcome still reaches the result
 * screen and still prints, same as a survived one.
 *
 * `__game.perf()` (src/agent/perf.ts) is a ring buffer that src/game/main.ts resets every 2 real
 * seconds (its telemetry cadence) — a single read at the end would only cover the last, likely
 * partial, window before the wave ended. So this polls it every POLL_MS (well under 2 s) while
 * waiting for the result, keeps the last snapshot of each window it catches before a reset, and
 * combines those into whole-wave totals (frame-weighted mean and sim mean, the worst window's
 * p95, the overall max, every long frame counted).
 */

import { devices, webkit } from "@playwright/test";
import { acquireBrowserLock } from "@scripts/browser-guard";
import { createServer } from "vite";
import type { PerfSummary } from "@/agent/perf";

const PORT = 5283;
const QUERY = "char=wizard&build=3&threat=3&seed=7&bot=kite&agent=1&telemetry=0";
const RESULT_TIMEOUT_MS = 120_000;
/** Comfortably under PerfMeter's 2 s reset window (src/game/main.ts), so no window is missed. */
const POLL_MS = 500;

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Frame-weighted mean of a PerfSummary field across every window that had at least one frame. */
function weightedMean(windows: readonly PerfSummary[], field: "meanMs" | "simMeanMs"): number {
  const frames = windows.reduce((sum, w) => sum + w.frames, 0);
  if (frames === 0) return 0;
  return round1(windows.reduce((sum, w) => sum + w[field] * w.frames, 0) / frames);
}

/**
 * Combines every window `poll()` caught into one whole-wave summary. `p95Ms` is the worst of each
 * window's own p95 (windows aren't merged sample-by-sample, so a true wave-wide percentile isn't
 * recoverable from the summaries alone); everything else is either summed or frame-weighted.
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
  };
}

acquireBrowserLock("pnpm perf");
const server = await createServer({ server: { host: "127.0.0.1", port: PORT, strictPort: true } });
await server.listen();
let browser: Awaited<ReturnType<typeof webkit.launch>> | null = null;
try {
  browser = await webkit.launch();
  const page = await (await browser.newContext({ ...devices["Desktop Safari"] })).newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?${QUERY}`);

  const windows: PerfSummary[] = [];
  let last: PerfSummary | null = null;
  let polling = true;
  const poll = (async () => {
    while (polling) {
      const cur = await page.evaluate(() => window.__game?.perf());
      if (cur !== undefined) {
        // Fewer frames than last time means a reset happened in between: `last` was that
        // window's final snapshot.
        if (last !== null && cur.frames < last.frames) windows.push(last);
        last = cur;
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
  } else {
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
    console.table([{ total: read.fx.total, dropped: read.fx.dropped, ...read.fx.kinds }]);
    console.table([read.telegraphs]);
    console.log(`droppedVolumes: ${read.droppedVolumes}`);
    console.log(`eventOverflow: ${read.eventOverflow}`);
    if (errors.length > 0) console.error(errors.join("\n"));
    if (read.droppedVolumes > 0) process.exitCode = 1;
  }
} finally {
  await browser?.close();
  await server.close();
}
