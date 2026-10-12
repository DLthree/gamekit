import type { TelemetryLine } from "@/agent/telemetry";
import type { PerfSummary } from "@/realtime/agent/perf";
import type { SkillTrace } from "@/realtime/input/skill-button";

/** The real-time layer's telemetry: frame timings every few seconds, and skill-button gestures. */
export type RealtimeRecord =
  | { kind: "perf"; tick: number; perf: PerfSummary }
  | { kind: "gesture"; tick: number; trace: SkillTrace };

/** One session's worst perf and its gesture results by mode, for `pnpm telemetry`. */
export function realtimeLines(list: readonly TelemetryLine[]): string[] {
  const out: string[] = [];
  const perf = list.flatMap((l) => (l.kind === "perf" ? [l.perf] : []));
  if (perf.length > 0) {
    const p95 = Math.max(...perf.map((p) => p.p95Ms));
    const max = Math.max(...perf.map((p) => p.maxMs));
    const long = perf.reduce((n, p) => n + p.longFrames, 0);
    out.push(`perf worst p95 ${p95} ms, max ${max} ms, ${long} long frames`);
  }
  const byMode = new Map<string, Map<string, number>>();
  for (const l of list) {
    if (l.kind !== "gesture" || l.trace.result === undefined) continue;
    const counts = byMode.get(l.trace.mode) ?? new Map<string, number>();
    counts.set(l.trace.result, (counts.get(l.trace.result) ?? 0) + 1);
    byMode.set(l.trace.mode, counts);
  }
  for (const [mode, counts] of byMode) {
    out.push(`gestures ${mode}: ${[...counts].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  }
  return out;
}
