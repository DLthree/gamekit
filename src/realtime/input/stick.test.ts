import { describe, expect, it } from "vitest";
import { followCenter, stickVector } from "@/realtime/input/stick";

describe("stick", () => {
  it("reads zero inside the dead zone and ramps to 1 at the radius", () => {
    expect(stickVector(5, 0, 56, 8)).toEqual({ x: 0, y: 0 });
    expect(stickVector(32, 0, 56, 8).x).toBeCloseTo(0.5);
    expect(stickVector(0, 200, 56, 8)).toEqual({ x: 0, y: 1 });
  });

  it("drags the centre behind a thumb that runs past the radius", () => {
    expect(followCenter({ x: 0, y: 0 }, { x: 30, y: 0 }, 56)).toEqual({ x: 0, y: 0 });
    expect(followCenter({ x: 0, y: 0 }, { x: 100, y: 0 }, 56)).toEqual({ x: 44, y: 0 });
  });
});
