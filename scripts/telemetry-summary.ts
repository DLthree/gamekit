import type { TelemetryLine } from "@/agent/telemetry";
import { TICK_HZ } from "@/core/clock";
import { reproUrl } from "@/flow/url";

type RunRecord = Extract<TelemetryLine, { kind: "wave" | "error" }>;

/** Seed, repro URL and build of a wave or error; records logged before these fields say so. */
function repro(l: RunRecord): string {
  if (!("options" in l)) return "no repro (logged before scenario/options were recorded)";
  if (l.scenario === null) return `no scenario · ${l.commit}`;
  return `seed ${l.scenario.seed} · ${reproUrl(l.scenario, l.options)} · ${l.commit}`;
}

/** The wave's sound requests and audio state; records logged before these fields say so. */
function sound(l: Extract<TelemetryLine, { kind: "wave" }>): string {
  if (!("sound" in l)) return "no sound (logged before sound was recorded)";
  const s = l.sound;
  return (
    `sound played ${s.played}, locked ${s.locked}, capped ${s.capped}, gapped ${s.gapped}` +
    ` · audio ${s.state}, ${s.unlockFailures} unlock failures`
  );
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

/** One block per session, in first-seen order: device, waves, errors, worst perf, gesture results. */
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
      if (l.kind === "wave") {
        const r = l.report;
        const cause = r.causeOfDeath === null ? "" : `, killed by ${r.causeOfDeath}`;
        out.push(
          `  wave ${r.outcome} at ${(r.ticks / TICK_HZ).toFixed(1)} s, ${r.kills} kills${cause}`,
          `    ${sound(l)}`,
          `    ${repro(l)}`,
        );
      }
    }
    for (const l of list)
      if (l.kind === "error")
        out.push(`  error ${l.title}: ${l.lines.join(" | ")}`, `    ${repro(l)}`);
    const perf = list.flatMap((l) => (l.kind === "perf" ? [l.perf] : []));
    if (perf.length > 0) {
      const p95 = Math.max(...perf.map((p) => p.p95Ms));
      const max = Math.max(...perf.map((p) => p.maxMs));
      const long = perf.reduce((n, p) => n + p.longFrames, 0);
      out.push(`  perf worst p95 ${p95} ms, max ${max} ms, ${long} long frames`);
    }
    const byMode = new Map<string, Map<string, number>>();
    for (const l of list) {
      if (l.kind !== "gesture" || l.trace.result === undefined) continue;
      const counts = byMode.get(l.trace.mode) ?? new Map<string, number>();
      counts.set(l.trace.result, (counts.get(l.trace.result) ?? 0) + 1);
      byMode.set(l.trace.mode, counts);
    }
    for (const [mode, counts] of byMode) {
      out.push(`  gestures ${mode}: ${[...counts].map(([k, n]) => `${k} ${n}`).join(", ")}`);
    }
  }
  return out;
}
