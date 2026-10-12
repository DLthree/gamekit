import { MAX_WORKERS, runSweep, sweepContent, sweepJobs } from "@scripts/sweep-run";
import { describe, expect, it } from "vitest";
import { playRun, sweepRuns } from "@/game/sweep";

const SETUP = { overrides: [], on: [] };

describe("runSweep", () => {
  it("returns the serial rows in run/seed order, whatever finishes first", async () => {
    const content = sweepContent(SETUP);
    const runs = sweepRuns(content).slice(0, 2);
    const jobs = sweepJobs(runs, 2);
    const serial = jobs.map((j) => playRun(content, j.run, j.seed));
    const parallel = await runSweep(SETUP, jobs, Math.min(3, MAX_WORKERS));
    expect(parallel.map((r) => `${r.run}:${r.seed}`)).toEqual(
      runs.flatMap((r) => [`${r}:1`, `${r}:2`]),
    );
    expect(parallel).toEqual(serial);
  }, 60_000);

  it("plays the overrides it is given", async () => {
    const content = sweepContent(SETUP);
    const run = sweepRuns(content)[0];
    const overrides = Object.keys(content.characters).map((c) => `characters/${c}.stats.life=7`);
    const setup = { overrides, on: [] };
    const [row] = await runSweep(setup, sweepJobs([run], 1), 1);
    expect(row).toEqual(playRun(sweepContent(setup), run, 1));
    const bad = { overrides: ["characters/nobody.stats.life=7"], on: [] };
    await expect(runSweep(bad, sweepJobs([run], 1), 1)).rejects.toThrow(/nobody/);
  }, 60_000);

  it("rejects when a worker's run throws", async () => {
    await expect(runSweep(SETUP, sweepJobs(["nobody"], 2), 1)).rejects.toThrow(/nobody/);
  }, 30_000);

  it("refuses a worker count past cores − 2", () => {
    expect(() => runSweep(SETUP, sweepJobs(["x"], 1), 1000)).toThrow(/workers 1000/);
  });
});
