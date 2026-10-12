import { parseJsonl, summarizeTelemetry, type TelemetryWords } from "@scripts/telemetry-summary";
import { describe, expect, it } from "vitest";
import { recordText } from "@/agent/record";

/** A game's words in miniature: its report is opaque to the kit. */
const WORDS: TelemetryWords = {
  runLines: (r) => [`ended ${JSON.stringify(r)}`, "detail"],
  sessionLines: (list) => [`${list.length} lines`],
  replayQuery: (r) => [...r.choices, `seed=${r.seed}`].join("&"),
};
const RECORD = recordText({ build: "a1b2c3d", seed: 7, choices: ["deck=red", "o=x"] });

const line = (o: object) =>
  JSON.stringify({
    session: "abcdef123456",
    seq: 0,
    t: 0,
    receivedAt: "2026-09-26T10:00:00.000Z",
    ...o,
  });

describe("summarizeTelemetry", () => {
  it("summarises each session: device, runs, errors, then the game's own lines", () => {
    const text = [
      line({ kind: "load", url: "/?deck=red", userAgent: "iPhone", css: [390, 844], dpr: 3 }),
      line({ kind: "run", report: { won: true }, options: {}, commit: "a1b2c3d", record: RECORD }),
      line({
        kind: "error",
        title: "Crash",
        lines: ["tick 12", "boom"],
        options: {},
        commit: "a1b2c3d-dirty",
        record: RECORD,
      }),
      line({
        kind: "error",
        title: "Address",
        lines: ["deck is missing"],
        options: {},
        commit: "a1b2c3d",
        record: null,
      }),
    ].join("\n");
    expect(summarizeTelemetry(parseJsonl(text), WORDS)).toEqual([
      "session abcdef12 · 2026-09-26T10:00:00.000Z · /?deck=red · 390×844 @3x",
      '  ended {"won":true}',
      "    detail",
      "    seed 7 · /?deck=red&o=x&seed=7 · a1b2c3d",
      "  error Crash: tick 12 | boom",
      "    seed 7 · /?deck=red&o=x&seed=7 · a1b2c3d-dirty",
      "  error Address: deck is missing",
      "    no run · a1b2c3d",
      "  4 lines",
    ]);
  });

  it("says when a record predates run records", () => {
    const text = line({ kind: "error", title: "Crash", lines: ["boom"] });
    expect(summarizeTelemetry(parseJsonl(text), WORDS)).toEqual([
      "session abcdef12 · 2026-09-26T10:00:00.000Z · (no load record)",
      "  error Crash: boom",
      "    no repro (logged before run records)",
      "  1 lines",
    ]);
  });

  it("names the line that is not JSON", () => {
    expect(() => parseJsonl('{"a":1}\n{oops')).toThrow("line 2");
  });
});
