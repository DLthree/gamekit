import type { UrlOptions } from "@/agent/url-options";
import type { GameRecord, RunReport } from "@/game/telemetry";

/**
 * The kit's records and the game's own (`GameRecord`, src/game/telemetry.ts). `commit` is the
 * build's `git describe --always --dirty`; a `run` or `error` record's `record` is the run record
 * text (src/agent/record.ts), which names everything needed to reopen that run (`pnpm
 * run-record`, the game's `replayQuery`).
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
  | {
      kind: "error";
      title: string;
      lines: string[];
      options: UrlOptions;
      commit: string;
      /** The run record, when a scenario was running. */
      record: string | null;
    }
  /** Deeds (achievements) earned by the run just ended. */
  | { kind: "deeds"; earned: string[] }
  /** A finished run: its run record and the game's report. */
  | {
      kind: "run";
      report: RunReport;
      options: UrlOptions;
      commit: string;
      record: string;
    }
  | GameRecord;

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
    if (r.kind === "error" || r.kind === "run" || this.queue.length >= BATCH) this.flush(false);
  }

  flush(keepalive: boolean): void {
    if (this.queue.length === 0) return;
    const body = JSON.stringify(this.queue);
    this.queue = [];
    this.send(body, keepalive);
  }
}
