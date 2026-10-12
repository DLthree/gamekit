/**
 * The parallel headless runner behind `pnpm sweep` (scripts/sweep.ts): (run, seed) jobs spread over
 * worker threads, each played by the game's run model (src/game/sweep.ts: playRun) on content
 * built with the sweep's overrides and switches. Deterministic: the same jobs give the same rows,
 * in job order, whatever the worker count.
 */
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { type SwitchId, switchOn } from "@/content/switches";
import type { SimContent } from "@/content/types";
import type { SweepRow } from "@/game/sweep";

/** What every job of a sweep shares: the content's `o=` overrides and its `on=` switches. */
export interface SweepSetup {
  overrides: readonly string[];
  on: readonly SwitchId[];
}

export interface SweepJob {
  run: string;
  seed: number;
}

/** The sweep's content, or a throw naming every content error. */
export function sweepContent(setup: SweepSetup): SimContent {
  const loaded = loadContentDir(REPO_CONTENT_DIR, setup.overrides);
  if (!loaded.ok) throw new Error(loaded.errors.map(formatContentError).join("\n"));
  return switchOn(loaded.content, setup.on).sim;
}

/** Each run with seeds 1..seeds, run by run. */
export function sweepJobs(runs: readonly string[], seeds: number): SweepJob[] {
  return runs.flatMap((run) => Array.from({ length: seeds }, (_, i) => ({ run, seed: i + 1 })));
}

export const MAX_WORKERS = Math.max(1, availableParallelism() - 2);

const WORKER = fileURLToPath(new URL("./sweep-worker.ts", import.meta.url));
const ALIAS = fileURLToPath(new URL("./node-alias.ts", import.meta.url));

/**
 * Plays `jobs` on up to `workers` threads; resolves with their rows in job order, or rejects on
 * the first job that throws. `onRow` hears the count done after each row.
 */
export function runSweep(
  setup: SweepSetup,
  jobs: readonly SweepJob[],
  workers: number,
  onRow: (done: number) => void = () => {},
): Promise<SweepRow[]> {
  if (!(Number.isInteger(workers) && workers >= 1 && workers <= MAX_WORKERS))
    throw new Error(`workers ${workers}: expected 1..${MAX_WORKERS} (cores − 2)`);
  const rows: (SweepRow | undefined)[] = new Array(jobs.length);
  const pool: Worker[] = [];
  const retired = new Set<Worker>();
  const retire = (w: Worker) => {
    retired.add(w);
    void w.terminate();
  };
  return new Promise<SweepRow[]>((resolve, reject) => {
    let next = 0;
    let done = 0;
    let failed = false;
    const fail = (e: Error) => {
      if (failed) return;
      failed = true;
      for (const w of pool) retire(w);
      reject(e);
    };
    const feed = (w: Worker) => {
      if (next >= jobs.length) {
        retire(w);
        return;
      }
      const index = next++;
      w.postMessage({ index, job: jobs[index] });
    };
    const count = Math.min(workers, jobs.length);
    if (count === 0) resolve([]);
    for (let i = 0; i < count; i++) {
      const w = new Worker(WORKER, { workerData: setup, execArgv: ["--import", ALIAS] });
      pool.push(w);
      w.on("message", (m: { index: number; row: SweepRow }) => {
        rows[m.index] = m.row;
        done++;
        onRow(done);
        if (done === jobs.length) {
          for (const p of pool) retire(p);
          resolve(
            rows.map((r, j) => {
              if (r === undefined) throw new Error(`sweep: no row for job ${j}`);
              return r;
            }),
          );
        } else feed(w);
      });
      w.on("error", fail);
      w.on("exit", (code) => {
        if (!retired.has(w)) fail(new Error(`sweep worker exited early (code ${code})`));
      });
      feed(w);
    }
  });
}
