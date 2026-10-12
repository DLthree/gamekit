import { parseRecord, type RunRecord } from "@/agent/record";
import type { TelemetryLine } from "@/agent/telemetry";

type RunLine = Extract<TelemetryLine, { kind: "run" | "error" }>;
type RunReport = Extract<TelemetryLine, { kind: "run" }>["report"];

/** How the game words its records (src/game/telemetry.ts, src/game/record.ts). */
export interface TelemetryWords {
  /** A run's report: a headline, then detail lines. */
  runLines(report: RunReport): string[];
  /** The game's own records of one session. */
  sessionLines(lines: readonly TelemetryLine[]): string[];
  /** The address (query, no `?`) that replays a run record. */
  replayQuery(record: RunRecord): string;
}

/** Seed, replay address and build of a run or error; records logged before these fields say so. */
function repro(l: RunLine, words: TelemetryWords): string {
  if (!("record" in l)) return "no repro (logged before run records)";
  if (l.record === null) return `no run · ${l.commit}`;
  const r = parseRecord(l.record);
  return `seed ${r.seed} · /?${words.replayQuery(r)} · ${l.commit}`;
}

export function parseJsonl(text: string): TelemetryLine[] {
  const out: TelemetryLine[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    try {
      out.push(JSON.parse(lines[i]));
    } catch (e) {
      throw new Error(`line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

/** One block per session, in first-seen order: device, runs, errors, then the game's own lines. */
export function summarizeTelemetry(
  lines: readonly TelemetryLine[],
  words: TelemetryWords,
): string[] {
  const sessions = new Map<string, TelemetryLine[]>();
  for (const l of lines) {
    const list = sessions.get(l.session) ?? [];
    list.push(l);
    sessions.set(l.session, list);
  }
  const out: string[] = [];
  for (const [id, list] of sessions) {
    const load = list.find((l) => l.kind === "load");
    const where =
      load === undefined
        ? "(no load record)"
        : `${load.url} · ${load.css[0]}×${load.css[1]} @${load.dpr}x`;
    out.push(`session ${id.slice(0, 8)} · ${list[0].receivedAt} · ${where}`);
    for (const l of list) {
      if (l.kind !== "run") continue;
      const [headline, ...detail] = words.runLines(l.report);
      out.push(`  ${headline}`, ...detail.map((d) => `    ${d}`), `    ${repro(l, words)}`);
    }
    for (const l of list)
      if (l.kind === "error")
        out.push(`  error ${l.title}: ${l.lines.join(" | ")}`, `    ${repro(l, words)}`);
    out.push(...words.sessionLines(list).map((line) => `  ${line}`));
  }
  return out;
}
