/**
 * pnpm run-record <telemetry.jsonl | rr1;… record text>
 *
 * Each run record in the input (src/agent/record.ts) laid out with its replay address on the dev
 * server (pnpm dev, LAN IP, port 5280). Run it on the record's build (its commit, a clean tree)
 * for the replay to be exact; a different build is flagged.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, recordsIn } from "@scripts/run-record-read";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const arg = process.argv[2];
if (arg === undefined) {
  console.error("usage: pnpm run-record <telemetry.jsonl | rr1;… record text>");
  process.exit(2);
}

/** This checkout's build, as the game names it (vite.config.ts). */
const build = execFileSync("git", ["describe", "--always", "--dirty", "--exclude=*"], {
  cwd: ROOT,
})
  .toString()
  .trim();

/** The dev server's address on the LAN (ipconfig getifaddr en0, else en1). */
function devBase(): string {
  for (const dev of ["en0", "en1"]) {
    try {
      return `http://${execFileSync("ipconfig", ["getifaddr", dev]).toString().trim()}:5280`;
    } catch {}
  }
  throw new Error("no LAN address on en0 or en1");
}

const base = devBase();
const input = existsSync(arg) ? readFileSync(arg, "utf8") : arg;
for (const found of recordsIn(input)) console.log(`${describe(found, build, base).join("\n")}\n`);
