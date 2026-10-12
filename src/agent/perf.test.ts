import { describe, expect, it } from "vitest";
import { PerfMeter } from "@/agent/perf";

describe("PerfMeter", () => {
  it("summarises the recent frames", () => {
    const m = new PerfMeter(100);
    for (let i = 0; i < 95; i++) m.frame(16, 1);
    for (let i = 0; i < 5; i++) m.frame(50, 3);
    expect(m.summary()).toEqual({
      frames: 100,
      meanMs: 17.7,
      p95Ms: 50,
      maxMs: 50,
      longFrames: 5,
      simMeanMs: 1.1,
    });
  });

  it("keeps only the last `capacity` frames and resets to empty", () => {
    const m = new PerfMeter(3);
    for (const ms of [100, 10, 10, 10]) m.frame(ms, 0);
    expect(m.summary().maxMs).toBe(10);
    m.reset();
    expect(m.summary()).toEqual({
      frames: 0,
      meanMs: 0,
      p95Ms: 0,
      maxMs: 0,
      longFrames: 0,
      simMeanMs: 0,
    });
  });
});
