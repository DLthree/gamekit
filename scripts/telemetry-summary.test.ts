import { parseJsonl, summarizeTelemetry } from "@scripts/telemetry-summary";
import { describe, expect, it } from "vitest";
import { parseUrl } from "@/game/url";

const SCENARIO = {
  character: "hero",
  buildTier: 1,
  threatTier: 1,
  seed: 7,
  overrides: ["rules/feel.hitStopS=0"],
};
const OPTIONS = parseUrl("?aim=absolute").options;
const REPRO = "/?char=hero&build=1&threat=1&seed=7&o=rules%2Ffeel.hitStopS%3D0&aim=absolute";

const line = (o: object) =>
  JSON.stringify({
    session: "abcdef123456",
    seq: 0,
    t: 0,
    receivedAt: "2026-09-26T10:00:00.000Z",
    ...o,
  });

describe("summarizeTelemetry", () => {
  it("summarises each session: device, runs, errors, perf and gestures", () => {
    const text = [
      line({
        kind: "load",
        url: "/?char=hero&build=1&threat=1",
        userAgent: "iPhone",
        css: [390, 844],
        dpr: 3,
      }),
      line({ kind: "gesture", tick: 10, trace: { phase: "up", mode: "relative", result: "cast" } }),
      line({
        kind: "gesture",
        tick: 20,
        trace: { phase: "up", mode: "relative", result: "quick" },
      }),
      line({ kind: "gesture", tick: 25, trace: { phase: "move", mode: "relative" } }),
      line({
        kind: "perf",
        tick: 600,
        perf: {
          frames: 600,
          meanMs: 16.8,
          p95Ms: 19.2,
          maxMs: 40,
          longFrames: 2,
          simMeanMs: 1.2,
          renderMeanMs: 3,
          frozenSteps: 4,
        },
      }),
      line({
        kind: "run",
        scenario: SCENARIO,
        report: {
          outcome: "died",
          kills: 41,
          ticks: 3000,
          causeOfDeath: "dummy",
          sound: {
            played: 120,
            locked: 0,
            capped: 4,
            gapped: 30,
            state: "running",
            unlockFailures: 1,
          },
        },
        options: OPTIONS,
        commit: "a1b2c3d",
      }),
      line({
        kind: "error",
        title: "Crash",
        lines: ["hero build 1 × threat 1, seed 7", "tick 12", "boom"],
        scenario: SCENARIO,
        options: OPTIONS,
        commit: "a1b2c3d-dirty",
      }),
      line({
        kind: "error",
        title: "Address",
        lines: ["char is missing"],
        scenario: null,
        options: OPTIONS,
        commit: "a1b2c3d",
      }),
    ].join("\n");
    expect(summarizeTelemetry(parseJsonl(text))).toEqual([
      "session abcdef12 · 2026-09-26T10:00:00.000Z · /?char=hero&build=1&threat=1 · 390×844 @3x",
      "  wave died at 50.0 s, 41 kills, killed by dummy",
      "    sound played 120, locked 0, capped 4, gapped 30 · audio running, 1 unlock failures",
      `    seed 7 · ${REPRO} · a1b2c3d`,
      "  error Crash: hero build 1 × threat 1, seed 7 | tick 12 | boom",
      `    seed 7 · ${REPRO} · a1b2c3d-dirty`,
      "  error Address: char is missing",
      "    no scenario · a1b2c3d",
      "  perf worst p95 19.2 ms, max 40 ms, 2 long frames",
      "  gestures relative: cast 1, quick 1",
    ]);
  });

  it("says when a record predates the repro fields", () => {
    const text = line({ kind: "error", title: "Crash", lines: ["boom"] });
    expect(summarizeTelemetry(parseJsonl(text))).toEqual([
      "session abcdef12 · 2026-09-26T10:00:00.000Z · (no load record)",
      "  error Crash: boom",
      "    no repro (logged before scenario/options were recorded)",
    ]);
  });

  it("names the line that is not JSON", () => {
    expect(() => parseJsonl('{"a":1}\n{oops')).toThrow("line 2");
  });
});
