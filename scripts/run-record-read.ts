/**
 * The run record reader behind `pnpm run-record` (scripts/run-record.ts): finds records in what it
 * is given (a record's text, or a telemetry jsonl's wave and error lines), lays one out, and
 * writes its replay address (the game's replayQuery).
 */
import { parseRecord, type RunRecord } from "@/agent/record";
import { replayQuery } from "@/game/record";

/** A record and, from telemetry, how its run ended. */
export interface Found {
  record: RunRecord;
  ended: string | null;
}

/**
 * The records in `text`: the text itself when it is one (`rr1;…`), else each wave and error line
 * of a telemetry jsonl that carries one, in order. Throws when there is none.
 */
export function recordsIn(text: string): Found[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("rr")) return [{ record: parseRecord(trimmed), ended: null }];
  const out: Found[] = [];
  for (const [i, line] of trimmed.split("\n").entries()) {
    if (line.trim() === "") continue;
    let json: { kind?: string; record?: unknown; report?: { outcome?: string }; title?: string };
    try {
      json = JSON.parse(line);
    } catch (err) {
      throw new Error(`line ${i + 1} is not JSON: ${err instanceof Error ? err.message : err}`);
    }
    if (typeof json.record !== "string") continue;
    const ended =
      json.kind === "wave"
        ? (json.report?.outcome ?? "ended")
        : json.kind === "error"
          ? `error: ${json.title}`
          : null;
    out.push({ record: parseRecord(json.record), ended });
  }
  if (out.length === 0) throw new Error("no run records in it (wave or error lines with one)");
  return out;
}

/** A record as lines: build (flagged when not `thisBuild`), seed, choices, end, replay address. */
export function describe(found: Found, thisBuild: string, base: string): string[] {
  const { record } = found;
  const same = record.build === thisBuild;
  return [
    `build    ${record.build}${same ? "" : `  !! this checkout is ${thisBuild}: check out that build to replay it exactly`}`,
    `seed     ${record.seed}`,
    `choices  ${record.choices.join("  ") || "(none)"}`,
    ...(found.ended === null ? [] : [`ended    ${found.ended}`]),
    `replay   ${base}/?${replayQuery(record)}`,
  ];
}
