import type { TelemetryLine } from "@/agent/telemetry";
import { TICK_HZ } from "@/core/clock";
import type { WaveReport } from "@/game/report";
import { type RealtimeRecord, realtimeLines } from "@/realtime/agent/telemetry";
import type { SoundStatus } from "@/realtime/present/sound";

/**
 * The game's report in a finished run's telemetry record: the wave's report, and how sound went
 * (tells "audio stayed locked" or "resumes kept failing" apart from "sounds were bad").
 */
export type RunReport = WaveReport & { sound: SoundStatus };

/** The game's own telemetry records beside the kit's: the real-time layer's perf and gestures. */
export type GameRecord = RealtimeRecord;

/** A run's report as `pnpm telemetry` prints it: a headline, then detail lines. */
export function runLines(r: RunReport): string[] {
  const cause = r.causeOfDeath === null ? "" : `, killed by ${r.causeOfDeath}`;
  const s = r.sound;
  return [
    `wave ${r.outcome} at ${(r.ticks / TICK_HZ).toFixed(1)} s, ${r.kills} kills${cause}`,
    `sound played ${s.played}, locked ${s.locked}, capped ${s.capped}, gapped ${s.gapped}` +
      ` · audio ${s.state}, ${s.unlockFailures} unlock failures`,
  ];
}

/** A session's lines from the game's own records (perf, gestures). */
export function sessionLines(list: readonly TelemetryLine[]): string[] {
  return realtimeLines(list);
}
