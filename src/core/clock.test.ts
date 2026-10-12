import { describe, expect, it } from "vitest";
import { FixedClock, MAX_TICKS_PER_FRAME, tickSeconds, ticks } from "@/core/clock";

describe("ticks", () => {
  it("converts seconds to whole 60 Hz ticks", () => {
    expect(ticks(1)).toBe(60);
    expect(ticks(1.2)).toBe(72);
    expect(ticks(0.07)).toBe(4);
    expect(tickSeconds(90)).toBeCloseTo(1.5);
  });
});

describe("FixedClock", () => {
  it("runs one tick for one 60 Hz frame, despite float error", () => {
    const c = new FixedClock(MAX_TICKS_PER_FRAME);
    for (let i = 0; i < 10; i++) expect(c.advance(1 / 60)).toBe(1);
  });

  it("carries partial frames over", () => {
    const c = new FixedClock(MAX_TICKS_PER_FRAME);
    expect(c.advance(0.5 / 60)).toBe(0);
    expect(c.advance(0.5 / 60)).toBe(1);
  });

  it("caps a stall at the maximum and drops the excess", () => {
    const c = new FixedClock(MAX_TICKS_PER_FRAME);
    expect(c.advance(1)).toBe(5);
    expect(c.advance(1 / 60)).toBe(1);
  });

  it("reset forgets accumulated time", () => {
    const c = new FixedClock(MAX_TICKS_PER_FRAME);
    c.advance(0.9 / 60);
    c.reset();
    expect(c.advance(0.2 / 60)).toBe(0);
  });
});
