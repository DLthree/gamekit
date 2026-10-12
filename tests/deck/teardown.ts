import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, PARTS_DIR } from "@deck/pad";
import { type DeckPart, deckReport } from "@scripts/deck-report";

/** Merges each test's part into shots/deck-check/report.{json,md}, and clears the parts. */
export default function teardown(): void {
  if (!existsSync(PARTS_DIR)) return;
  const parts: DeckPart[] = readdirSync(PARTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(PARTS_DIR, f), "utf8")));
  const { json, md, summary } = deckReport(parts, new Date().toISOString());
  writeFileSync(join(OUT_DIR, "report.json"), `${JSON.stringify(json, null, 2)}\n`);
  writeFileSync(join(OUT_DIR, "report.md"), md);
  rmSync(PARTS_DIR, { recursive: true, force: true });
  console.log(`${summary} → ${OUT_DIR}/report.md`);
}
