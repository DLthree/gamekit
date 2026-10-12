/**
 * pnpm steam:achievements
 *
 * The Steamworks dashboard's achievements, from content (the game's deeds, `deedList` in
 * src/game/deeds.ts), into release/steam-dashboard/: achievements.csv (API name, display name,
 * description) and achievements.json, the same rows. The desktop shell unlocks by these API
 * names (src/content/achievements.ts), so the dashboard must list them exactly. Icons (256×256
 * achieved and unachieved) are the game's to draw.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type Achievement, achievementTable } from "@/content/achievements";
import { formatContentError } from "@/content/errors";
import { loadContentDir, REPO_CONTENT_DIR } from "@/content/load-node";
import { deedList } from "@/game/deeds";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "release", "steam-dashboard");

function csvField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

/** The achievements as CSV, a header and a row each. */
export function achievementsCsv(rows: readonly Achievement[]): string {
  const lines = [
    ["API name", "Display name", "Description"],
    ...rows.map((r) => [r.apiName, r.name, r.description]),
  ];
  return `${lines.map((l) => l.map(csvField).join(",")).join("\n")}\n`;
}

const USAGE = "usage: pnpm steam:achievements";

const fail = (why: string): never => {
  console.error(`${why}\n${USAGE}`);
  process.exit(1);
};

function main(): void {
  parseArgs({ options: {} });
  const compiled = loadContentDir(REPO_CONTENT_DIR, []);
  if (!compiled.ok) fail(compiled.errors.map(formatContentError).join("\n"));
  else {
    const rows = achievementTable(deedList(compiled.content.sim));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, "achievements.csv"), achievementsCsv(rows));
    writeFileSync(join(OUT, "achievements.json"), `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`${OUT}: ${rows.length} achievements`);
  }
}

if (import.meta.main) main();
