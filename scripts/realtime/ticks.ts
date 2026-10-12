/**
 * pnpm ticks "<query>" [--max-s 600] [--o PATCH ...]
 *
 * Headless, prints the frame of each of a run's telling moments (scripts/realtime/timeline.ts;
 * which ones is the game's tickLine): `<frame> <moment>`. Stepped, a real-time wave runs one tick
 * per kit-clock frame from its address, so these are the frames `pnpm shot --frames` and
 * `pnpm film --at` take (with no --actions; the query's bot plays, else the player stands).
 */
import { parseArgs } from "node:util";
import { OVERRIDE_OPTION } from "@scripts/game-page";
import { timeline } from "@scripts/realtime/timeline";
import { PERF_QUERY } from "@/game/links";

const USAGE = `usage: pnpm ticks "<query>" [--max-s 600] [--o PATCH ...]\n  e.g. pnpm ticks "${PERF_QUERY}"`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "max-s": { type: "string", default: "600" }, o: OVERRIDE_OPTION },
});
const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};
const query = positionals[0] ?? fail("ticks needs a query");
const maxS = Number(values["max-s"]);
if (!(Number.isFinite(maxS) && maxS > 0)) fail(`--max-s ${values["max-s"]}: expected seconds > 0`);
for (const line of timeline(query, maxS, values.o)) console.log(line);
