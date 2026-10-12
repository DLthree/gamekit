/** pnpm telemetry [file]: summarise the newest telemetry log (or the given one). */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonl, summarizeTelemetry } from "@scripts/telemetry-summary";

const dir = process.env.GAMEKIT_TELEMETRY_DIR ?? "telemetry";
const arg = process.argv[2];
let file = arg;
if (file === undefined) {
  const logs = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();
  const newest = logs.at(-1);
  if (newest === undefined) {
    console.error(`no telemetry logs in ${dir}/`);
    process.exit(1);
  }
  file = join(dir, newest);
}
console.log(`${file}\n`);
for (const line of summarizeTelemetry(parseJsonl(readFileSync(file, "utf8")))) console.log(line);
