/**
 * pnpm sweep [--runs a,b|all] [--seeds 20] [--o PATCH ...] [--on a,b] [--workers N] [--out rows.jsonl]
 *
 * The bot balance sweep: every run the game names (src/game/sweep.ts: sweepRuns; --runs picks
 * some) × seeds 1..N, played headless by the game's run model, spread over worker threads
 * (default and most: cores − 2). --o and --on build the content as the URL's o= and on= do.
 * --out writes one JSON row per run, in run then seed order, identical whatever the worker count.
 * Prints the game's summary table (sweepTable).
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { OVERRIDE_OPTION } from "@scripts/game-page";
import { MAX_WORKERS, runSweep, sweepContent, sweepJobs } from "@scripts/sweep-run";
import { parseOn } from "@/content/switches";
import { sweepRuns, sweepTable } from "@/game/sweep";

const USAGE =
  "usage: pnpm sweep [--runs a,b|all] [--seeds 20] [--o PATCH ...] [--on a,b] [--workers N] [--out rows.jsonl]";

const { values } = parseArgs({
  options: {
    runs: { type: "string", default: "all" },
    seeds: { type: "string", default: "20" },
    o: OVERRIDE_OPTION,
    on: { type: "string" },
    workers: { type: "string", default: String(MAX_WORKERS) },
    out: { type: "string" },
  },
});
const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};
const seeds = Number(values.seeds);
if (!(Number.isInteger(seeds) && seeds >= 1)) fail(`--seeds ${values.seeds}: expected 1 or more`);
const workers = Number(values.workers);
if (!(Number.isInteger(workers) && workers >= 1 && workers <= MAX_WORKERS))
  fail(`--workers ${values.workers}: expected 1..${MAX_WORKERS} (cores − 2)`);
const on = parseOn(values.on ?? null);
if ("problem" in on) fail(`--on: ${on.problem}`);
const setup = { overrides: values.o, on: "on" in on ? on.on : [] };
const known = sweepRuns(sweepContent(setup));
const asked = values.runs === "all" ? known : values.runs.split(",");
const unknown = asked.filter((r) => !known.includes(r));
if (unknown.length > 0) fail(`--runs: no run ${unknown.join(", ")} (have ${known.join(", ")})`);

const jobs = sweepJobs(asked, seeds);
const started = Date.now();
let shown = 0;
const rows = await runSweep(setup, jobs, workers, (done) => {
  const tenth = Math.floor((done * 10) / jobs.length);
  if (tenth > shown) {
    shown = tenth;
    process.stderr.write(`sweep: ${done}/${jobs.length}\n`);
  }
});
const secs = ((Date.now() - started) / 1000).toFixed(1);
console.error(
  `sweep: ${jobs.length} runs on ${Math.min(workers, jobs.length)} workers in ${secs} s`,
);
if (values.out !== undefined) {
  writeFileSync(values.out, rows.map((r) => `${JSON.stringify(r)}\n`).join(""));
  console.error(`sweep: rows in ${values.out}`);
}
console.table(sweepTable(rows));
