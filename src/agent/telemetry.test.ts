import { describe, expect, it } from "vitest";
import { Telemetry } from "@/agent/telemetry";
import { parseOptions } from "@/agent/url-options";

const { options } = parseOptions(new URLSearchParams(""), []);

function setup() {
  const sent: { body: string; keepalive: boolean }[] = [];
  let now = 0;
  const tel = new Telemetry(
    "s1",
    () => now,
    (body, keepalive) => sent.push({ body, keepalive }),
  );
  return { tel, sent, advance: (ms: number) => (now += ms) };
}

describe("Telemetry", () => {
  it("batches records with session, sequence and time", () => {
    const { tel, sent, advance } = setup();
    tel.record({
      kind: "load",
      url: "/?x",
      userAgent: "ua",
      css: [390, 844],
      dpr: 3,
      commit: "c",
      options,
    });
    advance(250);
    tel.record({
      kind: "perf",
      tick: 60,
      perf: {
        frames: 1,
        meanMs: 16,
        p95Ms: 16,
        maxMs: 16,
        longFrames: 0,
        simMeanMs: 1,
        renderMeanMs: 2,
        frozenSteps: 0,
      },
    });
    expect(sent).toEqual([]);
    tel.flush(false);
    expect(sent).toHaveLength(1);
    const lines = JSON.parse(sent[0].body);
    expect(
      lines.map((l: { seq: number; t: number; session: string }) => [l.session, l.seq, l.t]),
    ).toEqual([
      ["s1", 0, 0],
      ["s1", 1, 250],
    ]);
    expect(tel.pending).toBe(0);
  });

  it("sends errors at once, and flushes at 50 records", () => {
    const { tel, sent } = setup();
    tel.record({
      kind: "error",
      title: "Crash",
      lines: ["tick 5"],
      scenario: null,
      options,
      commit: "c",
      record: null,
    });
    expect(sent).toHaveLength(1);
    const perf = {
      frames: 1,
      meanMs: 16,
      p95Ms: 16,
      maxMs: 16,
      longFrames: 0,
      simMeanMs: 1,
      renderMeanMs: 2,
      frozenSteps: 0,
    };
    for (let i = 0; i < 49; i++) tel.record({ kind: "perf", tick: i, perf });
    expect(tel.pending).toBe(49);
    tel.record({ kind: "perf", tick: 49, perf });
    expect(tel.pending).toBe(0);
    expect(JSON.parse(sent[1].body)).toHaveLength(50);
  });

  it("does nothing on an empty flush and passes keepalive through", () => {
    const { tel, sent } = setup();
    tel.flush(true);
    expect(sent).toEqual([]);
    tel.record({
      kind: "load",
      url: "/",
      userAgent: "ua",
      css: [1, 1],
      dpr: 1,
      commit: "c",
      options,
    });
    tel.flush(true);
    expect(sent[0].keepalive).toBe(true);
  });
});
