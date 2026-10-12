/** A `pnpm sweep` worker thread (scripts/sweep-run.ts runSweep): plays the jobs it is sent. */
import { parentPort, workerData } from "node:worker_threads";
import { type SweepJob, type SweepSetup, sweepContent } from "@scripts/sweep-run";
import { playRun } from "@/game/sweep";

const port = parentPort;
if (port === null) throw new Error("sweep-worker.ts runs as a worker thread (runSweep)");
const content = sweepContent(workerData as SweepSetup);
port.on("message", (m: { index: number; job: SweepJob }) => {
  port.postMessage({ index: m.index, row: playRun(content, m.job.run, m.job.seed) });
});
