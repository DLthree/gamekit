import type { PerfSummary } from "@/agent/perf";
import type { UrlOptions } from "@/flow/url";
import type { SkillTrace } from "@/input/skill-button";
import type { SoundStatus } from "@/present/sound";
import type { WaveReport } from "@/sim/report";
import type { Scenario } from "@/sim/scenario";

/**
 * `commit` is the build's `git describe --always --dirty`; with the scenario and options, a
 * `wave` or `error` record names everything needed to reopen that run (`reproUrl`).
 */
export type TelemetryRecord =
  | {
      kind: "load";
      url: string;
      userAgent: string;
      css: [number, number];
      dpr: number;
      commit: string;
      options: UrlOptions;
    }
  | { kind: "perf"; tick: number; perf: PerfSummary }
  | {
      kind: "error";
      title: string;
      lines: string[];
      scenario: Scenario | null;
      options: UrlOptions;
      commit: string;
    }
  | { kind: "gesture"; tick: number; trace: SkillTrace }
  | {
      kind: "wave";
      scenario: Scenario;
      report: WaveReport;
      /** Tells "audio stayed locked" or "resumes kept failing" apart from "sounds were bad". */
      sound: SoundStatus;
      options: UrlOptions;
      commit: string;
    };

/** One line of the log: the record, who sent it, in what order, when (ms since load). */
export type TelemetryLine = TelemetryRecord & {
  session: string;
  seq: number;
  t: number;
  receivedAt: string;
};

const BATCH = 50;

/**
 * A session id for the telemetry log. Not `crypto.randomUUID()`: that's undefined on insecure
 * origins, and the phone loads the game over plain http on the LAN IP, so the app would never
 * boot there. `getRandomValues` works everywhere.
 */
export function randomSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A batching queue; the caller supplies the clock and the transport. */
export class Telemetry {
  private readonly session: string;
  private readonly now: () => number;
  private readonly send: (body: string, keepalive: boolean) => void;
  private queue: object[] = [];
  private seq = 0;

  constructor(
    session: string,
    now: () => number,
    send: (body: string, keepalive: boolean) => void,
  ) {
    this.session = session;
    this.now = now;
    this.send = send;
  }

  get pending(): number {
    return this.queue.length;
  }

  record(r: TelemetryRecord): void {
    this.queue.push({ session: this.session, seq: this.seq, t: Math.round(this.now()), ...r });
    this.seq += 1;
    if (r.kind === "error" || r.kind === "wave" || this.queue.length >= BATCH) this.flush(false);
  }

  flush(keepalive: boolean): void {
    if (this.queue.length === 0) return;
    const body = JSON.stringify(this.queue);
    this.queue = [];
    this.send(body, keepalive);
  }
}
