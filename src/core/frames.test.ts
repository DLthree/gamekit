import { describe, expect, it } from "vitest";
import { FRAME_HZ, type Frame, FrameClock } from "@/core/frames";

describe("FrameClock", () => {
  it("stepped, runs exactly n frames of 1/FRAME_HZ and ignores the display", () => {
    const clock = new FrameClock(true);
    const seen: Frame[] = [];
    clock.onFrame((f) => seen.push(f));
    clock.display(5);
    expect(seen).toEqual([]);
    clock.step(3);
    expect(seen.map((f) => f.index)).toEqual([1, 2, 3]);
    expect(seen[2]).toEqual({ index: 3, dtS: 1 / FRAME_HZ, nowS: 3 / FRAME_HZ });
  });

  it("in real time, follows the display and refuses to step", () => {
    const clock = new FrameClock(false);
    const seen: Frame[] = [];
    clock.onFrame((f) => seen.push(f));
    clock.display(10);
    clock.display(10.5);
    expect(seen).toEqual([
      { index: 1, dtS: 0, nowS: 10 },
      { index: 2, dtS: 0.5, nowS: 10.5 },
    ]);
    expect(() => clock.step(1)).toThrow(/tool mode/);
  });

  it("unsubscribes, and stops a step at a callback's throw", () => {
    const clock = new FrameClock(true);
    let calls = 0;
    const off = clock.onFrame(() => calls++);
    clock.step(2);
    off();
    clock.step(2);
    expect(calls).toBe(2);
    clock.onFrame((f) => {
      if (f.index === 6) throw new Error("boom");
    });
    expect(() => clock.step(5)).toThrow("boom");
    expect(clock.index).toBe(6);
    expect(() => clock.step(-1)).toThrow(/whole number/);
  });
});
