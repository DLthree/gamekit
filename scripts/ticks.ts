/**
 * pnpm ticks "<query>" [--max-s 600]
 *
 * Headless, prints the world ticks of a run's telling moments (scripts/timeline.ts; which ones is
 * the game's tickLine), to aim `pnpm shot --tick` and `pnpm film --at`.
 */
import { parseArgs } from "node:util";
import { timeline } from "@scripts/timeline";
import { PERF_QUERY } from "@/game/links";

const USAGE = `usage: pnpm ticks "<query>" [--max-s 600]\n  e.g. pnpm ticks "${PERF_QUERY}"`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "max-s": { type: "string", default: "600" } },
});
const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};
const query = positionals[0] ?? fail("ticks needs a query");
const maxS = Number(values["max-s"]);
if (!(Number.isFinite(maxS) && maxS > 0)) fail(`--max-s ${values["max-s"]}: expected seconds > 0`);
for (const line of timeline(query, maxS)) console.log(line);
