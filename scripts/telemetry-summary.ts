import type { TelemetryLine } from "@/agent/telemetry";
import { runLines, sessionLines } from "@/game/telemetry";
import { reproUrl } from "@/game/url";

type RunRecord = Extract<TelemetryLine, { kind: "run" | "error" }>;

/** Seed, repro URL and build of a run or error; records logged before these fields say so. */
function repro(l: RunRecord): string {
  if (!("options" in l)) return "no repro (logged before scenario/options were recorded)";
  if (l.scenario === null) return `no scenario · ${l.commit}`;
  return `seed ${l.scenario.seed} · ${reproUrl(l.scenario, l.options)} · ${l.commit}`;
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
export function summarizeTelemetry(lines: readonly TelemetryLine[]): string[] {
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
      const [headline, ...detail] = runLines(l.report);
      out.push(`  ${headline}`, ...detail.map((d) => `    ${d}`), `    ${repro(l)}`);
    }
    for (const l of list)
      if (l.kind === "error")
        out.push(`  error ${l.title}: ${l.lines.join(" | ")}`, `    ${repro(l)}`);
    out.push(...sessionLines(list).map((line) => `  ${line}`));
  }
  return out;
}
