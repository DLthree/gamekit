/** The channels between desktop/preload.ts and desktop/main.ts, and the saves' reply shape. */
export const IPC = {
  /** sendSync(key) → SaveReply<string | null> */
  saveGet: "game:save-get",
  /** sendSync(key, value) → SaveReply<null> */
  saveSet: "game:save-set",
  /** send(body): one telemetry flush, appended in the background */
  telemetry: "game:telemetry",
  /** sendSync() → string | null: why Steam couldn't start (Steam build) */
  steamProblem: "game:steam-problem",
  /** send(deedIds: string[]): unlock their achievements (Steam build) */
  steamDeeds: "game:steam-deeds",
} as const;

/** A save call's result: sendSync can't carry a thrown error, so the error travels as text. */
export type SaveReply<T> = { ok: true; value: T } | { ok: false; error: string };
